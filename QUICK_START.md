# Quick Start Guide

## 🚀 Get Running in 3 Steps

### Step 1: Install
```bash
npm install
```

### Step 2: Configure (⚠️ Important!)
```bash
# Copy the template
cp .env.example .env

# Edit with your credentials
nano .env
```

Required values in `.env`:
```env
ACTUAL_PASSWORD=your-password-here
ACTUAL_SYNC_ID=your-sync-id-here
```

**Where to find Sync ID:**
1. Open Actual Budget
2. Settings → Show advanced settings
3. Copy "Sync ID"

### Step 3: Run
```bash
# Put your .xlsx files in statements/ folder
# Then run:
node index.js
```

## ✅ That's it!

The script will:
1. Convert Excel to CSV
2. Clean tags (remove # symbol, preserve emojis)
3. Sync categories
4. Import transactions

You'll see minimal output on success:
```
Found 1 file(s)

✓ Import completed successfully
  Files: 1
  Transactions: 47
  Categories: 14
```

Detailed logs only appear if errors occur.

## 📚 More Info

- **Security:** See [SECURITY.md](SECURITY.md)
- **Full Guide:** See [README.md](README.md)
- **Refactored Version:** Use `index.refactored.js`

## ⚠️ Security Note

**NEVER commit your `.env` file!**

It's already in `.gitignore` to protect you.

## 🔍 Verify Setup

```bash
# Check everything is configured
node -e "require('dotenv').config(); console.log('Password:', process.env.ACTUAL_PASSWORD ? '✓' : '✗'); console.log('Sync ID:', process.env.ACTUAL_SYNC_ID ? '✓' : '✗');"
```

Expected output:
```
Password: ✓
Sync ID: ✓
```

## 💡 Tips

1. **First run:** Create categories interactively
2. **Auto-import:** Set `ACCOUNT_ID` in `.env`
3. **Batch processing:** Put multiple .xlsx in `statements/`
4. **Check output:** See `processed/*.csv`

## 🐛 Issues?

- Missing config: Check `.env` file exists
- Categories not matching: Verify emoji tags
- Import fails: Check password and sync ID

See [README.md](README.md) for troubleshooting.