// Polyfill browser globals required by @actual-app/api
globalThis.navigator = { platform: 'linux', userAgent: '' };

const fs = require('fs');
const path = require('path');
const config = require('./config');
const log = require('./logger');
const { createS3Client, listIncomingFiles, downloadFile, moveToProcessed } = require('./s3Poller');
const { main } = require('./index');
const { startHttpServer } = require('./httpServer');

const controller = {
  shuttingDown: false,
  pollInProgress: false,
  rerunRequested: false,
};

/**
 * Runs a single poll cycle: list S3 files, download, process, move to processed
 */
async function pollCycle(s3Client) {
  if (controller.shuttingDown) return;
  controller.pollInProgress = true;

  try {
    log.info('poll_cycle_start', { bucket: config.s3BucketName, prefix: config.s3IncomingPrefix });

    const keys = await listIncomingFiles(
      s3Client,
      config.s3BucketName,
      config.s3IncomingPrefix
    );

    if (keys.length === 0) {
      log.debug('no_new_files');
      return;
    }

    log.info('files_found', { count: keys.length, keys });

    // Process files sequentially (Actual Budget API can't handle concurrent access)
    for (const key of keys) {
      if (controller.shuttingDown) {
        log.warn('shutdown_requested_mid_cycle', { remaining: keys.indexOf(key) });
        break;
      }

      let localPath = null;

      try {
        // Download file from S3
        const { localPath: downloadedPath, fileName, accountId, accountKey } = await downloadFile(
          s3Client,
          config.s3BucketName,
          key,
          config.statementsDir
        );
        localPath = downloadedPath;

        log.info('file_downloaded', { key, fileName, accountId, accountKey, localPath });

        log.debug('calling_main', { accountId, accountKey });
        // Run the importer
        await main(accountId, accountKey);
        log.debug('main_returned', { key, fileName });

        // Move to processed in S3
        await moveToProcessed(
          s3Client,
          config.s3BucketName,
          key,
          config.s3ProcessedPrefix
        );

        log.info('file_processed', { key, fileName, accountId });
      } catch (error) {
        log.error('file_processing_failed', {
          key,
          error: error.message,
          stack: error.stack
        });
        // Leave file in incoming/ for retry on next cycle
      } finally {
        // Clean up local file
        if (localPath && fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }
    }
  } catch (error) {
    log.error('poll_cycle_error', { error: error.message, stack: error.stack });
  } finally {
    controller.pollInProgress = false;
  }
}

/**
 * Wraps pollCycle with concurrency control. If a cycle is already running,
 * a rerun is queued and will execute once the current cycle ends. Overlapping
 * triggers collapse into a single rerun.
 */
async function runCycleSafely(s3Client) {
  if (controller.shuttingDown) return;

  if (controller.pollInProgress) {
    controller.rerunRequested = true;
    log.info('poll_cycle_queued');
    return;
  }

  do {
    controller.rerunRequested = false;
    await pollCycle(s3Client);
  } while (controller.rerunRequested && !controller.shuttingDown);
}

/**
 * Main entry point for the polling service
 */
async function start() {
  // Validate required config
  if (!config.s3BucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is required');
  }
  const actualConfigured = config.password && config.syncID;
  const fireflyConfigured = config.fireflyEnabled;
  if (!actualConfigured && !fireflyConfigured) {
    throw new Error(
      'At least one destination must be configured. ' +
      'Set ACTUAL_PASSWORD + ACTUAL_SYNC_ID and/or FIREFLY_URL + FIREFLY_TOKEN'
    );
  }

  // Ensure local directories exist
  for (const dir of [config.statementsDir, config.processedDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const s3Client = createS3Client(config.s3Region);
  const intervalMs = config.pollIntervalMs;

  log.info('poller_started', {
    bucket: config.s3BucketName,
    prefix: config.s3IncomingPrefix,
    actualBudgetUrl: config.serverURL,
    fireflyUrl: config.fireflyURL,
    fireflyEnabled: config.fireflyEnabled,
    fireflyAccountMap: config.fireflyAccountMap,
    actualConfigured: !!(config.password && config.syncID),
    pollIntervalSec: intervalMs / 1000,
    defaultCategoryGroup: config.defaultCategoryGroup
  });

  // Run first cycle immediately
  await runCycleSafely(s3Client);

  // Schedule subsequent cycles
  const intervalId = setInterval(() => runCycleSafely(s3Client), intervalMs);

  // Start HTTP server for manual /sync trigger + /health
  const httpServer = startHttpServer({
    port: config.httpPort,
    controller,
    triggerSync: () => runCycleSafely(s3Client),
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    log.info('shutdown_signal', { signal });
    controller.shuttingDown = true;
    clearInterval(intervalId);

    if (httpServer && typeof httpServer.close === 'function') {
      httpServer.close();
    }

    // Wait for in-progress cycle to finish
    if (controller.pollInProgress) {
      log.info('waiting_for_cycle');
      while (controller.pollInProgress) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    log.info('shutdown_complete');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch(err => {
  log.error('fatal_error', { error: err.message, stack: err.stack });
  process.exit(1);
});
