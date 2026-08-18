require('ts-node').register({ transpileOnly: true });
require('tsconfig-paths/register');
const fs = require('fs');
const path = require('path');
const { StorageService } = require('../libs/storage/src/storage.service');
const { createMulterOptions } = require('../libs/storage/src/multer.config');

async function runFileUploadIntegrationTest() {
  console.log('=== Starting File Upload Integration Test Across Services ===');

  try {
    // 1. Verify StorageService configuration
    const storage = new StorageService({ localUploadDir: './uploads' });
    console.log(`[PASS] StorageService initialized with upload directory: ${storage.getUploadDir()}`);

    // 2. Simulate processing uploaded file
    const sampleBuffer = Buffer.from('Sample legal document content for Tebeka Portal', 'utf8');
    const mockMulterFile = {
      fieldname: 'file',
      originalname: 'legal_agreement.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      destination: './uploads/cases',
      filename: `legal_agreement-${Date.now()}.pdf`,
      path: path.resolve('./uploads/cases', `legal_agreement-${Date.now()}.pdf`),
      size: sampleBuffer.length,
    };

    // Ensure test directory exists & write sample file
    fs.mkdirSync(path.dirname(mockMulterFile.path), { recursive: true });
    fs.writeFileSync(mockMulterFile.path, sampleBuffer);

    const processed = storage.processUploadedFile(mockMulterFile, 'cases');
    console.log(`[PASS] StorageService processed file key: "${processed.fileKey}", size: ${processed.size} bytes.`);

    if (!processed.fileKey || !processed.fileName) {
      throw new Error('StorageService failed to produce valid file metadata');
    }

    // 3. Test Signed URL generation
    const signedUrlData = storage.getSignedUrl(processed.fileKey);
    console.log(`[PASS] Generated Signed URL: "${signedUrlData.signedUrl}"`);

    if (!signedUrlData.signedUrl || !signedUrlData.expiresAt) {
      throw new Error('Signed URL generation failed');
    }

    // 4. Test File Stream Readability
    const stream = storage.getFileStream(processed.fileKey);
    let readBuffer = Buffer.alloc(0);

    await new Promise((resolve, reject) => {
      stream.on('data', chunk => { readBuffer = Buffer.concat([readBuffer, chunk]); });
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    console.log(`[PASS] File stream read content: "${readBuffer.toString('utf8')}"`);
    if (readBuffer.toString('utf8') !== sampleBuffer.toString('utf8')) {
      throw new Error('File stream read content does not match original binary buffer');
    }

    // 5. Test Multer Options Generator
    const avatarMulterOptions = createMulterOptions('avatars', 5 * 1024 * 1024, ['image/jpeg', 'image/png']);
    if (typeof avatarMulterOptions.limits.fileSize !== 'number') {
      throw new Error('Multer options generator failed to set file size limits');
    }
    console.log(`[PASS] createMulterOptions configured correctly for avatars subfolder.`);

    // 6. Test Physical File Deletion
    const deleted = await storage.deleteFile(processed.fileKey);
    console.log(`[PASS] Deleted temporary test file: ${deleted}`);

    console.log('=== All File Upload Integration Tests PASSED Successfully! ===');
  } catch (err) {
    console.error('Integration test failed:', err);
    process.exit(1);
  }
}

runFileUploadIntegrationTest();
