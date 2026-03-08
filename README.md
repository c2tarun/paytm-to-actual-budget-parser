# Paytm to Actual Budget Importer

Automatically import Paytm UPI transaction statements into Actual Budget with category mapping.

## Features

- 📊 Converts Paytm Excel statements to CSV
- 🏷️ Automatic category mapping from Paytm tags
- ✨ Cleans emoji tags to match Actual Budget categories
- 🔄 Creates missing categories with interactive group selection
- 🚫 Prevents duplicate imports using UPI Reference Numbers
- 📁 Batch processing of multiple statement files
- 🤫 Minimal logging on success, verbose logs only on errors

## Project Structure

```
.
├── config.js              # Configuration and constants
├── utils.js               # Utility functions (date, amount conversion, etc.)
├── excelProcessor.js      # Excel to CSV conversion and tag cleaning
├── transactionMapper.js   # Transform Paytm format to Actual Budget format
├── actualBudgetAPI.js     # Actual Budget API interactions
├── index.js               # Original implementation
├── index.refactored.js    # Refactored main entry point (RECOMMENDED)
├── test-api.js            # API testing script
├── statements/            # Place your .xlsx files here
└── processed/             # Processed CSV files output here
```

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **⚠️ Configure Credentials (IMPORTANT - See [SECURITY.md](SECURITY.md)):**

   **NEVER commit credentials to version control!**

   Create a `.env` file from the template:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your actual credentials:
   ```env
   ACTUAL_PASSWORD=your-actual-password
   ACTUAL_SYNC_ID=your-sync-id
   ACCOUNT_ID=your-account-id  # Optional
   ```

   ✅ The `.env` file is already in `.gitignore` and will NOT be committed
   ✅ All credentials are loaded from environment variables
   ✅ No hardcoded passwords in source code

3. **Find your Sync ID:**
   - Open Actual Budget
   - Go to Settings > Show advanced settings
   - Copy the "Sync ID"

## Usage

### Using Refactored Version (Recommended)

1. Place your Paytm .xlsx statement files in the `statements/` folder

2. Run the importer:
   ```bash
   node index.refactored.js
   ```

3. Follow the interactive prompts:
   - Select category groups for any new categories
   - Select the account to import into (if not pre-configured)

### Using Original Version

```bash
node index.js
```

**Output:**
The script displays minimal information on success:
```
Found 1 file(s)

✓ Import completed successfully
  Files: 1
  Transactions: 47
  Categories: 14
```

On error, all detailed logs are displayed for troubleshooting.

## How It Works

### 1. Excel Processing
- Reads "Passbook Payment History" sheet from Paytm .xlsx files
- Converts to CSV format
- Extracts and cleans tags (removes `#`, preserves emojis)

### 2. Category Sync
- Compares tags with existing Actual Budget categories
- Prompts you to assign missing categories to category groups
- Creates new categories as needed

### 3. Transaction Import
- Transforms Paytm transaction format to Actual Budget format
- Maps cleaned tags to category IDs
- Imports with UPI Ref No. as `imported_id` to prevent duplicates

## Tag Cleaning Example

Paytm tags are automatically cleaned:
- `#🛍 Shopping` → `🛍 Shopping`
- `#🥘 Food` → `🥘 Food`
- `#Property Tax` → `Property Tax`

These cleaned tags match your Actual Budget category names.

## Transaction Mapping

| Paytm Field | Actual Budget Field |
|-------------|---------------------|
| Date | date (YYYY-MM-DD) |
| Amount | amount (in cents) |
| Transaction Details | payee_name |
| Other Transaction Details | notes |
| UPI Ref No. | imported_id |
| Tags | category (ID lookup) |

## Code Quality Improvements (Refactored Version)

✅ **Separation of Concerns:**
- Configuration isolated in `config.js`
- Utilities in dedicated modules
- Single Responsibility Principle followed

✅ **Better Error Handling:**
- Try-catch blocks with meaningful errors
- Input validation
- Graceful failures per file

✅ **Maintainability:**
- JSDoc comments on all functions
- Named constants instead of magic values
- Small, focused functions

✅ **Testability:**
- Pure functions for transformations
- Minimal side effects
- Easy to unit test

✅ **Security:**
- Passwords not hardcoded
- Environment variable support
- `.env` in `.gitignore`

## Testing

Test the API connection:
```bash
node test-api.js
```

## Troubleshooting

**No transactions imported:**
- Check that categories match (case-insensitive comparison)
- Verify UPI Ref No. isn't duplicate
- Check date format is valid

**Categories not mapping:**
- Ensure tags are cleaned properly
- Check category names match exactly (including emojis)
- Run with a single transaction to debug

**Permission errors:**
- Verify Actual Budget server is running
- Check password and sync ID are correct
- Ensure data directory is writable

## Contributing

The refactored version (`index.refactored.js`) follows best practices:
- Keep functions small and focused
- Add JSDoc comments
- Extract constants to config
- Handle errors gracefully
- Write pure functions where possible

## License

ISC
