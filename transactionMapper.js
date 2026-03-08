const { amountToCents, formatDate } = require('./utils');
const config = require('./config');

/**
 * Transforms a Paytm transaction record to Actual Budget format
 * @param {Object} txn - Paytm transaction record
 * @param {Object} categoryMap - Map of category names to IDs
 * @returns {Object} - Transaction in Actual Budget format
 */
function transformTransaction(txn, categoryMap) {
  // Get category ID from tag
  const firstTag = (txn[config.columns.tags] || '').trim();
  const categoryId = firstTag && categoryMap[firstTag.toLowerCase()]
    ? categoryMap[firstTag.toLowerCase()]
    : null;

  return {
    date: formatDate(txn[config.columns.date]),
    amount: amountToCents(txn[config.columns.amount]),
    payee_name: txn[config.columns.transactionDetails],
    notes: txn[config.columns.otherDetails] || '',
    imported_id: txn[config.columns.upiRefNo],
    category: categoryId,
  };
}

/**
 * Transforms multiple transactions
 * @param {Array} transactions - Array of Paytm transaction records
 * @param {Object} categoryMap - Map of category names to IDs
 * @returns {Array} - Array of transformed transactions
 */
function transformTransactions(transactions, categoryMap) {
  return transactions.map(txn => transformTransaction(txn, categoryMap));
}

module.exports = {
  transformTransaction,
  transformTransactions
};