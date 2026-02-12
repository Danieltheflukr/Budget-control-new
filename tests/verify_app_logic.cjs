const fs = require('fs');
const path = require('path');

console.log("Running Integration Verification for app.js...\n");

// 1. Setup Mocks
const mockConsole = {
    log: console.log,
    error: console.error, // We expect errors for bad input
    warn: console.warn
};

// Mock DOM elements container
const mockElements = {};

const document = {
    getElementById: (id) => {
        if (!mockElements[id]) {
            mockElements[id] = {
                id,
                innerHTML: '',
                appendChild: (child) => {
                     // Verify child is valid
                     if (!child) throw new Error("Appended null child");
                },
                getContext: () => ({}),
                classList: { add: () => {}, remove: () => {} },
                style: {},
                textContent: ''
            };
        }
        return mockElements[id];
    },
    createElement: (tag) => ({
        tagName: tag.toUpperCase(),
        className: '',
        appendChild: () => {},
        textContent: '',
        style: {},
        innerHTML: '',
        classList: { add: () => {}, remove: () => {} }
    }),
    addEventListener: (event, callback) => {
        if (event === 'DOMContentLoaded') {
            // Don't auto-run in test
        }
    }
};

global.document = document;
global.window = {
    onclick: null,
    location: { reload: () => {} },
    confirm: () => true,
    alert: (msg) => console.log("Alert:", msg)
};
global.Chart = class { destroy() {} };
global.FormData = class { get() { return ""; } };

// Mock Fetch
let mockFetchResponse = { ok: true, json: async () => [] };
global.fetch = async () => ({
    status: mockFetchResponse.status || 200,
    ok: mockFetchResponse.ok,
    json: mockFetchResponse.json,
    statusText: 'OK'
});
global.Promise.allSettled = async (promises) => {
    return Promise.all(promises).then(results => results.map(v => ({ status: 'fulfilled', value: v })));
};


// 2. Load app.js
const appJsPath = path.join(__dirname, '../app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// We need to access internal functions like renderRecords.
// Since app.js doesn't export them, and they are not all on window,
// we will inject a small helper at the end of the content before eval,
// or just rely on testing `refreshData` which is exposed.
// Testing `refreshData` is better as it tests the full flow.

// Execute app.js in global scope
eval(appJsContent);

// 3. Test Scenarios

async function runTest() {
    console.log("--- Testing refreshData robustness ---");

    // Scenario 1: Success (Empty Arrays)
    console.log("Scenario: Normal Response (Empty)");
    mockFetchResponse = {
        ok: true,
        json: async () => []
    };
    try {
        await window.refreshData();
        console.log("OK");
    } catch (e) {
        console.error("CRASHED:", e);
    }

    // Scenario 2: Success (Valid Records)
    console.log("Scenario: Normal Response (Valid Data)");
    mockFetchResponse = {
        ok: true,
        json: async () => [{ record_id: '1', type: '支出', amount: 100, description: 'Test', date: '2023-01-01', payer_id: 'Dan' }]
    };
    try {
        await window.refreshData();
        console.log("OK");
    } catch (e) {
        console.error("CRASHED:", e);
    }

    // Scenario 3: API returns Object instead of Array (The Vulnerability)
    console.log("Scenario: API returns Object (Unexpected)");
    mockFetchResponse = {
        ok: true,
        json: async () => ({ error: "Some unexpected object" })
    };
    try {
        await window.refreshData();
        console.log("OK (Handled gracefully if no crash)");
    } catch (e) {
        console.error("CRASHED:", e);
        process.exit(1);
    }

    // Scenario 4: API returns Null (The Vulnerability)
    console.log("Scenario: API returns Null");
    mockFetchResponse = {
        ok: true,
        json: async () => null
    };
    try {
        await window.refreshData();
        console.log("OK (Handled gracefully if no crash)");
    } catch (e) {
        console.error("CRASHED:", e);
        process.exit(1);
    }

    console.log("\nAll tests passed!");
}

runTest();
