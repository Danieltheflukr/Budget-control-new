import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/api/_middleware.js';

test('Authentication Middleware', async (t) => {
  const next = async () => new Response('OK');

  await t.test('allows OPTIONS requests', async () => {
    const request = new Request('https://api.com/test', { method: 'OPTIONS' });
    const response = await onRequest({ request, next, env: {} });
    assert.equal(await response.text(), 'OK');
  });

  await t.test('allows authenticated Cloudflare Access requests', async () => {
    const request = new Request('https://api.com/test', {
      headers: { 'Cf-Access-Authenticated-User-Email': 'user@example.com' }
    });
    const response = await onRequest({ request, next, env: {} });
    assert.equal(await response.text(), 'OK');
  });

  await t.test('allows valid X-Member-Id in non-production (local)', async () => {
    const request = new Request('https://api.com/test', {
      headers: { 'X-Member-Id': 'Daniel' } // 'Daniel' is in config.js
    });
    // CF_PAGES_BRANCH is undefined or not 'main'
    const response = await onRequest({ request, next, env: { CF_PAGES_BRANCH: 'dev' } });
    assert.equal(await response.text(), 'OK');
  });

  await t.test('blocks valid X-Member-Id in production (main branch)', async () => {
    const request = new Request('https://api.com/test', {
      headers: { 'X-Member-Id': 'Daniel' }
    });
    const response = await onRequest({ request, next, env: { CF_PAGES_BRANCH: 'main' } });
    assert.equal(response.status, 401);
  });

  await t.test('blocks invalid X-Member-Id in non-production', async () => {
    const request = new Request('https://api.com/test', {
      headers: { 'X-Member-Id': 'Hacker' }
    });
    const response = await onRequest({ request, next, env: { CF_PAGES_BRANCH: 'dev' } });
    assert.equal(response.status, 401);
  });

  await t.test('blocks requests with no headers', async () => {
    const request = new Request('https://api.com/test');
    const response = await onRequest({ request, next, env: {} });
    assert.equal(response.status, 401);
  });
});
