/**
 * Paytm to Actual Budget Transaction Importer
 *
 * This script processes Paytm Excel statements and imports transactions
 * to Actual Budget with automatic category mapping.
 *
 * Usage:
 *   1. Place your Paytm .xlsx files in the 'statements' folder
 *   2. Configure your Actual Budget connection in config.js or via environment variables
 *   3. Run: node index.js
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { ensureDirectoryExists, createCategoryMap } = require('./utils');
const { excelToCSV, processCSV } = require('./excelProcessor');
const { ensureCategories, importToActualBudget, api } = require('./actualBudgetAPI');
const { transformTransactions } = require('./transactionMapper');

/**
 * Processes a single Excel statement file
 * @param {string} filePath - Path to Excel file
 * @param {string} fileName - File name
 * @returns {Object} - Processed transactions and tags
 */
function processStatementFile(filePath, fileName) {
  console.log(`Processing: ${fileName}`);

  console.log('  2. Converting to CSV...');
  const csvContent = excelToCSV(filePath);

  console.log('  3. Cleaning tags...');
  const { csv, tags, records } = processCSV(csvContent);

  // Save processed CSV
  const baseName = path.basename(fileName, '.xlsx');
  const outputPath = path.join(config.processedDir, `${baseName}_processed.csv`);
  fs.writeFileSync(outputPath, csv, 'utf8');
  console.log(`  ✓ Saved to: ${outputPath}\n`);

  return { tags, records };
}

/**
 * Scans and processes all Excel files in statements directory
 * @returns {Object} - All unique tags and transactions
 */
function processAllStatements() {
  const statementsDir = config.statementsDir;
  const outputDir = config.processedDir;

  // Ensure directories exist
  if (!fs.existsSync(statementsDir)) {
    fs.mkdirSync(statementsDir);
    console.log('Created statements folder. Please add your .xlsx files there.');
    return null;
  }

  ensureDirectoryExists(outputDir);

  // Scan for Excel files
  console.log('1. Scanning for .xlsx files in statements folder...');
  const files = fs.readdirSync(statementsDir).filter(f => f.endsWith('.xlsx'));

  if (files.length === 0) {
    console.log('No .xlsx files found in statements folder.');
    return null;
  }

  console.log(`Found ${files.length} file(s): ${files.join(', ')}\n`);

  // Process each file
  const allTags = new Set();
  const allTransactions = [];

  files.forEach(file => {
    try {
      const filePath = path.join(statementsDir, file);
      const { tags, records } = processStatementFile(filePath, file);

      tags.forEach(tag => allTags.add(tag));
      allTransactions.push(...records);
    } catch (error) {
      console.error(`  ✗ Error processing ${file}: ${error.message}`);
    }
  });

  return {
    tags: Array.from(allTags),
    transactions: allTransactions
  };
}

/**
 * Builds category map from Actual Budget
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} - Category name to ID map
 */
async function buildCategoryMap(config) {
  await api.init({
    dataDir: config.dataDir,
    serverURL: config.serverURL,
    password: config.password
  });

  await api.downloadBudget(config.syncID);

  const categories = await api.getCategories();
  const categoryMap = createCategoryMap(categories);

  await api.shutdown();

  return categoryMap;
}

/**
 * Main entry point
 * @param {string} [accountIdOverride] - Account ID override (e.g. from S3 metadata)
 */
async function main(accountIdOverride) {
  // Validate configuration
  if (!config.password || !config.syncID) {
    throw new Error(
      'Actual Budget password and syncID must be configured. ' +
      'Set environment variables ACTUAL_PASSWORD and ACTUAL_SYNC_ID'
    );
  }

  // Process all statement files
  const result = processAllStatements();

  if (!result || result.transactions.length === 0) {
    console.log('No transactions to process.');
    return;
  }

  const { tags, transactions } = result;

  // Ensure all categories exist
  if (tags.length > 0) {
    await ensureCategories(tags, config);
  }

  // Build category mapping and transform transactions
  const categoryMap = await buildCategoryMap(config);
  const transformedTransactions = transformTransactions(transactions, categoryMap);

  // Import transactions
  const accountId = accountIdOverride || process.env.ACCOUNT_ID || config.accountId;
  await importToActualBudget(transformedTransactions, config, accountId);

  console.log('All files processed successfully!');
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => console.log('Done'))
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { main, processAllStatements };