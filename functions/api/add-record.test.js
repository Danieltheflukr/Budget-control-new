import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from './add-record.js';

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

test('add-record API', async (t) => {
  await t.test('returns 400 for invalid JSON', async () => {
    const mock = makeMockDB();
    const request = new Request('https://example.com/api/add-record', {
      method: 'POST',
      body: '{bad json'
    });

    const response = await onRequestPost({ request, env: { DB: mock.DB } });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Invalid JSON' });
  });

  await t.test('inserts record with supported defaults', async () => {
    const mock = makeMockDB();
    const request = new Request('https://example.com/api/add-record', {
      method: 'POST',
      body: JSON.stringify({
        category: 'Food',
        description: 'Dinner',
        amount: '180',
        payer_id: 'Daniel'
      })
    });

    const response = await onRequestPost({ request, env: { DB: mock.DB } });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { success: true });
    assert.match(mock.state.sql, /INSERT INTO records/);
    assert.equal(mock.state.runCalls, 1);

    const [, type, category, description, amount, payerId, groupId, date, danielShare, jackyShare] = mock.state.boundValues;
    assert.equal(type, '支出');
    assert.equal(category, 'Food');
    assert.equal(description, 'Dinner');
    assert.equal(amount, 180);
    assert.equal(payerId, 'Daniel');
    assert.equal(groupId, 'group_default');
    assert.match(date, /^\d{4}-\d{2}-\d{2}/);
    assert.equal(danielShare, 0);
    assert.equal(jackyShare, 0);
  });
});
