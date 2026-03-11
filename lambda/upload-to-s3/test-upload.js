#!/usr/bin/env node

/**
 * Test script to upload a file to the Lambda Function URL
 *
 * Usage:
 *   node test-upload.js <file-path> <function-url> <secret-token>
 *
 * Example:
 *   node test-upload.js ./test-files/sample.xlsx https://abc123.lambda-url.ap-south-2.on.aws/ my-secret-token
 */

const fs = require('fs');
const path = require('path');

async function uploadFile(filePath, functionUrl, secretToken) {
  console.log('Upload Test Script');
  console.log('==================\n');

  // Validate inputs
  if (!filePath || !functionUrl || !secretToken) {
    console.error('Error: Missing required arguments');
    console.log('\nUsage:');
    console.log('  node test-upload.js <file-path> <function-url> <secret-token>');
    console.log('\nExample:');
    console.log('  node test-upload.js ./test-files/sample.xlsx https://abc.lambda-url.ap-south-2.on.aws/ my-token');
    process.exit(1);
  }

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found: ${filePath}`);
    process.exit(1);
  }

  const fileName = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;

  console.log(`File: ${fileName}`);
  console.log(`Size: ${(fileSize / 1024).toFixed(2)} KB`);
  console.log(`Function URL: ${functionUrl}`);
  console.log(`Token: ${secretToken.slice(0, 4)}...${secretToken.slice(-4)}`);
  console.log();

  try {
    // Create FormData
    const FormData = require('form-data');
    const form = new FormData();

    form.append('file', fs.createReadStream(filePath), fileName);
    form.append('token', secretToken);

    console.log('Uploading file...');

    // Make request
    const response = await fetch(functionUrl, {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });

    const responseData = await response.json();

    console.log('\nResponse Status:', response.status);
    console.log('Response Body:', JSON.stringify(responseData, null, 2));

    if (responseData.success) {
      console.log('\n✅ SUCCESS! File uploaded to S3');
      console.log(`S3 Key: ${responseData.s3Key}`);
      console.log(`Bucket: ${responseData.bucket}`);
    } else {
      console.log('\n❌ FAILED:', responseData.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Upload failed with error:');
    console.error(error.message);
    process.exit(1);
  }
}

// Check if form-data is installed
try {
  require('form-data');
} catch (error) {
  console.error('Error: form-data package not found.');
  console.error('Please install it: npm install form-data');
  process.exit(1);
}

// Run the upload
const [,, filePath, functionUrl, secretToken] = process.argv;
uploadFile(filePath, functionUrl, secretToken);
