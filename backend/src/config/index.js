const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env in backend or root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config(); // fallback to local cwd .env

const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.PORT || '5000', 10),
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5000',
  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-jwt-secret-replace-in-env',
  sessionSecret: process.env.SESSION_SECRET || 'dev-insecure-session-secret-replace-in-env',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/evidence_vault_dev',
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    bucketName: process.env.AWS_S3_BUCKET_NAME || 'evidence-vault-bucket',
    forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true'
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 mins
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10)
  },
  frontendPath: path.resolve(__dirname, '../../../frontend')
};

module.exports = config;
