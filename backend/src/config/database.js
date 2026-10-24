const mongoose = require('mongoose');
const config = require('./index');

let isConnected = false;
let memoryStoreMode = false;

// In-memory data store cache for offline development or testing without live MongoDB
const memoryCollections = {
  users: new Map(),
  auditlogs: new Map(),
  evidence: new Map(),
  evidenceversions: new Map(),
  custodyevents: new Map(),
  accessrequests: new Map(),
  integritychecks: new Map(),
  alerts: new Map(),
  backupjobs: new Map()
};

async function connectDB() {
  if (isConnected) return;

  // In test mode or when explicitly configured, check if we should try live or fallback
  try {
    mongoose.set('strictQuery', true);
    
    // Set a quick server selection timeout so offline local testing doesn't hang for 30s
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: process.env.NODE_ENV === 'test' ? 1000 : 5000,
      autoIndex: true
    });

    isConnected = true;
    memoryStoreMode = false;
    console.log('[Database] Connected to MongoDB at', config.mongoUri.replace(/:([^:@]{1,})@/, ':****@'));
  } catch (err) {
    if (process.env.NODE_ENV === 'test' || process.env.ALLOW_OFFLINE_DB === 'true' || config.env === 'development') {
      console.warn(`[Database] MongoDB connection unavailable (${err.message}). Activating in-memory store adapter.`);
      isConnected = true;
      memoryStoreMode = true;
    } else {
      console.error('[Database] Fatal MongoDB connection error:', err.message);
      throw err;
    }
  }

  mongoose.connection.on('error', (err) => {
    console.error('[Database] MongoDB runtime error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('[Database] MongoDB disconnected.');
  });
}

async function disconnectDB() {
  if (isConnected && !memoryStoreMode) {
    await mongoose.disconnect();
  }
  isConnected = false;
}

function isDbConnected() {
  return isConnected;
}

function isMemoryMode() {
  return memoryStoreMode;
}

function getMemoryStore(collectionName) {
  if (!memoryCollections[collectionName]) {
    memoryCollections[collectionName] = new Map();
  }
  return memoryCollections[collectionName];
}

function clearMemoryStore() {
  for (const key of Object.keys(memoryCollections)) {
    memoryCollections[key].clear();
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  isDbConnected,
  isMemoryMode,
  getMemoryStore,
  clearMemoryStore
};
