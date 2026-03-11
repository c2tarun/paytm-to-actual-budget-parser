# iOS Shortcut for Paytm Statement Upload

## Quick Import Link Method

### Step 1: Download the Shortcut Template

I'll create a shareable shortcut link for you. For now, follow the manual setup below.

## Manual Setup Instructions

### Create the Shortcut

1. **Open Shortcuts app** on iPhone/iPad
2. Tap **"+"** to create new shortcut
3. **Rename** to "Upload Paytm Statement"

### Add Actions (in this exact order):

#### 1. Receive Files from Share Sheet
- Search: **"Receive"**
- Select: **"Receive input from Share Sheet"**
- Change type to: **Files**

#### 2. Set Function URL Variable
- Search: **"Text"**
- Paste your Lambda URL: `https://YOUR_FUNCTION_URL.lambda-url.us-west-2.on.aws/`
- Long-press the text → **"Set Variable"** → Name it `URL`

#### 3. Set Token Variable
- Add another **"Text"** action
- Type: `205f611fef15` (your secret token)
- Long-press → **"Set Variable"** → Name it `Token`

#### 4. Upload File
- Search: **"Get Contents of URL"**
- Configure:
  - **URL**: Select variable `URL`
  - **Method**: Change to `POST`
  - Tap **"Show More"**
  - **Request Body**: Change to `Form`
  - **Add new field**:
    - Key: `file`
    - Type: File
    - Value: Tap and select **"Shortcut Input"** (the received file)
  - **Add new field**:
    - Key: `token`
    - Type: Text
    - Value: Select variable `Token`

#### 5. Show Result
- Search: **"Show Result"**
- Input: Select **"Contents of URL"** (from previous action)
- This shows the upload response

#### 6. Optional: Show Notification
- Search: **"Show Notification"**
- Text: `File uploaded successfully!`
- Add this after checking if upload succeeded

### Enable Share Sheet

1. Tap shortcut settings (•••)
2. Toggle **"Show in Share Sheet"** ON
3. Under **"Accepted Types"**: Ensure **"Files"** is checked
4. Optionally add: `public.spreadsheet` for Excel files only

### Customize Appearance

1. Tap the shortcut name
2. Tap the icon to change color/symbol
3. Choose blue color and cloud/upload icon (☁️ or 📤)

---

## Usage

### Upload a file:

1. Open **Files** app
2. Find your Paytm statement `.xlsx` file
3. Long-press the file → **Share**
4. Scroll and select **"Upload Paytm Statement"**
5. Wait for confirmation
6. Check response for success message

### Verify Upload

After upload, you can verify in S3:
```bash
aws s3 ls s3://YOUR-BUCKET-NAME/incoming/ --region us-west-2
```

---

## Advanced: Add Error Handling

To make the shortcut more robust:

### Add after "Get Contents of URL":

1. **"Get Dictionary from Input"**
   - Input: Contents of URL

2. **"Get Dictionary Value"**
   - Key: `success`
   - From: Dictionary

3. **"If"**
   - Condition: If `Dictionary Value` equals `true`
   - **Then**: Show notification "✅ Upload successful!"
   - **Otherwise**:
     - Get Dictionary Value for key `error`
     - Show notification "❌ Upload failed: [error]"

---

## Shortcut Configuration Summary

```
┌─────────────────────────────────────┐
│ Receive [Files] from Share Sheet    │
├─────────────────────────────────────┤
│ Text: [Your Function URL]           │
│   → Set Variable: URL               │
├─────────────────────────────────────┤
│ Text: [Your Token]                  │
│   → Set Variable: Token             │
├─────────────────────────────────────┤
│ Get Contents of URL                 │
│   URL: [URL variable]               │
│   Method: POST                      │
│   Form Data:                        │
│     - file: [Shortcut Input]        │
│     - token: [Token variable]       │
├─────────────────────────────────────┤
│ Show Result: [Contents of URL]      │
└─────────────────────────────────────┘
```

---

## Troubleshooting

### "Shortcut could not be run"
- Check that the Function URL is correct and complete
- Ensure token matches exactly (no spaces)

### "Invalid or missing token"
- Verify token in shortcut matches `205f611fef15`
- Check there are no extra spaces or quotes

### Upload takes too long
- Lambda timeout is 30 seconds
- Files larger than 5MB will be rejected
- Check your internet connection

### File not appearing in S3
- Wait a few seconds and refresh
- Check CloudWatch logs for errors:
  ```bash
  sam logs --stack-name paytm-statement-uploader --tail
  ```

---

## Security Note

⚠️ **Important**: The secret token is stored in plain text in your shortcut. Anyone with access to your phone can see it by opening the shortcut.

**To improve security**:
1. Use a strong, unique token
2. Enable Face ID/Touch ID on your iPhone
3. Consider rotating the token periodically
4. Don't share the shortcut with others (it contains your token)

---

## Alternative: Shortcut with Token Prompt

If you prefer not to store the token in the shortcut:

1. Replace "Text" action for token with **"Ask for Input"**
2. Prompt: "Enter upload token"
3. Input type: Text
4. Set this as the Token variable

This way, you'll be prompted for the token each time (more secure, but less convenient).
