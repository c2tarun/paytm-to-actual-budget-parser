const api = require('@actual-app/api');
const log = require('./logger');

/**
 * Initializes and connects to Actual Budget API
 * @param {Object} config - Configuration object
 * @returns {Promise<void>}
 */
async function initializeAPI(config) {
  await api.init({
    dataDir: config.dataDir,
    serverURL: config.serverURL,
    password: config.password
  });

  await api.downloadBudget(config.syncID);
}

/**
 * Creates a new category group
 * @param {string} groupName - Name for the new group
 * @returns {Promise<Object>} - Created category group
 */
async function createNewCategoryGroup(groupName) {
  const group = await api.createCategoryGroup({
    name: groupName,
    is_income: false
  });
  log.info('category_group_created', { group: groupName });
  return group;
}

/**
 * Ensures all tags have corresponding categories in Actual Budget.
 * Missing categories are auto-assigned to the default category group
 * (configured via DEFAULT_CATEGORY_GROUP env var, defaults to "Usual Expenses").
 * @param {Array<string>} tags - Unique tags from statements
 * @param {Object} config - Configuration object
 * @returns {Promise<void>}
 */
async function ensureCategories(tags, config) {
  await initializeAPI(config);

  const categories = await api.getCategories();
  const categoryNames = categories.map(c => c.name.toLowerCase());

  const missingTags = tags.filter(tag => !categoryNames.includes(tag.toLowerCase()));

  if (missingTags.length === 0) {
    log.debug('categories_in_sync', { existing: categories.length, tags: tags.length });
    await api.shutdown();
    return;
  }

  log.info('categories_missing', { count: missingTags.length, tags: missingTags });

  const defaultGroupName = config.defaultCategoryGroup;
  const categoryGroups = await api.getCategoryGroups();

  // Find or create the default category group
  let groupToUse = categoryGroups.find(
    g => g.name.toLowerCase() === defaultGroupName.toLowerCase()
  );

  if (!groupToUse) {
    groupToUse = await createNewCategoryGroup(defaultGroupName);
  }

  for (const tag of missingTags) {
    await api.createCategory({
      name: tag,
      group_id: groupToUse.id,
      is_income: false
    });

    log.info('category_created', { category: tag, group: groupToUse.name });
  }

  await api.shutdown();
}

/**
 * Selects an account for import
 * @param {Array} accounts - Available accounts
 * @param {string} accountId - Pre-configured account ID (required)
 * @returns {Object} - Selected account
 */
function selectAccount(accounts, accountId) {
  if (!accountId) {
    throw new Error(
      'Account ID is required. Set ACCOUNT_ID env var or pass account-id via S3 metadata.'
    );
  }

  const account = accounts.find(acc => acc.id === accountId);
  if (!account) {
    const available = accounts.map(a => `  ${a.id} (${a.name})`).join('\n');
    throw new Error(
      `Account with ID ${accountId} not found. Available accounts:\n${available}`
    );
  }
  return account;
}

/**
 * Imports transactions to Actual Budget
 * @param {Array} transactions - Transformed transactions ready for import
 * @param {Object} config - Configuration object
 * @param {string} accountId - Account ID
 * @returns {Promise<void>}
 */
async function importToActualBudget(transactions, config, accountId) {
  await initializeAPI(config);

  const accounts = await api.getAccounts();
  const selectedAccount = selectAccount(accounts, accountId);

  log.info('import_start', {
    account: selectedAccount.name,
    accountId: selectedAccount.id,
    transactionCount: transactions.length
  });

  log.debug('actual_budget_calling_import_api', {
    accountId: selectedAccount.id,
    accountName: selectedAccount.name,
    transactionCount: transactions.length,
    sampleTransaction: transactions.length > 0 ? transactions[0] : null,
  });

  const importResult = await api.importTransactions(selectedAccount.id, transactions);

  log.info('import_complete', {
    account: selectedAccount.name,
    transactionCount: transactions.length,
    result: importResult,
  });

  await api.shutdown();
}

module.exports = {
  initializeAPI,
  ensureCategories,
  importToActualBudget,
  api
};
