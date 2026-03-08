const fs = require('fs');

/**
 * Removes the # symbol from a tag and trims whitespace
 * Preserves emojis and other characters
 * @param {string} tag - The tag to clean
 * @returns {string} - Cleaned tag
 */
function cleanTag(tag) {
  if (!tag) return '';
  return tag.replace(/#/g, '').trim();
}

/**
 * Converts amount string to cents (integer)
 * Handles comma-separated numbers and decimal points
 * @param {string} amountStr - Amount as string (e.g., "-7,457.00")
 * @returns {number} - Amount in cents
 */
function amountToCents(amountStr) {
  const cleanedAmount = amountStr.replace(/,/g, '');
  const amountFloat = parseFloat(cleanedAmount);

  if (isNaN(amountFloat)) {
    throw new Error(`Invalid amount: ${amountStr}`);
  }

  return Math.round(amountFloat * 100);
}

/**
 * Converts date from DD/MM/YYYY to YYYY-MM-DD format
 * @param {string} dateStr - Date in DD/MM/YYYY format
 * @returns {string} - Date in YYYY-MM-DD format
 */
function formatDate(dateStr) {
  const dateParts = dateStr.split('/');

  if (dateParts.length !== 3) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }

  const [day, month, year] = dateParts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/**
 * Ensures a directory exists, creates it if it doesn't
 * @param {string} dirPath - Path to directory
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Creates a category map from category name (lowercase) to category ID
 * @param {Array} categories - Array of category objects from Actual Budget
 * @returns {Object} - Map of lowercase category names to IDs
 */
function createCategoryMap(categories) {
  const categoryMap = {};
  categories.forEach(cat => {
    categoryMap[cat.name.toLowerCase()] = cat.id;
  });
  return categoryMap;
}

module.exports = {
  cleanTag,
  amountToCents,
  formatDate,
  ensureDirectoryExists,
  createCategoryMap
};