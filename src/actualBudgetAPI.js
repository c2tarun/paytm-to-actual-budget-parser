const api = require('@actual-app/api');

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
  console.log(`   Creating new category group: ${groupName}`);
  const group = await api.createCategoryGroup({
    name: groupName,
    is_income: false
  });
  console.log(`   ✓ Created group: ${groupName}`);
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
  console.log('\n4. Syncing categories with Actual Budget...');

  await initializeAPI(config);

  const categories = await api.getCategories();
  const categoryNames = categories.map(c => c.name.toLowerCase());

  console.log(`   Found ${categories.length} existing categories`);
  console.log(`   Found ${tags.length} unique tags in statements`);

  const missingTags = tags.filter(tag => !categoryNames.includes(tag.toLowerCase()));

  if (missingTags.length === 0) {
    console.log('   ✓ All tags already have matching categories');
    await api.shutdown();
    console.log('   ✓ Category sync complete\n');
    return;
  }

  console.log(`\n   Need to create ${missingTags.length} new categories: ${missingTags.join(', ')}`);

  const defaultGroupName = config.defaultCategoryGroup;
  const categoryGroups = await api.getCategoryGroups();

  // Find or create the default category group
  let groupToUse = categoryGroups.find(
    g => g.name.toLowerCase() === defaultGroupName.toLowerCase()
  );

  if (!groupToUse) {
    groupToUse = await createNewCategoryGroup(defaultGroupName);
  } else {
    console.log(`   Using existing category group: "${groupToUse.name}"`);
  }

  for (const tag of missingTags) {
    await api.createCategory({
      name: tag,
      group_id: groupToUse.id,
      is_income: false
    });

    console.log(`   ✓ Created category "${tag}" in group "${groupToUse.name}"`);
  }

  await api.shutdown();
  console.log('   ✓ Category sync complete\n');
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
  console.log(`   Using account: ${account.name}`);
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
  console.log('\n5. Importing transactions to Actual Budget...');

  await initializeAPI(config);

  const accounts = await api.getAccounts();
  const selectedAccount = selectAccount(accounts, accountId);

  console.log(`\n   Importing ${transactions.length} transactions...`);

  await api.importTransactions(selectedAccount.id, transactions);
  console.log(`   ✓ Imported ${transactions.length} transactions`);

  await api.shutdown();
  console.log('   ✓ Import complete\n');
}

module.exports = {
  initializeAPI,
  ensureCategories,
  importToActualBudget,
  api
};
