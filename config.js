/**
 * Configuration for Actual Budget API connection
 * Load sensitive values from environment variables
 *
 * IMPORTANT: Create a .env file with your credentials (see .env.example)
 * Never commit .env file to version control!
 */

// Load environment variables from .env file
require('dotenv').config();

module.exports = {
  // Actual Budget server configuration (loaded from .env)
  serverURL: process.env.ACTUAL_SERVER_URL || 'http://localhost:5006',
  password: process.env.ACTUAL_PASSWORD,
  syncID: process.env.ACTUAL_SYNC_ID,
  dataDir: process.env.ACTUAL_DATA_DIR || '../actual-data',

  // Optional: Pre-configured account ID to skip interactive selection
  accountId: process.env.ACCOUNT_ID,

  // Directory paths
  statementsDir: './statements',
  processedDir: './processed',

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