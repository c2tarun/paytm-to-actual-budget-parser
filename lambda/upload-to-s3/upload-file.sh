#!/bin/bash

# Simple upload script for Paytm statements
# Usage: ./upload-file.sh <file-path> <function-url> <secret-token>

if [ $# -lt 3 ]; then
    echo "Usage: ./upload-file.sh <file-path> <function-url> <secret-token>"
    echo ""
    echo "Example:"
    echo "  ./upload-file.sh ./statement.xlsx https://abc123.lambda-url.us-west-2.on.aws/ 205f611fef15"
    exit 1
fi

FILE_PATH="$1"
FUNCTION_URL="$2"
SECRET_TOKEN="$3"

if [ ! -f "$FILE_PATH" ]; then
    echo "Error: File not found: $FILE_PATH"
    exit 1
fi

echo "Uploading file: $FILE_PATH"
echo "To: $FUNCTION_URL"
echo ""

curl -X POST "$FUNCTION_URL" \
  -F "file=@$FILE_PATH" \
  -F "token=$SECRET_TOKEN"

echo ""
