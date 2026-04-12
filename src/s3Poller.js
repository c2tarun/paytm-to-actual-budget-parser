const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand
} = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const log = require('./logger');

/**
 * Creates an S3 client configured from environment/credentials
 * @param {string} region - AWS region
 * @returns {S3Client}
 */
function createS3Client(region) {
  return new S3Client({ region });
}

/**
 * Lists all objects under the incoming prefix in S3
 * @param {S3Client} client - S3 client
 * @param {string} bucket - S3 bucket name
 * @param {string} prefix - S3 prefix (e.g. "incoming/")
 * @returns {Promise<string[]>} - Array of S3 keys
 */
async function listIncomingFiles(client, bucket, prefix) {
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix
  });

  const response = await client.send(command);

  if (!response.Contents || response.Contents.length === 0) {
    return [];
  }

  // Filter out the prefix itself and non-.xlsx files
  return response.Contents
    .map(obj => obj.Key)
    .filter(key => key !== prefix && key.endsWith('.xlsx'));
}

/**
 * Downloads a file from S3 and reads its metadata
 * @param {S3Client} client - S3 client
 * @param {string} bucket - S3 bucket name
 * @param {string} key - S3 object key
 * @param {string} destDir - Local directory to save the file
 * @returns {Promise<{localPath: string, fileName: string, accountId: string|null}>}
 */
async function downloadFile(client, bucket, key, destDir) {
  // Get metadata first
  const headCommand = new HeadObjectCommand({ Bucket: bucket, Key: key });
  const headResponse = await client.send(headCommand);

  // S3 lowercases all user-defined metadata keys
  const metadata = headResponse.Metadata || {};
  const accountId = metadata['account-id'] || null;
  const accountKey = metadata['account-key'] || null;

  // Download file
  const getCommand = new GetObjectCommand({ Bucket: bucket, Key: key });
  const getResponse = await client.send(getCommand);

  const fileName = path.basename(key);
  const localPath = path.join(destDir, fileName);

  await pipeline(getResponse.Body, fs.createWriteStream(localPath));

  return { localPath, fileName, accountId, accountKey };
}

/**
 * Moves a processed file from incoming to processed prefix in S3
 * @param {S3Client} client - S3 client
 * @param {string} bucket - S3 bucket name
 * @param {string} sourceKey - Original S3 key (e.g. "incoming/file.xlsx")
 * @param {string} processedPrefix - Destination prefix (e.g. "processed/")
 * @returns {Promise<void>}
 */
async function moveToProcessed(client, bucket, sourceKey, processedPrefix) {
  const fileName = path.basename(sourceKey);
  const destKey = `${processedPrefix}${fileName}`;

  // Copy to processed prefix
  await client.send(new CopyObjectCommand({
    Bucket: bucket,
    CopySource: `${bucket}/${sourceKey}`,
    Key: destKey
  }));

  // Delete from incoming
  await client.send(new DeleteObjectCommand({
    Bucket: bucket,
    Key: sourceKey
  }));

  log.info('s3_file_moved', { from: sourceKey, to: destKey });
}

module.exports = {
  createS3Client,
  listIncomingFiles,
  downloadFile,
  moveToProcessed
};
