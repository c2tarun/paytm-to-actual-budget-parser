const fs = require('fs');
const path = require('path');
const config = require('./config');
const log = require('./logger');
const { createS3Client, listIncomingFiles, downloadFile, moveToProcessed } = require('./s3Poller');
const { main } = require('./index');

let shuttingDown = false;
let pollInProgress = false;

/**
 * Runs a single poll cycle: list S3 files, download, process, move to processed
 */
async function pollCycle(s3Client) {
  if (shuttingDown) return;
  pollInProgress = true;

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
      if (shuttingDown) {
        log.warn('shutdown_requested_mid_cycle', { remaining: keys.indexOf(key) });
        break;
      }

      let localPath = null;

      try {
        // Download file from S3
        const { localPath: downloadedPath, fileName, accountId } = await downloadFile(
          s3Client,
          config.s3BucketName,
          key,
          config.statementsDir
        );
        localPath = downloadedPath;

        log.info('file_downloaded', { key, fileName, accountId });

        // Run the importer
        await main(accountId);

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
    pollInProgress = false;
  }
}

/**
 * Main entry point for the polling service
 */
async function start() {
  // Validate required config
  if (!config.s3BucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is required');
  }
  if (!config.password) {
    throw new Error('ACTUAL_PASSWORD environment variable is required');
  }
  if (!config.syncID) {
    throw new Error('ACTUAL_SYNC_ID environment variable is required');
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
    pollIntervalSec: intervalMs / 1000,
    defaultCategoryGroup: config.defaultCategoryGroup
  });

  // Run first cycle immediately
  await pollCycle(s3Client);

  // Schedule subsequent cycles
  const intervalId = setInterval(() => pollCycle(s3Client), intervalMs);

  // Graceful shutdown
  const shutdown = async (signal) => {
    log.info('shutdown_signal', { signal });
    shuttingDown = true;
    clearInterval(intervalId);

    // Wait for in-progress cycle to finish
    if (pollInProgress) {
      log.info('waiting_for_cycle');
      while (pollInProgress) {
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
