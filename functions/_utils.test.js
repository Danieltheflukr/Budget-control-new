import { test, mock } from 'node:test';
import assert from 'node:assert';
import { sendTelegramNotification } from './_utils.js';

test('sendTelegramNotification', async (t) => {
  // Mock console
  const warnMock = mock.method(console, 'warn', () => {});
  const errorMock = mock.method(console, 'error', () => {});

  // Mock global fetch
  // In Node.js environment, fetch is on globalThis
  const fetchMock = mock.fn(() => Promise.resolve({ ok: true }));
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchMock;

  await t.test('should return early and log warning if config is missing', async () => {
    const env = {};
    await sendTelegramNotification(env, 'test message');

    assert.strictEqual(warnMock.mock.callCount(), 1);
    assert.match(warnMock.mock.calls[0].arguments[0], /Telegram config missing/);
    assert.strictEqual(fetchMock.mock.callCount(), 0);
  });

  await t.test('should call fetch with correct URL when config is present', async () => {
    const env = {
      TELEGRAM_BOT_TOKEN: 'token123',
      TELEGRAM_CHAT_ID: 'chat456'
    };
    const message = 'Hello World!';
    await sendTelegramNotification(env, message);

    assert.strictEqual(fetchMock.mock.callCount(), 1);
    const expectedUrl = `https://api.telegram.org/bottoken123/sendMessage?chat_id=chat456&text=${encodeURIComponent(message)}`;
    assert.strictEqual(fetchMock.mock.calls[0].arguments[0], expectedUrl);
  });

  await t.test('should log error if fetch fails', async () => {
    const env = {
      TELEGRAM_BOT_TOKEN: 'token123',
      TELEGRAM_CHAT_ID: 'chat456'
    };
    // Clear previous calls
    fetchMock.mock.resetCalls();
    fetchMock.mock.mockImplementationOnce(() => Promise.reject(new Error('Network error')));

    await sendTelegramNotification(env, 'test message');

    assert.strictEqual(errorMock.mock.callCount(), 1);
    assert.match(errorMock.mock.calls[0].arguments[0], /Telegram send failed/);
  });

  // Restore
  globalThis.fetch = originalFetch;
  mock.restoreAll();
});
