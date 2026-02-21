const fs = require('fs');
const path = require('path');

console.log("Running Integration Verification for app.js (Module Mode via Window)...\n");

// 1. Setup Mock Environment

// Mock DOM
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
    createElement: (tag) => {
        if (tag === 'i') {
             return { tagName: 'I', className: '' };
        }
        return {
        tagName: tag.toUpperCase(),
        className: '',
        appendChild: () => {},
        textContent: '',
        style: {},
        innerHTML: '',
        classList: { add: () => {}, remove: () => {} },
        addEventListener: () => {} // Mock for deleteBtn
    }},
    createDocumentFragment: () => ({
        appendChild: () => {}
    }),
    addEventListener: (event, callback) => {
        // We manually trigger events if needed
    }
};

// Mock Global Objects
global.document = document;
global.window = {
    onclick: null,
    location: { reload: () => {} },
    confirm: () => true,
    alert: (msg) => console.log("Alert:", msg),
    // Simulate other browser globals if needed
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

// Mock Promise.allSettled (Correct Implementation)
if (!Promise.allSettled) {
    Promise.allSettled = (promises) =>
        Promise.all(
            promises.map((p) =>
                Promise.resolve(p).then(
                    (value) => ({
                        status: "fulfilled",
                        value,
                    }),
                    (reason) => ({
                        status: "rejected",
                        reason,
                    })
                )
            )
        );
}

// 2. Load app.js
const appJsPath = path.join(__dirname, '../app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// Execute app.js in global scope
try {
    eval(appJsContent);
} catch (e) {
    console.error("Error evaluating app.js:", e);
}

// 3. Test Scenarios

async function runTest() {
    console.log("--- Testing refreshData robustness ---");

    // Check if function exists
    if (typeof window.refreshData !== 'function') {
        console.error("FATAL: window.refreshData is not defined. App.js failed to load or export.");
        process.exit(1);
    }

    const app = window; // Use window as our app interface

    // Scenario 1: Success (Empty Arrays)
    console.log("Scenario: Normal Response (Empty)");
    mockFetchResponse = {
        ok: true,
        json: async () => []
    };
    try {
        await app.refreshData();
        console.log("OK");
    } catch (e) {
        console.error("CRASHED:", e);
        process.exit(1);
    }

    // Scenario 2: Success (Valid Records)
    console.log("Scenario: Normal Response (Valid Data)");
    mockFetchResponse = {
        ok: true,
        json: async () => [{ record_id: '1', type: '支出', amount: 100, description: 'Test', date: '2023-01-01', payer_id: 'Dan' }]
    };
    try {
        await app.refreshData();
        console.log("OK");
    } catch (e) {
        console.error("CRASHED:", e);
        process.exit(1);
    }

    // Scenario 3: API returns Object instead of Array (The Vulnerability)
    console.log("Scenario: API returns Object (Unexpected)");
    mockFetchResponse = {
        ok: true,
        json: async () => ({ error: "Some unexpected object" })
    };
    try {
        await app.refreshData();
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
        await app.refreshData();
        console.log("OK (Handled gracefully if no crash)");
    } catch (e) {
        console.error("CRASHED:", e);
        process.exit(1);
    }

    console.log("\nAll tests passed!");
}

runTest();
