const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../config/database');
const User = require('../models/User');
const Evidence = require('../models/Evidence');
const EvidenceService = require('../services/evidence.service');

const sharedMfaSecret = 'JBSWY3DPEHPK3PXP';
const testPassword = 'Password123!@#Vault';

async function seed() {
  console.log('[Seed] Connecting to database...');
  await connectDB();

  // 1. Seed Demo Users
  const passwordHash = await bcrypt.hash(testPassword, 10);
  const users = [
    {
      email: 'admin@demo.vault',
      passwordHash,
      role: 'admin',
      accountStatus: 'active',
      emailVerified: true,
      mfaEnabled: true,
      mfaSecret: sharedMfaSecret
    },
    {
      email: 'investigator@demo.vault',
      passwordHash,
      role: 'investigator',
      accountStatus: 'active',
      emailVerified: true,
      mfaEnabled: true,
      mfaSecret: sharedMfaSecret
    },
    {
      email: 'auditor@demo.vault',
      passwordHash,
      role: 'auditor',
      accountStatus: 'active',
      emailVerified: true,
      mfaEnabled: true,
      mfaSecret: sharedMfaSecret
    }
  ];

  for (const u of users) {
    const existing = await User.findOne({ email: u.email });
    if (!existing) {
      await User.create(u);
      console.log(`[Seed] Created user: ${u.email} (${u.role})`);
    } else {
      console.log(`[Seed] User already exists: ${u.email}`);
    }
  }

  const investigator = await User.findOne({ email: 'investigator@demo.vault' });

  // 2. Seed Evidence Item 1 if none exists
  const count = await Evidence.countDocuments();
  if (count === 0) {
    const pcapBytes = Buffer.from('%PDF-1.4 (Synthetic Network Log Binary)\nIncident Network Capture Data Stream\n%%EOF');
    const result1 = await EvidenceService.ingestEvidence({
      title: 'Incident Network Traffic Capture (Synthetic)',
      description: 'Simulated network packet capture containing synthetic traffic anomalies for forensic investigation.',
      category: 'logs',
      referenceId: 'CASE-2026-901',
      tags: ['network', 'synthetic', 'pcap'],
      classification: 'confidential',
      fileBuffer: pcapBytes,
      originalFilename: 'synthetic_capture_20261024.pdf',
      detectedMimeType: 'application/pdf',
      user: investigator,
      correlationId: 'corr-seed-001'
    });
    console.log(`[Seed] Ingested evidence: ${result1.evidence.evidenceId}`);

    const docBytes = Buffer.from('%PDF-1.4 (Synthetic Gateway Audit Dump)\nRedacted Authentication Journal\n%%EOF');
    const result2 = await EvidenceService.ingestEvidence({
      title: 'Access Gateway Audit Dump (Synthetic)',
      description: 'Redacted synthetic authentication journal exports and gateway access logs.',
      category: 'documents',
      referenceId: 'CASE-2026-902',
      tags: ['audit', 'auth', 'synthetic'],
      classification: 'internal',
      fileBuffer: docBytes,
      originalFilename: 'synthetic_auth_audit.pdf',
      detectedMimeType: 'application/pdf',
      user: investigator,
      correlationId: 'corr-seed-002'
    });
    console.log(`[Seed] Ingested evidence: ${result2.evidence.evidenceId}`);
  } else {
    console.log(`[Seed] Evidence records already exist (${count} items).`);
  }

  console.log('[Seed] Database initialization complete.');
  await disconnectDB();
}

seed().catch(err => {
  console.error('[Seed Error]:', err);
  process.exit(1);
});
