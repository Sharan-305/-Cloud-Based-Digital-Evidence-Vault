const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/app');

test('Health & Baseline API Verification Suite', async (t) => {
  let server;
  let testPort;

  await t.test('Start test HTTP server instance', (t, done) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      testPort = server.address().port;
      done();
    });
  });

  await t.test('GET /api/health returns 200 with operational status', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/health`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.status, 'healthy');
    assert.strictEqual(body.subsystems.api, 'operational');
    assert.strictEqual(typeof body.uptimeSeconds, 'number');
    assert.ok(body.timestamp);
  });

  await t.test('GET /api/unmapped-endpoint returns 404 with structured JSON error', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/unmapped-endpoint`);
    assert.strictEqual(res.status, 404);

    const body = await res.json();
    assert.strictEqual(body.error.code, 'ROUTE_NOT_FOUND');
    assert.ok(body.error.message.includes('/api/unmapped-endpoint'));
  });

  await t.test('GET /api/auth returns 501 for unreached phase endpoint', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/auth`);
    assert.strictEqual(res.status, 501);

    const body = await res.json();
    assert.strictEqual(body.error.code, 'NOT_IMPLEMENTED');
  });

  await t.test('Server sends correlation ID header', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/api/health`);
    const correlationId = res.headers.get('x-correlation-id');
    assert.ok(correlationId);
  });

  await t.test('GET / serves frontend index.html', async () => {
    const res = await fetch(`http://127.0.0.1:${testPort}/`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Digital Evidence Vault'));
  });

  await t.test('Close test HTTP server', (t, done) => {
    server.close(done);
  });
});
