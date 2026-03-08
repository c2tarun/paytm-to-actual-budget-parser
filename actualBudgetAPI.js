const api = require('@actual-app/api');
const readline = require('readline-sync');

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
 * Displays category groups and prompts user to select one
 * @param {Array} categoryGroups - Available category groups
 * @param {string} tagName - Tag name for which we're selecting a group
 * @returns {Object} - Selected category group
 */
function selectCategoryGroup(categoryGroups, tagName) {
  console.log(`\n   Creating category for tag: "${tagName}"`);
  console.log('   Available category groups:');

  categoryGroups.forEach((group, index) => {
    console.log(`   ${index + 1}. ${group.name}`);
  });
  console.log(`   ${categoryGroups.length + 1}. Create a new group`);

  const choice = readline.questionInt(`\n   Select a category group for "${tagName}" (enter number): `);

  if (choice < 1 || choice > categoryGroups.length + 1) {
    throw new Error('Invalid selection');
  }

  return {
    choice,
    isNewGroup: choice === categoryGroups.length + 1,
    selectedGroup: choice <= categoryGroups.length ? categoryGroups[choice - 1] : null
  };
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
 * Ensures all tags have corresponding categories in Actual Budget
 * Creates missing categories with user-selected groups
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

  let categoryGroups = await api.getCategoryGroups();

  if (categoryGroups.length === 0) {
    throw new Error('No category groups found in Actual Budget');
  }

  for (const tag of missingTags) {
    const { isNewGroup, selectedGroup } = selectCategoryGroup(categoryGroups, tag);

    let groupToUse;

    if (isNewGroup) {
      const groupName = readline.question('   Enter new group name: ');
      groupToUse = await createNewCategoryGroup(groupName);
      categoryGroups = await api.getCategoryGroups(); // Refresh list
    } else {
      groupToUse = selectedGroup;
    }

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
 * @param {string|undefined} accountId - Optional pre-configured account ID
 * @returns {Object} - Selected account
 */
function selectAccount(accounts, accountId) {
  if (accountId) {
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) {
      throw new Error(`Account with ID ${accountId} not found`);
    }
    console.log(`   Using account: ${account.name}`);
    return account;
  }

  console.log('\n   Available accounts:');
  accounts.forEach((account, index) => {
    console.log(`   ${index + 1}. ${account.name} (${account.type || 'N/A'})`);
  });

  const accountChoice = readline.questionInt('\n   Select account for import (enter number): ');

  if (accountChoice < 1 || accountChoice > accounts.length) {
    throw new Error('Invalid account selection');
  }

  const account = accounts[accountChoice - 1];
  console.log(`   Using account: ${account.name}`);
  return account;
}

/**
 * Imports transactions to Actual Budget
 * @param {Array} transactions - Transformed transactions ready for import
 * @param {Object} config - Configuration object
 * @param {string|undefined} accountId - Optional account ID
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