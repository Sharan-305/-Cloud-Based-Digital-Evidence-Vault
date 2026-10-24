const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Readable } = require('stream');
const config = require('../config');

// In-memory mock versioned S3 storage for tests and offline development
const mockS3Storage = new Map(); // key -> Array<{ versionId, buffer, mimeType, createdAt }>

class StorageService {
  static getClient() {
    const isMock = !config.aws.accessKeyId || config.aws.accessKeyId.includes('placeholder') || process.env.NODE_ENV === 'test';
    if (isMock) {
      return null; // Signals mock mode
    }

    return new S3Client({
      region: config.aws.region,
      credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
      },
      forcePathStyle: config.aws.forcePathStyle
    });
  }

  /**
   * Upload object buffer or stream to private S3 with server-side encryption
   */
  static async putObject({ key, buffer, contentType, metadata = {} }) {
    const s3 = this.getClient();
    const bucket = config.aws.bucketName;

    if (!s3) {
      // Mock Versioned Storage Provider
      if (!mockS3Storage.has(key)) {
        mockS3Storage.set(key, []);
      }
      const versions = mockS3Storage.get(key);
      const versionId = `ver-${Date.now()}-${versions.length + 1}-${Math.random().toString(36).substr(2, 6)}`;
      versions.push({
        versionId,
        buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer),
        contentType,
        metadata,
        createdAt: new Date()
      });

      return {
        bucket,
        key,
        versionId,
        serverSideEncryption: 'AES256'
      };
    }

    // AWS S3 PutObject with Server-Side Encryption enforced
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ServerSideEncryption: 'AES256',
      Metadata: metadata
    });

    const response = await s3.send(command);
    return {
      bucket,
      key,
      versionId: response.VersionId || 'v1-default',
      serverSideEncryption: response.ServerSideEncryption
    };
  }

  /**
   * Get exact version byte stream from private S3
   */
  static async getObjectStream({ key, versionId }) {
    const s3 = this.getClient();
    const bucket = config.aws.bucketName;

    if (!s3) {
      const versions = mockS3Storage.get(key);
      if (!versions || versions.length === 0) {
        throw new Error(`S3 Object not found: ${key}`);
      }

      const match = versionId 
        ? versions.find(v => v.versionId === versionId)
        : versions[versions.length - 1];

      if (!match) {
        throw new Error(`S3 Object version not found: ${key} (version: ${versionId})`);
      }

      return {
        stream: Readable.from(match.buffer),
        buffer: match.buffer,
        contentType: match.contentType,
        contentLength: match.buffer.length,
        versionId: match.versionId
      };
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      VersionId: versionId || undefined
    });

    const response = await s3.send(command);
    return {
      stream: response.Body,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      versionId: response.VersionId
    };
  }

  /**
   * Delete object version (used for failure compensation rollback)
   */
  static async deleteObjectVersion({ key, versionId }) {
    const s3 = this.getClient();
    const bucket = config.aws.bucketName;

    if (!s3) {
      if (mockS3Storage.has(key)) {
        if (!versionId) {
          mockS3Storage.delete(key);
        } else {
          const versions = mockS3Storage.get(key).filter(v => v.versionId !== versionId);
          if (versions.length === 0) {
            mockS3Storage.delete(key);
          } else {
            mockS3Storage.set(key, versions);
          }
        }
      }
      return { success: true };
    }

    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
      VersionId: versionId || undefined
    });

    await s3.send(command);
    return { success: true };
  }

  /**
   * Generate short-lived pre-signed download URL (5 minutes)
   */
  static async generatePresignedDownloadUrl({ key, versionId, expiresIn = 300 }) {
    const s3 = this.getClient();
    const bucket = config.aws.bucketName;

    if (!s3) {
      // Mock signed download token URL
      return `/api/evidence/download-stream?key=${encodeURIComponent(key)}&versionId=${encodeURIComponent(versionId)}&token=mock-presigned-${Date.now()}`;
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      VersionId: versionId || undefined
    });

    return getSignedUrl(s3, command, { expiresIn });
  }

  /**
   * Clear mock storage for testing
   */
  static clearMockStorage() {
    mockS3Storage.clear();
  }
}

module.exports = StorageService;
