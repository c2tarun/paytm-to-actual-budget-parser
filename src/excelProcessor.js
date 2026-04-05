const XLSX = require('xlsx');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { cleanTag } = require('./utils');
const config = require('./config');

/**
 * Extracts and cleans tags from a record
 * @param {string} tagsColumn - Raw tags string from CSV
 * @returns {Array<string>} - Array of cleaned tags
 */
function extractTags(tagsColumn) {
  if (!tagsColumn) return [];

  return tagsColumn
    .split('#')
    .filter(t => t.trim())
    .map(cleanTag)
    .filter(t => t);
}

/**
 * Processes CSV content: cleans tags and removes unnecessary columns
 * @param {string} csvContent - Raw CSV content
 * @returns {Object} - Object containing processed CSV, unique tags, and records
 */
function processCSV(csvContent) {
  const uniqueTags = new Set();

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true
  });

  const processedRecords = records.map(record => {
    // Extract and clean tags
    const tagsColumn = record[config.columns.tags] || '';
    const tags = extractTags(tagsColumn);

    // Collect unique tags
    tags.forEach(tag => uniqueTags.add(tag));

    // Update record with cleaned tags
    record[config.columns.tags] = tags.join(' ');

    // Remove unnecessary columns
    delete record[config.columns.remarks];

    return record;
  });

  const outputCSV = stringify(processedRecords, {
    header: true
  });

  return {
    csv: outputCSV,
    tags: Array.from(uniqueTags),
    records: processedRecords
  };
}

/**
 * Reads an Excel file and converts specified sheet to CSV
 * @param {string} excelPath - Path to Excel file
 * @returns {string} - CSV content
 * @throws {Error} - If sheet is not found
 */
function excelToCSV(excelPath) {
  const workbook = XLSX.readFile(excelPath);

  if (!workbook.SheetNames.includes(config.sheetName)) {
    throw new Error(`Sheet "${config.sheetName}" not found in ${excelPath}`);
  }

  const worksheet = workbook.Sheets[config.sheetName];
  return XLSX.utils.sheet_to_csv(worksheet);
}

module.exports = {
  processCSV,
  excelToCSV,
  extractTags
};