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
const log = require('./logger');
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
  log.info('processing_file', { fileName });

  const csvContent = excelToCSV(filePath);
  const { csv, tags, records } = processCSV(csvContent);

  // Save processed CSV
  const baseName = path.basename(fileName, '.xlsx');
  const outputPath = path.join(config.processedDir, `${baseName}_processed.csv`);
  fs.writeFileSync(outputPath, csv, 'utf8');
  log.info('file_converted', { fileName, tags: tags.length, transactions: records.length, outputPath });

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
    log.warn('statements_dir_created', { dir: statementsDir });
    return null;
  }

  ensureDirectoryExists(outputDir);

  // Scan for Excel files
  const files = fs.readdirSync(statementsDir).filter(f => f.endsWith('.xlsx'));

  if (files.length === 0) {
    log.info('no_files_found', { dir: statementsDir });
    return null;
  }

  log.info('files_found', { count: files.length, files });

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
      log.error('file_processing_error', { file, error: error.message });
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
 * @param {string} [accountIdOverride] - Actual Budget account ID (e.g. from S3 metadata)
 * @param {string} [accountKeyOverride] - Account key (e.g. "tarun_paytm" from S3 metadata)
 */
async function main(accountIdOverride, accountKeyOverride) {
  const actualConfigured = !!(config.password && config.syncID);
  const fireflyConfigured = config.fireflyEnabled;

  log.info('main_start', {
    actualConfigured,
    fireflyConfigured,
    accountIdOverride: accountIdOverride || null,
    accountKeyOverride: accountKeyOverride || null,
  });

  if (!actualConfigured && !fireflyConfigured) {
    throw new Error(
      'At least one destination must be configured. ' +
      'Set ACTUAL_PASSWORD + ACTUAL_SYNC_ID and/or FIREFLY_URL + FIREFLY_TOKEN'
    );
  }

  // Process all statement files
  const result = processAllStatements();

  if (!result || result.transactions.length === 0) {
    log.info('no_transactions');
    return;
  }

  const { tags, transactions } = result;
  log.info('statements_processed', { transactionCount: transactions.length, tagCount: tags.length });
  const results = { actualBudget: null, firefly: null };

  // --- Actual Budget import ---
  if (actualConfigured) {
    try {
      if (tags.length > 0) {
        await ensureCategories(tags, config);
      }
      const categoryMap = await buildCategoryMap(config);
      const transformedTransactions = transformTransactions(transactions, categoryMap);
      const accountId = accountIdOverride || process.env.ACCOUNT_ID || config.accountId;
      await importToActualBudget(transformedTransactions, config, accountId);
      results.actualBudget = { success: true, count: transformedTransactions.length };
    } catch (error) {
      results.actualBudget = { success: false, error: error.message };
      log.error('actual_budget_import_failed', { error: error.message, stack: error.stack });
    }
  }

  // --- Firefly III import ---
  if (fireflyConfigured) {
    try {
      const { importToFirefly } = require('./fireflyAPI');
      // Resolve Firefly account ID: map lookup (using account key e.g. "tarun_paytm") → fallback to single ID
      const fireflyAccountId = (config.fireflyAccountMap && accountKeyOverride)
        ? config.fireflyAccountMap[accountKeyOverride]
        : config.fireflyAccountId;
      log.info('firefly_account_resolved', {
        accountKey: accountKeyOverride,
        fireflyAccountId,
        source: (config.fireflyAccountMap && accountKeyOverride) ? 'map' : 'env',
      });
      const summary = await importToFirefly(transactions, config, fireflyAccountId);
      results.firefly = { success: true, ...summary };
    } catch (error) {
      results.firefly = { success: false, error: error.message };
      log.error('firefly_import_failed', { error: error.message, stack: error.stack });
    }
  }

  // Fail only if ALL enabled destinations failed
  const actualFailed = actualConfigured && results.actualBudget && !results.actualBudget.success;
  const fireflyFailed = fireflyConfigured && results.firefly && !results.firefly.success;

  if (actualFailed && fireflyFailed) {
    throw new Error('All import destinations failed');
  }
  if (actualFailed || fireflyFailed) {
    log.warn('partial_import_failure', results);
  }

  log.info('import_complete', results);
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => log.info('done'))
    .catch(err => {
      log.error('fatal_error', { error: err.message, stack: err.stack });
      process.exit(1);
    });
}

module.exports = { main, processAllStatements };