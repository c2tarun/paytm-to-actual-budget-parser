const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const api = require('@actual-app/api');
const readline = require('readline-sync');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');

// Log buffer for verbose mode (only shown on error)
const logBuffer = [];
let verboseMode = false;

// Capture original console methods and stderr write
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleInfo = console.info;
const originalStderrWrite = process.stderr.write;

function log(...args) {
  const message = args.join(' ');
  logBuffer.push(message);
  if (verboseMode) {
    originalConsoleLog(...args);
  }
}

function logError(...args) {
  console.error(...args);
}

function logSuccess(...args) {
  originalConsoleLog(...args);
}

function dumpLogs() {
  if (!verboseMode && logBuffer.length > 0) {
    originalConsoleLog('\n--- Detailed logs ---');
    logBuffer.forEach(line => originalConsoleLog(line));
  }
}

// Suppress console output from libraries unless in verbose mode
function suppressLibraryLogs() {
  console.log = (...args) => {
    const message = args.join(' ');
    logBuffer.push(message);
    if (verboseMode) {
      originalConsoleLog(...args);
    }
  };
  console.warn = (...args) => {
    const message = args.join(' ');
    logBuffer.push(`WARN: ${message}`);
    if (verboseMode) {
      originalConsoleWarn(...args);
    }
  };
  console.info = (...args) => {
    const message = args.join(' ');
    logBuffer.push(`INFO: ${message}`);
    if (verboseMode) {
      originalConsoleInfo(...args);
    }
  };

  // Suppress stderr writes (like dotenv messages) unless verbose
  process.stderr.write = function(chunk, encoding, callback) {
    const message = chunk.toString();
    // Skip dotenv messages entirely
    if (message.includes('[dotenv')) {
      if (typeof encoding === 'function') {
        encoding();
      } else if (callback) {
        callback();
      }
      return true;
    }

    logBuffer.push(`STDERR: ${message}`);
    if (verboseMode) {
      return originalStderrWrite.call(process.stderr, chunk, encoding, callback);
    }
    if (typeof encoding === 'function') {
      encoding();
    } else if (callback) {
      callback();
    }
    return true;
  };
}

function restoreConsoleLogs() {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.info = originalConsoleInfo;
  process.stderr.write = originalStderrWrite;
}

function cleanTag(tag) {
  if (!tag) return '';

  // Remove # symbol
  let cleaned = tag.replace(/#/g, '');

  // Trim whitespace
  cleaned = cleaned.trim();

  return cleaned;
}

function processCSV(csvContent) {
  const uniqueTags = new Set();

  // Parse CSV properly
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true
  });

  // Process each record
  const processedRecords = records.map(record => {
    // Get tags column
    const tagsColumn = record['Tags'] || '';

    // Extract and clean tags
    const tags = tagsColumn.split('#').filter(t => t.trim()).map(cleanTag).filter(t => t);

    // Add to unique tags set
    tags.forEach(tag => uniqueTags.add(tag));

    // Join cleaned tags with space
    const cleanedTags = tags.join(' ');

    // Update the Tags column with cleaned tags
    record['Tags'] = cleanedTags;

    // Remove the Remarks column
    delete record['Remarks'];

    return record;
  });

  // Convert back to CSV
  const outputCSV = stringify(processedRecords, {
    header: true
  });

  return {
    csv: outputCSV,
    tags: Array.from(uniqueTags),
    records: processedRecords
  };
}

