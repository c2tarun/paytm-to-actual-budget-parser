const XLSX = require('xlsx');
const path = require('path');

const excelPath = path.join(__dirname, 'stmt.xlsx');

console.log('Reading Excel file:', excelPath);

const workbook = XLSX.readFile(excelPath);

console.log('\n=== Excel File Structure ===');
console.log('Sheet Names:', workbook.SheetNames);
console.log('\n');

workbook.SheetNames.forEach((sheetName, index) => {
  console.log(`\n--- Sheet ${index + 1}: "${sheetName}" ---`);
  const worksheet = workbook.Sheets[sheetName];

  // Get the range of the sheet
  const range = XLSX.utils.decode_range(worksheet['!ref']);
  console.log(`Range: ${worksheet['!ref']}`);
  console.log(`Rows: ${range.e.r + 1}, Columns: ${range.e.c + 1}`);

  // Convert to JSON to show first few rows
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  console.log('\nFirst 5 rows:');
  jsonData.slice(0, 5).forEach((row, i) => {
    console.log(`Row ${i}:`, row);
  });

  // Show headers if available
  if (jsonData.length > 0) {
    console.log('\nHeaders:', jsonData[0]);
  }
});
