# Git History Cleanup Plan

## ⚠️ CRITICAL SECURITY ISSUE DETECTED

Your credentials were committed to git history in the following commits:

### Affected Commits:
- **Commit:** `33fec3d` - "Everything seems to be working"
  - File: `index.js` - Contains hardcoded password and sync ID
  - File: `test-api.js` - Contains hardcoded password, sync ID, and account ID

### Credentials Found:
- Password: `Diamond@007`
- Sync ID: `5e713f65-3939-45d9-b0f3-186d151f8d5c`
- Account ID: `12574ba5-c4f2-46a8-b7a9-1b3bb43c965c`

## Impact Assessment

1. **Current State:**
   - ✅ Credentials removed from current working files
   - ✅ All new commits use environment variables
   - ❌ Credentials still in git history (commits 33fec3d and earlier)

2. **Risk Level:**
   - 🔴 HIGH if repository is or will be public
   - 🟡 MEDIUM if repository is private but shared
   - 🟢 LOW if repository is only local

## Cleanup Options

### Option 1: Complete History Rewrite (Recommended if pushing to public repo)

This will rewrite ALL commits to remove the credentials completely.

**Steps:**
```bash
# 1. Create a backup first
cp -r . ../paytm_script_backup

# 2. Use git filter-repo (preferred) or filter-branch
git filter-branch --force --index-filter \
  'git ls-files -s | \
   sed "s/Diamond@007/YOUR_PASSWORD_HERE/g" | \
   sed "s/5e713f65-3939-45d9-b0f3-186d151f8d5c/YOUR_SYNC_ID_HERE/g" | \
   sed "s/12574ba5-c4f2-46a8-b7a9-1b3bb43c965c/YOUR_ACCOUNT_ID_HERE/g" | \
   GIT_INDEX_FILE=$GIT_INDEX_FILE.new git update-index --index-info && \
   mv "$GIT_INDEX_FILE.new" "$GIT_INDEX_FILE"' HEAD

# 3. Clean up refs
git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d

# 4. Force garbage collection
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Verify credentials are gone
git log --all -p | grep -i "Diamond@007" || echo "✓ Password removed"
git log --all -p | grep -i "5e713f65" || echo "✓ Sync ID removed"
```

**Then, if already pushed to remote:**
```bash
# WARNING: This rewrites history for everyone!
git push origin --force --all
git push origin --force --tags
```

### Option 2: BFG Repo-Cleaner (Easier and Faster)

**Install BFG:**
```bash
# On macOS
brew install bfg

# Or download from https://rtyley.github.io/bfg-repo-cleaner/
```

**Create credentials file:**
```bash
cat > credentials.txt << 'EOF'
Diamond@007
5e713f65-3939-45d9-b0f3-186d151f8d5c
12574ba5-c4f2-46a8-b7a9-1b3bb43c965c
EOF
```

**Run BFG:**
```bash
# Backup first
cp -r . ../paytm_script_backup

# Replace credentials
bfg --replace-text credentials.txt .

# Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Verify
git log --all -p | grep -i "Diamond@007" || echo "✓ Cleaned"

# Force push (if needed)
git push origin --force --all
```

### Option 3: Start Fresh (Simplest)

If you haven't shared the repository yet:

```bash
# 1. Delete .git directory
rm -rf .git

# 2. Re-initialize
git init

# 3. Make new initial commit (credentials already removed)
git add .
git commit -m "Initial commit with secure credential management"
```

## Post-Cleanup Actions

### 1. Rotate All Compromised Credentials ⚠️

**CRITICAL:** Even after removing from git history, these credentials are compromised if the repository was ever public or shared.

- [ ] Change your Actual Budget password
- [ ] Regenerate sync ID (if possible)
- [ ] Update `.env` file with new credentials
- [ ] Consider reviewing Actual Budget access logs

### 2. Verify Cleanup

```bash
# Search entire history
git log --all --full-history -p | grep -i "Diamond@007"
git log --all --full-history -p | grep -i "5e713f65"

# Should return nothing
```

### 3. Prevent Future Leaks

- [ ] Verify `.gitignore` includes `.env`
- [ ] Add git pre-commit hook to scan for credentials
- [ ] Consider using git-secrets or similar tools

## Pre-Commit Hook (Optional)

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Check for potential credential leaks
if git diff --cached | grep -E '(password|syncID|ACTUAL_PASSWORD|ACTUAL_SYNC_ID).*=.*["\x27][^"\x27]+["\x27]'; then
  echo "ERROR: Potential credential found in commit!"
  echo "Please use environment variables instead."
  exit 1
fi

exit 0
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Recommended Action Plan

For your specific situation:

1. **Immediate:** Determine if repository has been pushed anywhere
2. **High Priority:** Choose cleanup option based on repository status
3. **Critical:** Rotate credentials in Actual Budget
4. **Verify:** Run verification commands
5. **Prevent:** Set up pre-commit hooks

## Need Help?

If unsure which option to choose:
- Repository only local → Option 3 (Start Fresh)
- Repository private, small team → Option 1 or 2
- Repository public or large team → Option 2 (BFG) + Credential Rotation

---

**Created:** 2026-03-08
**Status:** ACTION REQUIRED
**Priority:** HIGH