async function ensureCategories(tags, actualConfig) {
  log('\n4. Syncing categories with Actual Budget...');

  // Initialize API
  await api.init({
    dataDir: actualConfig.dataDir,
    serverURL: actualConfig.serverURL,
    password: actualConfig.password
  });

  await api.downloadBudget(actualConfig.syncID);

  // Get existing categories
  const categories = await api.getCategories();
  const categoryNames = categories.map(c => c.name.toLowerCase());

  log(`   Found ${categories.length} existing categories`);
  log(`   Found ${tags.length} unique tags in statements`);

  // Check which tags need new categories
  const missingTags = tags.filter(tag => !categoryNames.includes(tag.toLowerCase()));

  if (missingTags.length > 0) {
    log(`\n   Need to create ${missingTags.length} new categories: ${missingTags.join(', ')}`);

    // Get category groups
    let categoryGroups = await api.getCategoryGroups();

    if (categoryGroups.length === 0) {
      throw new Error('No category groups found in Actual Budget');
    }

    // Create categories one by one
    for (const tag of missingTags) {
      console.log(`\n   Creating category for tag: "${tag}"`);
      console.log('   Available category groups:');
      categoryGroups.forEach((group, index) => {
        console.log(`   ${index + 1}. ${group.name}`);
      });
      console.log(`   ${categoryGroups.length + 1}. Create a new group`);

      const choice = readline.questionInt(`\n   Select a category group for "${tag}" (enter number): `);

      let selectedGroup;

      if (choice === categoryGroups.length + 1) {
        // Create new group
        const groupName = readline.question('   Enter new group name: ');
        log(`   Creating new category group: ${groupName}`);
        selectedGroup = await api.createCategoryGroup({
          name: groupName,
          is_income: false
        });
        log(`   ✓ Created group: ${groupName}`);

        // Refresh category groups list
        categoryGroups = await api.getCategoryGroups();
      } else if (choice > 0 && choice <= categoryGroups.length) {
        selectedGroup = categoryGroups[choice - 1];
      } else {
        throw new Error('Invalid selection');
      }

      // Create category
      await api.createCategory({
        name: tag,
        group_id: selectedGroup.id,
        is_income: false
      });
      log(`   ✓ Created category "${tag}" in group "${selectedGroup.name}"`);
    }
  } else {
    log('   ✓ All tags already have matching categories');
  }

  await api.shutdown();
  log('   ✓ Category sync complete\n');
}

async function importTransactions(transactions, categoryMap, actualConfig, accountId) {
  log('\n5. Importing transactions to Actual Budget...');

  // Initialize API
  await api.init({
    dataDir: actualConfig.dataDir,
    serverURL: actualConfig.serverURL,
    password: actualConfig.password
  });

  await api.downloadBudget(actualConfig.syncID);

  // Get accounts
  const accounts = await api.getAccounts();

  let selectedAccount;

  if (accountId) {
    // Use provided account ID
    selectedAccount = accounts.find(acc => acc.id === accountId);
    if (!selectedAccount) {
      throw new Error(`Account with ID ${accountId} not found`);
    }
    log(`   Using account: ${selectedAccount.name}`);
  } else {
    // Prompt for account selection
    console.log('\n   Available accounts:');
    accounts.forEach((account, index) => {
      console.log(`   ${index + 1}. ${account.name} (${account.type || 'N/A'})`);
    });

    const accountChoice = readline.questionInt('\n   Select account for import (enter number): ');

    if (accountChoice < 1 || accountChoice > accounts.length) {
      throw new Error('Invalid account selection');
    }

    selectedAccount = accounts[accountChoice - 1];
    log(`   Using account: ${selectedAccount.name}`);
  }

  // Prepare transactions for import
  const actualTransactions = transactions.map(txn => {
    // Parse amount (remove commas and convert to cents)
    const amountStr = txn.Amount.replace(/,/g, '');
    const amountFloat = parseFloat(amountStr);
    const amountCents = Math.round(amountFloat * 100);

    // Get category ID from tag
    const firstTag = (txn.Tags || '').trim();
    const categoryId = firstTag && categoryMap[firstTag.toLowerCase()]
      ? categoryMap[firstTag.toLowerCase()]
      : null;

    // Parse date from DD/MM/YYYY to YYYY-MM-DD
    const dateParts = txn.Date.split('/');
    const formattedDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;

    return {
      date: formattedDate,
      amount: amountCents,
      payee_name: txn['Transaction Details'],
      notes: txn['Other Transaction Details (UPI ID or A/c No)'] || '',
      imported_id: txn['UPI Ref No.'],
      category: categoryId,
    };
  });

  log(`\n   Importing ${actualTransactions.length} transactions...`);

  await api.importTransactions(selectedAccount.id, actualTransactions);
  log(`   ✓ Imported ${actualTransactions.length} transactions`);

  await api.shutdown();
  log('   ✓ Import complete\n');
}

