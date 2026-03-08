const api = require('@actual-app/api');

// Load environment variables from .env file
require('dotenv').config();

async function main() {
  // Load configuration from environment variables
  const serverURL = process.env.ACTUAL_SERVER_URL || 'http://localhost:5006';
  const password = process.env.ACTUAL_PASSWORD;
  const syncID = process.env.ACTUAL_SYNC_ID;
  const testAccId = process.env.ACCOUNT_ID || '12574ba5-c4f2-46a8-b7a9-1b3bb43c965c';
  const testCategoryId = 'your-category-id-here'; // Replace with actual category ID

  if (!password || !syncID) {
    console.error('Error: Missing ACTUAL_PASSWORD or ACTUAL_SYNC_ID in .env file');
    process.exit(1);
  }

  await api.init({
    dataDir: '../actual-data',
    serverURL: serverURL,
    password: password
  });

  await api.downloadBudget(syncID);

  // Test your code here
  const accounts = await api.getAccounts();
  console.log('Accounts:', accounts);

  // Add a dummy transaction
  const dummyTransaction = {
    account: testAccId,
    date: '2026-03-09',
    amount: -5000, // Amount in cents (negative for expense, positive for income)
    payee_name: 'Test Merchant 2',
    notes: 'Dummy transaction for testing',
    imported_id: 'TEST-002',
    category: testCategoryId,
  };

  console.log('\nAdding dummy transaction:', dummyTransaction);
  const result = await api.importTransactions(testAccId, [dummyTransaction]);
  console.log('Transaction added:', result);

  let categories = await api.getCategories();
  console.log("============ CATEGORIES ==============");

  let shopping = categories.filter(c => c.name === "🛍 Shopping");
  console.log(shopping);

  await api.shutdown();
}

main().catch(console.error);
