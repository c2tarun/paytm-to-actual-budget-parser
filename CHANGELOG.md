# Changelog

## Security Update - Credential Management

### 🔒 Security Improvements

**CRITICAL:** Removed all hardcoded credentials from source code

#### Changes Made:

1. **Installed dotenv package**
   - Added `dotenv` for environment variable management
   - Loads credentials from `.env` file

2. **Updated config.js**
   - ❌ REMOVED: Hardcoded passwords
   - ❌ REMOVED: Hardcoded sync IDs
   - ✅ ADDED: `require('dotenv').config()`
   - ✅ NOW: All credentials from `process.env.*`

3. **Updated index.js**
   - ✅ ADDED: `require('dotenv').config()`
   - ✅ ADDED: Configuration validation
   - ✅ NOW: Loads from environment variables

4. **Created .env file**
   - ✅ Contains actual credentials (NOT in git)
   - ✅ Already in `.gitignore`
   - ✅ Secure from version control

5. **Updated .env.example**
   - ✅ Template with placeholder values
   - ✅ Safe to commit to version control
   - ✅ Instructions for users

6. **Created SECURITY.md**
   - Complete security guide
   - Setup instructions
   - Best practices
   - Troubleshooting

#### Migration for Users:

```bash
# 1. Create .env from template
cp .env.example .env

# 2. Edit .env with your credentials
nano .env

# 3. Run normally - credentials load automatically
node index.js
```

#### Before (Insecure):

```javascript
// config.js
const actualConfig = {
  password: 'your-password',      // ❌ Hardcoded!
  syncID: 'your-sync-id-here',    // ❌ In source code!
};
```

#### After (Secure):

```javascript
// config.js
require('dotenv').config();

module.exports = {
  password: process.env.ACTUAL_PASSWORD,  // ✅ From .env
  syncID: process.env.ACTUAL_SYNC_ID,     // ✅ Secure!
};
```

---

## Refactoring Update

### 📦 Modular Architecture

**Major refactoring for code quality and maintainability**

#### New File Structure:

```
├── config.js              # Configuration (no secrets!)
├── utils.js               # Pure utility functions
├── excelProcessor.js      # Excel/CSV processing
├── transactionMapper.js   # Data transformation
├── actualBudgetAPI.js     # API interactions
├── index.js               # Original (now uses .env)
├── index.refactored.js    # Refactored version
├── .env                   # Credentials (gitignored)
├── .env.example           # Template (safe to commit)
├── README.md              # Complete documentation
├── SECURITY.md            # Security guide
└── REFACTORING_SUMMARY.md # Technical details
```

#### Key Improvements:

1. **Security First**
   - No hardcoded credentials
   - Environment variable support
   - `.env` file approach

2. **Code Quality**
   - Modular architecture
   - Single Responsibility Principle
   - Pure, testable functions

3. **Documentation**
   - Comprehensive README
   - Security guide
   - JSDoc comments
   - Examples and troubleshooting

4. **Error Handling**
   - Input validation
   - Graceful failures
   - Clear error messages

5. **Maintainability**
   - Named constants
   - Small, focused functions
   - Easy to extend

---

## Version History

### v2.0.0 - Security & Refactoring (Current)
- 🔒 Removed all hardcoded credentials
- 📦 Modular architecture
- 📚 Complete documentation
- ✅ Environment variable support
- 🛡️ Security best practices

### v1.0.0 - Initial Implementation
- ✅ Excel to CSV conversion
- ✅ Tag cleaning
- ✅ Category mapping
- ✅ Transaction import
- ⚠️ Hardcoded credentials (fixed in v2.0.0)

---

## Breaking Changes

### v2.0.0

**Required Actions:**

1. **Install dotenv:**
   ```bash
   npm install dotenv
   ```

2. **Create .env file:**
   ```bash
   cp .env.example .env
   # Edit with your credentials
   ```

3. **Update any custom configs:**
   - Move credentials to `.env`
   - Remove hardcoded values

**What Changed:**

- `config.js` no longer has default credentials
- Requires `.env` file with credentials
- Both `index.js` and `index.refactored.js` updated

**Why:**

- Security: No credentials in source code
- Flexibility: Environment-specific configs
- Best Practice: Industry standard approach

---

## Migration Guide

### From v1.0.0 to v2.0.0:

```bash
# 1. Pull latest changes
git pull

# 2. Install new dependency
npm install dotenv

# 3. Create .env from your old config
cat > .env << EOF
ACTUAL_PASSWORD=your-old-password
ACTUAL_SYNC_ID=your-old-sync-id
ACCOUNT_ID=your-old-account-id
EOF

# 4. Test it works
node index.js

# 5. Verify .env is not tracked
git status  # Should not show .env
```

### Rollback (if needed):

```bash
# Checkout previous version
git checkout v1.0.0

# Or manually restore old config.js
# (Not recommended - security risk!)
```

---

## Security Audit

✅ **Passed Security Review:**

- No credentials in source code
- `.env` in `.gitignore`
- Environment variable approach
- Documentation includes security guide
- Validation on startup

**Verified:**

```bash
# No passwords in tracked files
git grep -i "diamond@007"  # No results ✓

# .env properly ignored
git check-ignore .env  # Returns .env ✓

# Environment loads correctly
node -e "require('dotenv').config(); console.log('OK')"  # OK ✓
```

---

## Future Enhancements

- [ ] Unit tests for utility functions
- [ ] Integration tests
- [ ] CLI argument support
- [ ] Batch import scheduling
- [ ] Transaction deduplication improvements
- [ ] Support for other bank formats
- [ ] Web UI for configuration