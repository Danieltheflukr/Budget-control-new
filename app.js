// Global state
const API_URL = '/api/records';
const memoList = document.getElementById('memoList');
const totalExpenseDisplay = document.getElementById('totalExpenseDisplay');
let expenseChartInstance = null;
const BUDGET_LIMIT = 30000;

// --- 1. EVENT DELEGATION (From perf branch) ---
// This improves performance by using one listener instead of N listeners.
if (memoList) {
    memoList.addEventListener('click', (e) => {
        // Check if clicked element is (or is inside) a delete button
        const btn = e.target.closest('.delete-btn');
        if (!btn) return;

        e.stopPropagation();

        const card = btn.closest('.glass-card');
        if (card && card.dataset.id) {
            if (confirm('Delete this record?')) {
                deleteRecord(card.dataset.id);
            }
        }
    });
}

// --- 2. INITIALIZATION (From main branch) ---
document.addEventListener('DOMContentLoaded', () => {
    refreshData();
    
    // Set default date to today
    const dateInput = document.querySelector('input[name="date"]');
    if(dateInput) {
        dateInput.valueAsDate = new Date();
    }
});

function refreshData() {
    loadRecords();
    // loadSettlement(); // Assuming these exist in other parts of main
    // loadStats();
}

// --- 3. API UTILS (From main branch) ---
async function apiFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        alert('Failed to load data: ' + error.message);
        return null;
    }
}

// --- 4. RENDER LOGIC (Merged) ---
// Uses Main's UI styling but adds Perf's data attributes for delegation
async function loadRecords() {
    const records = await apiFetch(`${API_URL}?limit=50`);
    if (!memoList || !records) return;

    memoList.innerHTML = '';
    
    let totalExpense = 0;

    records.forEach(record => {
        if (record.type === '支出') {
            totalExpense += parseFloat(record.amount);
        }

        const card = document.createElement('div');
        // Combined classes: Main's styling + Perf's need for relative positioning if necessary
        card.className = 'glass-card p-4 rounded-xl flex justify-between items-center transition-all hover:bg-white/5 group';
        card.dataset.id = record.record_id; // CRITICAL: For event delegation

        // Left Side (Info)
        const left = document.createElement('div');
        const title = document.createElement('h4');
        title.className = 'font-semibold text-white mb-1';
        title.textContent = record.description;

        const meta = document.createElement('div');
        meta.className = 'text-xs text-slate-400 flex gap-2 items-center';

        const dateSpan = document.createElement('span');
        dateSpan.textContent = new Date(record.date).toLocaleDateString();

        const categorySpan = document.createElement('span');
        categorySpan.className = 'text-cyan-400 font-medium';
        categorySpan.textContent = record.category || 'General';

        const payerSpan = document.createElement('span');
        payerSpan.className = 'bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700';
        payerSpan.textContent = record.payer_id || record.member;

        meta.appendChild(dateSpan);
        meta.appendChild(categorySpan);
        meta.appendChild(payerSpan);

        left.appendChild(title);
        left.appendChild(meta);

        // Right Side (Amount + Delete)
        const right = document.createElement('div');
        right.className = 'text-right flex flex-col items-end';

        const amount = document.createElement('div');
        amount.className = `font-bold text-lg ${record.type === '支出' ? 'text-white' : 'text-emerald-400'}`;
        amount.textContent = `${record.type === '支出' ? '-' : '+'}$${parseFloat(record.amount).toFixed(2)}`;

        const deleteBtn = document.createElement('button');
        // Added 'delete-btn' class for delegation targeting
        deleteBtn.className = 'delete-btn text-slate-600 hover:text-red-400 text-xs mt-1 transition-colors p-1 opacity-0 group-hover:opacity-100'; 
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        
        // NOTE: onclick handler removed here in favor of delegation above

        right.appendChild(amount);
        right.appendChild(deleteBtn);

        card.appendChild(left);
        card.appendChild(right);

        memoList.appendChild(card);
    });

    if(totalExpenseDisplay) {
        totalExpenseDisplay.textContent = `$${totalExpense.toFixed(2)}`;
    }
}

// --- 5. ACTIONS ---

async function deleteRecord(id) {
    // Using main's apiFetch wrapper for better error handling
    const res = await apiFetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
    if (res) {
        loadRecords(); // Reload
    }
}

async function handleAddRecord(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    data.amount = parseFloat(data.amount);
    if (!data.category) data.category = 'General';
    
    const res = await apiFetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });

    if (res) {
        if(window.closeModal) window.closeModal();
        e.target.reset();
        loadRecords();
    }
}

// --- 6. UTILITIES & BENCHMARK ---

function createSafeElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

// Benchmark tool from perf branch
function runBenchmark(count = 1000) {
    const dummyRecords = Array.from({ length: count }, (_, i) => ({
        record_id: `bench-${i}`,
        type: i % 2 === 0 ? '支出' : '收入',
        category: 'Benchmark',
        description: `Benchmark Item ${i}`,
        amount: Math.random() * 100,
        payer_id: 'TestUser',
        date: '2023-01-01'
    }));

    console.time('Render Time');
    // We mock the fetch for benchmark purposes or just call the internal render logic
    // For this snippet, we'll just inject them to test DOM speed
    const oldFetch = window.apiFetch;
    window.apiFetch = async () => dummyRecords; 
    loadRecords().then(() => {
        console.timeEnd('Render Time');
        console.log(`Rendered ${count} items.`);
        window.apiFetch = oldFetch; // Restore
    });
}

// Expose needed functions
window.handleAddRecord = handleAddRecord;
window.refreshData = refreshData;
window.runBenchmark = runBenchmark;