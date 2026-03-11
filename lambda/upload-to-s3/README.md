# Paytm Statement Uploader - AWS Lambda

This is a serverless file upload service built with AWS SAM (Serverless Application Model). It provides a secure HTTP endpoint for uploading Paytm statement Excel files to S3.

## Architecture

```
Client (Browser/Mobile/Script)
    |
    | HTTP POST (multipart/form-data)
    | - file: Excel file
    | - token: Secret authentication token
    |
    v
Lambda Function URL (NO_AUTH)
    |
    | Validates token
    | Validates file type (.xlsx only)
    | Sanitizes filename
    |
    v
S3 Bucket (paytm-statements-*)
    └─ incoming/
        └─ statement_timestamp.xlsx
```

## Prerequisites

Before deploying, ensure you have:

1. **AWS Account** - Active AWS account with appropriate permissions
2. **AWS CLI** - Installed and configured with your credentials
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and default region
   ```
3. **AWS SAM CLI** - Installed on your machine
   ```bash
   # macOS
   brew install aws-sam-cli

   # Or download from: https://aws.amazon.com/serverless/sam/
   ```
4. **Node.js 20.x** - For local development and testing

Verify installations:
```bash
aws --version
sam --version
node --version
```

## Deployment Steps

### 1. Install Lambda Dependencies

Navigate to the Lambda source directory and install Node.js dependencies:

```bash
cd src
npm install
cd ..
```

### 2. Configure Deployment Parameters

Edit [samconfig.toml](samconfig.toml) to set your preferences:

```toml
[default.deploy.parameters]
stack_name = "paytm-statement-uploader"
region = "us-west-2"  # Oregon region
parameter_overrides = [
    "UploadSecretToken=your-secure-token-here"  # Change this!
]
```

**Important:**
- **UploadSecretToken**: Create a strong, random token (minimum 20 characters). This is your upload password!
- **S3 Bucket**: A random bucket name will be auto-generated based on the stack name

Generate a secure token:
```bash
# macOS/Linux
openssl rand -base64 32

# Or use any password generator
```

### 3. Build the SAM Application

```bash
sam build
```

This command:
- Installs dependencies defined in package.json
- Packages the Lambda function code
- Prepares it for deployment

### 4. Deploy to AWS

**First-time deployment (guided):**
```bash
sam deploy --guided
```

This will prompt you for:
- Stack name (default: paytm-statement-uploader)
- AWS Region (default: us-west-2)
- Upload Secret Token (must be at least 20 characters)
- Confirm changes before deploy (Y/n)
- Allow SAM CLI IAM role creation (Y)
- Save arguments to configuration file (Y)

**Subsequent deployments:**
```bash
sam deploy
```

### 5. Get Your Function URL

After successful deployment, SAM will output:

```
Outputs
-----------------------------------------------------------------------
Key                 FunctionUrl
Description         URL for the Lambda Function
Value               https://abc123xyz.lambda-url.us-west-2.on.aws/

Key                 BucketName
Description         S3 Bucket name
Value               paytm-statement-uploader-paytmstatementsbucket-abc123xyz

Key                 UploadInstructions
Description         How to upload a file
Value               curl -X POST https://abc123xyz... \
                      -F "file=@/path/to/statement.xlsx" \
                      -F "token=YOUR_SECRET_TOKEN"
-----------------------------------------------------------------------
```

**Save this Function URL!** You'll need it to upload files.

## Testing the Upload

### Option 1: Using the Test Script

1. **Install test dependencies:**
   ```bash
   npm install form-data
   ```

2. **Create a test file:**
   ```bash
   mkdir test-files
   # Copy a sample .xlsx file to test-files/sample.xlsx
   ```

3. **Run the test script:**
   ```bash
   node test-upload.js \
     ./test-files/sample.xlsx \
     https://YOUR-FUNCTION-URL.lambda-url.ap-south-2.on.aws/ \
     YOUR_SECRET_TOKEN
   ```

### Option 2: Using curl

```bash
curl -X POST https://YOUR-FUNCTION-URL.lambda-url.ap-south-2.on.aws/ \
  -F "file=@/path/to/statement.xlsx" \
  -F "token=YOUR_SECRET_TOKEN"
```

### Expected Response

**Success (200):**
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "filename": "statement.xlsx",
  "s3Key": "incoming/statement_1234567890.xlsx",
  "size": 45678,
  "bucket": "paytm-statements-your-suffix"
}
```

