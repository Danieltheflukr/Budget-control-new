import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from './records.js';

function makeMockDB({ changes = 1 } = {}) {
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
                return { meta: { changes } };
              }
            };
          },
          async run() {
            state.runCalls += 1;
            return { meta: { changes } };
          }
        };
      }
    }
  };
}

test('records API POST', async (t) => {
  await t.test('returns 400 for invalid JSON', async () => {
    const mock = makeMockDB();
    const request = new Request('https://example.com/api/records', {
      method: 'POST',
      body: '{bad json'
    });

    const response = await onRequest({ request, env: { DB: mock.DB } });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Invalid JSON' });
  });

  await t.test('returns 400 for missing required fields', async () => {
    const mock = makeMockDB();
    const request = new Request('https://example.com/api/records', {
      method: 'POST',
      body: JSON.stringify({ type: '支出', amount: 100, payer_id: 'Daniel' })
    });

    const response = await onRequest({ request, env: { DB: mock.DB } });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Missing category' });
  });

  await t.test('returns 400 when payer does not exist in group', async () => {
    const mock = makeMockDB({ changes: 0 });
    const request = new Request('https://example.com/api/records?group_id=group_default', {
      method: 'POST',
      body: JSON.stringify({
        type: '支出',
        category: 'Food',
        description: 'Lunch',
        amount: 150,
        payer_id: 'Unknown',
        date: '2026-02-19'
      })
    });

    const response = await onRequest({ request, env: { DB: mock.DB } });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'payer_id not found in group' });
  });

  await t.test('inserts record when input is valid', async () => {
    const mock = makeMockDB({ changes: 1 });
    const request = new Request('https://example.com/api/records?group_id=group_default', {
      method: 'POST',
      body: JSON.stringify({
        type: '支出',
        category: 'Food',
        description: 'Lunch',
        amount: '150.5',
        payer_id: 'Daniel',
        date: '2026-02-19'
      })
    });

    const response = await onRequest({ request, env: { DB: mock.DB } });
    const payload = await response.json();

    assert.equal(response.status, 201);
    assert.equal(payload.success, true);
    assert.equal(typeof payload.record_id, 'string');
    assert.match(mock.state.sql, /INSERT INTO records/);
    assert.equal(mock.state.runCalls, 1);

    const [, type, category, description, amount, payerId, groupId, date] = mock.state.boundValues;
    assert.equal(type, '支出');
    assert.equal(category, 'Food');
    assert.equal(description, 'Lunch');
    assert.equal(amount, 150.5);
    assert.equal(payerId, 'Daniel');
    assert.equal(groupId, 'group_default');
    assert.equal(date, '2026-02-19');
  });
});

test('records API DELETE', async (t) => {
  await t.test('returns 400 when id is missing', async () => {
    const mock = makeMockDB();
    const request = new Request('https://example.com/api/records', {
      method: 'DELETE'
    });

    const response = await onRequest({ request, env: { DB: mock.DB } });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Missing id' });
  });

  await t.test('returns 200 when deletion is successful', async () => {
    const mock = makeMockDB({ changes: 1 });
    const request = new Request('https://example.com/api/records?id=123', {
      method: 'DELETE'
    });

    const response = await onRequest({ request, env: { DB: mock.DB } });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true });
    assert.match(mock.state.sql, /DELETE FROM records/);
    assert.equal(mock.state.runCalls, 1);
  });

  await t.test('returns 404 when record is not found', async () => {
    const mock = makeMockDB({ changes: 0 });
    const request = new Request('https://example.com/api/records?id=999', {
      method: 'DELETE'
    });

    const response = await onRequest({ request, env: { DB: mock.DB } });
    assert.equal(response.status, 404, 'Should return 404 when record not found');
    assert.deepEqual(await response.json(), { error: 'Record not found' });
  });
});
