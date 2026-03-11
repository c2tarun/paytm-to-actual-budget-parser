#!/bin/bash

# Deployment script for Paytm Statement Uploader Lambda

set -e  # Exit on error

echo "====================================="
echo "Paytm Statement Uploader - Deployment"
echo "====================================="
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first:"
    echo "   https://aws.amazon.com/cli/"
    exit 1
fi

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo "❌ AWS SAM CLI not found. Please install it first:"
    echo "   https://aws.amazon.com/serverless/sam/"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install it first:"
    echo "   https://nodejs.org/"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Install Lambda dependencies
echo "📦 Installing Lambda dependencies..."
cd src
npm install
cd ..
echo "✅ Dependencies installed"
echo ""

# Build SAM application
echo "🔨 Building SAM application..."
sam build
echo "✅ Build complete"
echo ""

# Deploy
echo "🚀 Deploying to AWS..."
echo ""

if [ ! -f "samconfig.toml" ]; then
    echo "⚠️  No samconfig.toml found. Running guided deployment..."
    echo ""
    echo "You will be prompted for:"
    echo "  - Stack name (default: paytm-statement-uploader)"
    echo "  - Region (use: us-west-2)"
    echo "  - Upload secret token (generate a secure random string, min 20 chars)"
    echo ""
    echo "💡 Tip: Generate a secure token with:"
    echo "   openssl rand -base64 32"
    echo ""
    read -p "Press Enter to continue..."
    sam deploy --guided
else
    echo "ℹ️  Using existing samconfig.toml configuration"
    echo "⚠️  Make sure you've updated the UploadSecretToken in samconfig.toml!"
    echo ""
    sam deploy
fi

echo ""
echo "====================================="
echo "✅ Deployment Complete!"
echo "====================================="
echo ""
echo "Next steps:"
echo "1. Note the Function URL from the output above"
echo "2. Save your secret token securely"
echo "3. Test the upload:"
echo "   node test-upload.js ./test-files/your-file.xlsx <FUNCTION_URL> <SECRET_TOKEN>"
echo ""
echo "To view logs:"
echo "   sam logs --stack-name paytm-statement-uploader --tail"
echo ""
echo "To delete everything:"
echo "   sam delete"
echo ""
