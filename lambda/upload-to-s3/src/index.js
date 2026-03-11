const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const Busboy = require('busboy');
const crypto = require('crypto');

// Initialize S3 client
const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-west-2' });

// Environment variables
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const SECRET_TOKEN = process.env.UPLOAD_SECRET_TOKEN;
const INCOMING_PREFIX = process.env.S3_INCOMING_PREFIX || 'incoming/';

/**
 * Parse multipart/form-data from Lambda Function URL request
 * @param {Object} event - Lambda event object
 * @returns {Promise<Object>} - Parsed fields and file data
 */
function parseMultipartFormData(event) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: {
        'content-type': event.headers['content-type'] || event.headers['Content-Type']
      }
    });

    const fields = {};
    const files = [];

    // Handle text fields
    busboy.on('field', (fieldname, value) => {
      fields[fieldname] = value;
    });

    // Handle file uploads
    busboy.on('file', (fieldname, file, info) => {
      const { filename, encoding, mimeType } = info;
      const chunks = [];

      file.on('data', (chunk) => {
        chunks.push(chunk);
      });

      file.on('end', () => {
        files.push({
          fieldname,
          filename,
          encoding,
          mimeType,
          buffer: Buffer.concat(chunks)
        });
      });
    });

    busboy.on('finish', () => {
      resolve({ fields, files });
    });

    busboy.on('error', (error) => {
      reject(error);
    });

    // Write the request body to busboy
    const body = event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : event.body;

    busboy.write(body);
    busboy.end();
  });
}

/**
 * Validate secret token using constant-time comparison
 * @param {string} providedToken - Token from request
 * @returns {boolean} - True if valid
 */
function validateToken(providedToken) {
  if (!providedToken || !SECRET_TOKEN) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedToken),
      Buffer.from(SECRET_TOKEN)
    );
  } catch (error) {
    // Length mismatch or other error
    return false;
  }
}

/**
 * Validate file extension and type
 * @param {string} filename - Original filename
 * @param {string} mimeType - MIME type from upload
 * @returns {Object} - { valid: boolean, error: string }
 */
function validateFile(filename, mimeType) {
  const allowedExtensions = ['.xlsx'];
  const allowedMimeTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/octet-stream' // Some clients send this
  ];

  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));

  if (!allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Invalid file type. Only ${allowedExtensions.join(', ')} files are allowed.`
    };
  }

  if (!allowedMimeTypes.includes(mimeType)) {
    console.warn(`Warning: Unexpected MIME type ${mimeType} for file ${filename}`);
    // Allow it anyway if extension is correct
  }

  return { valid: true };
}

/**
 * Sanitize filename to prevent path traversal
 * @param {string} filename - Original filename
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
  // Remove any path components and special characters
  return filename
    .replace(/^.*[\\\/]/, '') // Remove path
    .replace(/[^a-zA-Z0-9._-]/g, '_'); // Replace special chars
}

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File data
 * @param {string} originalFilename - Original filename
 * @returns {Promise<string>} - S3 key of uploaded file
 */
async function uploadToS3(fileBuffer, originalFilename) {
  const sanitized = sanitizeFilename(originalFilename);
  const timestamp = Date.now();
  const baseFilename = sanitized.slice(0, sanitized.lastIndexOf('.'));
  const ext = sanitized.slice(sanitized.lastIndexOf('.'));

  // Add timestamp to prevent collisions
  const s3Key = `${INCOMING_PREFIX}${baseFilename}_${timestamp}${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    Metadata: {
      'original-filename': originalFilename,
      'upload-timestamp': new Date().toISOString()
    }
  });

  await s3Client.send(command);
  return s3Key;
}

/**
 * Lambda handler for file upload
 * @param {Object} event - Lambda Function URL event
 * @returns {Object} - HTTP response
 */
exports.handler = async (event) => {
  console.log('Received upload request');

  // Only allow POST
  if (event.requestContext.http.method !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed. Use POST.'
      })
    };
  }

  try {
    // Parse multipart form data
    const { fields, files } = await parseMultipartFormData(event);

    // Validate token
    if (!validateToken(fields.token)) {
      console.warn('Invalid or missing token');
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Invalid or missing token'
        })
      };
    }

    // Check if file was provided
    if (files.length === 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'No file provided. Include a file in the "file" field.'
        })
      };
    }

    const file = files[0]; // Take first file

    // Validate file
    const validation = validateFile(file.filename, file.mimeType);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: validation.error
        })
      };
    }

    // Check file size (Lambda payload limit is 6MB)
    const fileSizeMB = file.buffer.length / (1024 * 1024);
    if (fileSizeMB > 5) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: `File too large (${fileSizeMB.toFixed(2)} MB). Maximum size is 5 MB.`
        })
      };
    }

    // Upload to S3
    const s3Key = await uploadToS3(file.buffer, file.filename);

    console.log(`Successfully uploaded file: ${s3Key}`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'File uploaded successfully',
        filename: file.filename,
        s3Key: s3Key,
        size: file.buffer.length,
        bucket: BUCKET_NAME
      })
    };

  } catch (error) {
    console.error('Upload error:', error);

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Upload failed: ' + error.message
      })
    };
  }
};
