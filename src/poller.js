const fs = require('fs');
const path = require('path');
const config = require('./config');
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
    console.log(`\n[${new Date().toISOString()}] Polling S3 for new files...`);

    const keys = await listIncomingFiles(
      s3Client,
      config.s3BucketName,
      config.s3IncomingPrefix
    );

    if (keys.length === 0) {
      console.log('   No new files found.');
      return;
    }

    console.log(`   Found ${keys.length} file(s) to process.`);

    // Process files sequentially (Actual Budget API can't handle concurrent access)
    for (const key of keys) {
      if (shuttingDown) {
        console.log('   Shutdown requested, stopping after current file.');
        break;
      }

      console.log(`\n--- Processing: ${key} ---`);
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

        console.log(`   Downloaded: ${fileName}`);
        if (accountId) {
          console.log(`   Account ID from metadata: ${accountId}`);
        }

        // Run the importer
        await main(accountId);

        // Move to processed in S3
        await moveToProcessed(
          s3Client,
          config.s3BucketName,
          key,
          config.s3ProcessedPrefix
        );

        console.log(`   ✓ Successfully processed: ${fileName}`);
      } catch (error) {
        console.error(`   ✗ Error processing ${key}: ${error.message}`);
        console.error(error.stack);
        // Leave file in incoming/ for retry on next cycle
      } finally {
        // Clean up local file
        if (localPath && fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }
    }
  } catch (error) {
    console.error(`   ✗ Poll cycle error: ${error.message}`);
    console.error(error.stack);
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

  console.log('=== Paytm Statement Poller ===');
  console.log(`   S3 Bucket: ${config.s3BucketName}`);
  console.log(`   S3 Prefix: ${config.s3IncomingPrefix}`);
  console.log(`   Actual Budget: ${config.serverURL}`);
  console.log(`   Poll interval: ${intervalMs / 1000}s`);
  console.log(`   Default category group: ${config.defaultCategoryGroup}`);
  console.log('');

  // Run first cycle immediately
  await pollCycle(s3Client);

  // Schedule subsequent cycles
  const intervalId = setInterval(() => pollCycle(s3Client), intervalMs);

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[${new Date().toISOString()}] Received ${signal}, shutting down...`);
    shuttingDown = true;
    clearInterval(intervalId);

    // Wait for in-progress cycle to finish
    if (pollInProgress) {
      console.log('   Waiting for current poll cycle to complete...');
      while (pollInProgress) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('   Shutdown complete.');
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
