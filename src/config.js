/**
 * Configuration for Actual Budget API connection
 * Load sensitive values from environment variables
 *
 * IMPORTANT: Create a .env file with your credentials (see .env.example)
 * Never commit .env file to version control!
 */

const path = require('path');

// Load environment variables from .env file (no-op in Docker where env vars come from compose)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
  // Actual Budget server configuration (loaded from .env)
  serverURL: process.env.ACTUAL_SERVER_URL || 'http://localhost:5006',
  password: process.env.ACTUAL_PASSWORD,
  syncID: process.env.ACTUAL_SYNC_ID,
  dataDir: process.env.ACTUAL_DATA_DIR || path.resolve(__dirname, '../actual-data'),

  // Optional: Pre-configured account ID to skip interactive selection
  accountId: process.env.ACCOUNT_ID,

  // Directory paths (resolved relative to project root, not src/)
  statementsDir: path.resolve(__dirname, '../statements'),
  processedDir: path.resolve(__dirname, '../processed'),

  // S3 configuration
  s3BucketName: process.env.S3_BUCKET_NAME,
  s3Region: process.env.AWS_REGION || 'ap-south-1',
  s3IncomingPrefix: process.env.S3_INCOMING_PREFIX || 'incoming/',
  s3ProcessedPrefix: process.env.S3_PROCESSED_PREFIX || 'processed/',

  // Polling configuration
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '300000', 10),

  // Category defaults
  defaultCategoryGroup: process.env.DEFAULT_CATEGORY_GROUP || 'Usual Expenses',

  // Firefly III configuration (optional - enabled when URL and token are set)
  fireflyURL: process.env.FIREFLY_URL || null,
  fireflyToken: process.env.FIREFLY_TOKEN || null,
  fireflyAccountId: process.env.FIREFLY_ACCOUNT_ID || null,
  fireflyAccountMap: process.env.FIREFLY_ACCOUNT_MAP
    ? JSON.parse(process.env.FIREFLY_ACCOUNT_MAP)
    : null,
  fireflyEnabled: !!(process.env.FIREFLY_URL && process.env.FIREFLY_TOKEN),

  // Excel file configuration
  sheetName: 'Passbook Payment History',

  // Column names from Paytm statement
  columns: {
    date: 'Date',
    time: 'Time',
    transactionDetails: 'Transaction Details',
    otherDetails: 'Other Transaction Details (UPI ID or A/c No)',
    account: 'Your Account',
    amount: 'Amount',
    upiRefNo: 'UPI Ref No.',
    orderId: 'Order ID',
    remarks: 'Remarks',
    tags: 'Tags',
    comment: 'Comment'
  }
};
