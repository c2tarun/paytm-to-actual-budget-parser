const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

function convertExcelToCSV(excelPath, sheetName, outputPath) {
  console.log(`Reading Excel file: ${excelPath}`);

  const workbook = XLSX.readFile(excelPath);

  if (!workbook.SheetNames.includes(sheetName)) {
    console.error(`Sheet "${sheetName}" not found!`);
    console.log('Available sheets:', workbook.SheetNames);
    process.exit(1);
  }

  const worksheet = workbook.Sheets[sheetName];

  // Convert to CSV
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  // Write to file
  fs.writeFileSync(outputPath, csv, 'utf8');

  console.log(`✓ Converted sheet "${sheetName}" to ${outputPath}`);

  // Show some stats
  const lines = csv.split('\n').filter(line => line.trim());
  console.log(`  Total rows: ${lines.length} (including header)`);
  console.log(`  Transaction rows: ${lines.length - 1}`);
}

// Convert the Passbook Payment History sheet
const excelPath = path.join(__dirname, 'stmt.xlsx');
const csvPath = path.join(__dirname, 'transactions.csv');

convertExcelToCSV(excelPath, 'Passbook Payment History', csvPath);

console.log('\nDone! You can now use transactions.csv for importing to Actual Budget.');
