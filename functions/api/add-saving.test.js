import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from './add-saving.js';

function makeMockDB() {
  const state = { sql: '', boundValues: null, runCalls: 0 };

  return {
    state,
    DB: {
      prepare(sql) {
        state.sql = sql;
        return {
          bind(...values) {
            state.boundValues = values;
            return {
              async run() {
                state.runCalls += 1;
                return { success: true };
              }
            };
          }
        };
      }
    }
  };
}

test('add-saving API', async (t) => {
  await t.test('returns 400 for invalid JSON', async () => {
    const { DB } = makeMockDB();
    const request = new Request('https://example.com/api/add-saving', {
      method: 'POST',
      body: '{bad json'
    });

    const response = await onRequestPost({ request, env: { DB } });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Invalid JSON' });
  });

  await t.test('returns 400 for missing payer_id', async () => {
    const { DB } = makeMockDB();
    const request = new Request('https://example.com/api/add-saving', {
      method: 'POST',
      body: JSON.stringify({ amount: 100 })
    });

    const response = await onRequestPost({ request, env: { DB } });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Missing payer_id' });
  });

  await t.test('returns 400 for invalid amount', async () => {
    const { DB } = makeMockDB();
    const request = new Request('https://example.com/api/add-saving', {
      method: 'POST',
      body: JSON.stringify({ payer_id: 'Daniel', amount: 0 })
    });

    const response = await onRequestPost({ request, env: { DB } });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Invalid amount' });
  });

  await t.test('inserts saving and defaults target_name/date when valid', async () => {
    const mock = makeMockDB();
    const request = new Request('https://example.com/api/add-saving', {
      method: 'POST',
      body: JSON.stringify({
        payer_id: 'Daniel',
        amount: '88.5',
        description: 'weekly saving'
      })
    });

    const response = await onRequestPost({ request, env: { DB: mock.DB } });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { success: true });
    assert.equal(mock.state.runCalls, 1);
    assert.match(mock.state.sql, /INSERT INTO savings/);

    const [date, payerId, amount, description, targetName] = mock.state.boundValues;
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(payerId, 'Daniel');
    assert.equal(amount, 88.5);
    assert.equal(description, 'weekly saving');
    assert.equal(targetName, 'General Savings');
  });
});
