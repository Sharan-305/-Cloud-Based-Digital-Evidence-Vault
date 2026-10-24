const { spawnSync } = require('child_process');
const path = require('path');

const testFiles = [
  'tests/health.test.js',
  'tests/auth.test.js',
  'tests/storage.test.js',
  'tests/integrity.test.js'
];

console.log(`[Test Runner] Running ${testFiles.length} test suites...\n`);

let totalPassed = 0;
let totalFailed = 0;

for (const file of testFiles) {
  console.log(`============================================================`);
  console.log(`Running suite: ${file}`);
  console.log(`============================================================`);

  const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec', file], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: 'inherit'
  });

  if (result.status === 0) {
    totalPassed++;
  } else {
    totalFailed++;
  }
}

console.log(`\n============================================================`);
console.log(`Test Execution Summary: ${totalPassed} suites passed, ${totalFailed} suites failed.`);
console.log(`============================================================`);

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
