import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './app.mjs';
import { openStorage } from './storage.mjs';
import { hashPassword } from './passwordAuth.mjs';

test('production static server serves PDF worker modules and WASM with executable MIME types', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'magazoo-module-test-'));
  const storage = openStorage(':memory:');
  const server = createApp({ storage, origin: 'http://127.0.0.1', staticDir: directory,
    passwordHash: hashPassword('test-only-password') });
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    storage.close();
    await rm(directory, { recursive: true, force: true });
  });
  await writeFile(join(directory, 'pdf.worker.min.mjs'), 'export const WorkerMessageHandler = {};');
  await writeFile(join(directory, 'decoder.wasm'), Buffer.from([0,97,115,109,1,0,0,0]));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [file, type] of [['pdf.worker.min.mjs', 'text/javascript'], ['decoder.wasm', 'application/wasm']]) {
    for (const method of ['GET', 'HEAD']) {
      const response = await fetch(`${base}/${file}`, { method });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), type);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    }
  }
});