**Invalid Token (401):**
```json
{
  "success": false,
  "error": "Invalid or missing token"
}
```

**Invalid File Type (400):**
```json
{
  "success": false,
  "error": "Invalid file type. Only .xlsx files are allowed."
}
```

## Verify File in S3

Check if the file was uploaded:

```bash
# Replace BUCKET_NAME with the value from deployment outputs
aws s3 ls s3://BUCKET_NAME/incoming/ --region us-west-2
```

Or use the AWS Console:
1. Go to S3 service
2. Find bucket starting with `paytm-statement-uploader-paytmstatementsbucket-`
3. Navigate to `incoming/` folder
4. You should see your uploaded file with timestamp

## Security Features

1. **Token-based Authentication**
   - Validates secret token using constant-time comparison
   - Prevents timing attacks
   - Token stored as environment variable in Lambda

2. **File Validation**
   - Only accepts `.xlsx` files
   - Checks file extension and MIME type
   - Maximum file size: 5 MB

3. **Filename Sanitization**
   - Removes path traversal attempts
   - Sanitizes special characters
   - Adds timestamp to prevent collisions

4. **S3 Security**
   - Bucket is private (Block Public Access enabled)
   - Lambda has minimal IAM permissions (PutObject only)
   - Auto-generated bucket name prevents conflicts

5. **Function URL**
   - NO_AUTH mode for simplicity
   - CORS enabled for browser uploads
   - Token provides access control

## Updating the Deployment

### Change Configuration

To update the secret token:

1. Edit `samconfig.toml` and update `UploadSecretToken`
2. Run `sam deploy`

### Update Lambda Code

After modifying `src/index.js`:

```bash
sam build
sam deploy
```

### Update Infrastructure

After modifying `template.yaml`:

```bash
sam build
sam deploy
```

## Viewing Logs

Monitor Lambda execution logs:

```bash
sam logs --stack-name paytm-statement-uploader --tail
```

Or via AWS Console:
1. Go to CloudWatch
2. Navigate to Log Groups
3. Find `/aws/lambda/paytm-statement-uploader`

## Cleanup / Deletion

To delete all AWS resources:

```bash
sam delete

# Or
aws cloudformation delete-stack --stack-name paytm-statement-uploader --region us-west-2
```

**Warning:** This will:
- Delete the Lambda function
- Delete the S3 bucket and **all uploaded files**
- Remove all CloudWatch logs

## Troubleshooting

### Deployment Fails

**Error: "Access Denied"**
- Solution: Ensure AWS CLI is configured with valid credentials
- Run `aws sts get-caller-identity` to verify

### Upload Fails

**401 Invalid Token**
- Check that token matches exactly (no extra spaces)
- Verify token in Lambda environment variables (AWS Console → Lambda → Configuration → Environment variables)

**400 Invalid File Type**
- Only `.xlsx` files are accepted
- Check file extension

**500 Internal Server Error**
- Check CloudWatch Logs for detailed error
- Run `sam logs --stack-name paytm-statement-uploader --tail`

### File Not in S3

**Check the incoming/ prefix:**
```bash
# Get bucket name from CloudFormation outputs first
aws cloudformation describe-stacks --stack-name paytm-statement-uploader --region us-west-2 --query 'Stacks[0].Outputs[?OutputKey==`BucketName`].OutputValue' --output text

# Then list files
aws s3 ls s3://BUCKET_NAME/incoming/ --region us-west-2
```

**Verify Lambda has S3 permissions:**
- Go to IAM → Roles
- Find the Lambda execution role
- Check it has S3 PutObject permission

## Cost Estimation

### Typical Monthly Cost (Light Usage)

- **Lambda**: $0.00 - $0.20
  - Free tier: 1M requests/month, 400,000 GB-seconds
  - Each upload = ~1 second execution

- **S3 Storage**: $0.00 - $2.00
  - First 50 GB/month: ~$0.023/GB
  - Typical statement file: 50-500 KB

- **Data Transfer**: $0.00 - $0.10
  - First 100 GB free

**Total: < $3/month** for typical usage

## Next Steps

After successful deployment, you can:

1. **Integrate with Mobile App** - Use the Function URL in your app
2. **Build Web Upload Form** - Create a simple HTML form
3. **Automate Processing** - Set up cron job to process uploaded files (Phase 2)

## Support

For issues or questions:
- Check CloudWatch Logs
- Review AWS SAM documentation: https://docs.aws.amazon.com/serverless-application-model/
- Verify IAM permissions and S3 bucket configuration