async function processStatements(actualConfig) {
  const statementsDir = path.join(__dirname, 'statements');
  const outputDir = path.join(__dirname, 'processed');

  // Create directories if they don't exist
  if (!fs.existsSync(statementsDir)) {
    fs.mkdirSync(statementsDir);
    logSuccess('Created statements folder. Please add your .xlsx files there.');
    return;
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  // Step 1: Scan for xlsx files
  log('1. Scanning for .xlsx files in statements folder...');
  const files = fs.readdirSync(statementsDir).filter(f => f.endsWith('.xlsx'));

  if (files.length === 0) {
    logSuccess('No .xlsx files found in statements folder.');
    return;
  }

  logSuccess(`Found ${files.length} file(s)`);
  log(`   Files: ${files.join(', ')}\n`);

  const allTags = new Set();
  const allTransactions = [];

  files.forEach(file => {
    const excelPath = path.join(statementsDir, file);
    const baseName = path.basename(file, '.xlsx');

    log(`Processing: ${file}`);

    // Step 2: Convert to CSV
    log('  2. Converting to CSV...');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = 'Passbook Payment History';

    if (!workbook.SheetNames.includes(sheetName)) {
      logError(`  ✗ Sheet "${sheetName}" not found, skipping.`);
      return;
    }

    const worksheet = workbook.Sheets[sheetName];
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);

    // Step 3: Parse and clean tags
    log('  3. Cleaning tags...');
    const { csv: processedCSV, tags, records } = processCSV(csvContent);

    // Collect all unique tags
    tags.forEach(tag => allTags.add(tag));

    // Collect all transactions
    allTransactions.push(...records);

    // Step 5: Write final CSV
    const outputPath = path.join(outputDir, `${baseName}_processed.csv`);
    fs.writeFileSync(outputPath, processedCSV, 'utf8');
    log(`  ✓ Saved to: ${outputPath}\n`);
  });

  // Step 4: Ensure categories exist in Actual Budget
  if (actualConfig && allTags.size > 0) {
    await ensureCategories(Array.from(allTags), actualConfig);
  }

  // Step 5: Import transactions
  if (actualConfig && allTransactions.length > 0) {
    // Re-initialize API to get category mapping
    await api.init({
      dataDir: actualConfig.dataDir,
      serverURL: actualConfig.serverURL,
      password: actualConfig.password
    });
    await api.downloadBudget(actualConfig.syncID);

    const categories = await api.getCategories();
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat.name.toLowerCase()] = cat.id;
    });

    await api.shutdown();

    // Use account ID from environment variable or config
    const accountId = process.env.ACCOUNT_ID || actualConfig.accountId;
    await importTransactions(allTransactions, categoryMap, actualConfig, accountId);
  }

  // Return summary for success message
  return {
    filesProcessed: files.length,
    transactionsImported: allTransactions.length,
    categoriesFound: allTags.size
  };
}

if (require.main === module) {
  // Suppress library logs unless verbose mode is enabled
  suppressLibraryLogs();

  // Load environment variables from .env file
  require('dotenv').config();

  // Load configuration from environment variables (.env file)
  const actualConfig = {
    serverURL: process.env.ACTUAL_SERVER_URL || 'http://localhost:5006',
    password: process.env.ACTUAL_PASSWORD,
    syncID: process.env.ACTUAL_SYNC_ID,
    dataDir: process.env.ACTUAL_DATA_DIR || '../actual-data',
    accountId: process.env.ACCOUNT_ID
  };

  // Validate required configuration
  if (!actualConfig.password || !actualConfig.syncID) {
    logError('Error: Missing required configuration!');
    logError('Please create a .env file with ACTUAL_PASSWORD and ACTUAL_SYNC_ID');
    logError('See .env.example for template');
    process.exit(1);
  }

  processStatements(actualConfig)
    .then(summary => {
      if (summary) {
        restoreConsoleLogs();
        logSuccess(`\n✓ Import completed successfully`);
        logSuccess(`  Files: ${summary.filesProcessed}`);
        logSuccess(`  Transactions: ${summary.transactionsImported}`);
        logSuccess(`  Categories: ${summary.categoriesFound}`);
      }
    })
    .catch(err => {
      restoreConsoleLogs();
      logError('\n✗ Error occurred during processing:');
      logError(err);
      logError('');
      dumpLogs();
      process.exit(1);
    });
}

module.exports = { processStatements, cleanTag };
