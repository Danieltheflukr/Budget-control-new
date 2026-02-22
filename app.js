// Global state
let expenseChartInstance = null;
const BUDGET_LIMIT = 30000; // Default monthly budget

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
    loadSettlement();
    loadStats();
}

// --- API Calls ---

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

// --- Records ---

async function loadRecords() {
    const records = await apiFetch('/api/records?limit=20');
    const container = document.getElementById('memoList');
    if (!container || !records) return;

    container.innerHTML = '';

    let totalExpense = 0;

    records.forEach(record => {
        if (record.type === '支出') {
            totalExpense += parseFloat(record.amount);
        }

        const card = document.createElement('div');
        card.className = 'glass-card p-4 rounded-xl flex justify-between items-center transition-all hover:bg-white/5';

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
        categorySpan.textContent = record.category;

        const payerSpan = document.createElement('span');
        payerSpan.className = 'bg-slate-800 px-2 py-0.5 rounded text-slate-300 border border-slate-700';
        payerSpan.textContent = record.payer_id || record.member;

        meta.appendChild(dateSpan);
        meta.appendChild(categorySpan);
        meta.appendChild(payerSpan);

        left.appendChild(title);
        left.appendChild(meta);

        const right = document.createElement('div');
        right.className = 'text-right';

        const amount = document.createElement('div');
        amount.className = `font-bold text-lg ${record.type === '支出' ? 'text-white' : 'text-emerald-400'}`;
        amount.textContent = `${record.type === '支出' ? '-' : '+'}$${parseFloat(record.amount).toFixed(2)}`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'text-slate-600 hover:text-red-400 text-xs mt-1 transition-colors p-1';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if(confirm('Delete this record?')) deleteRecord(record.record_id);
        };

        right.appendChild(amount);
        right.appendChild(deleteBtn);

        card.appendChild(left);
        card.appendChild(right);
        container.appendChild(card);
    });

    // 4. 組裝並放入清單
    card.appendChild(content);
    card.appendChild(deleteBtn);
    list.appendChild(card);
});

// 通用的安全元素建立工具
function createSafeElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text; // 確保 XSS 安全
    return el;
}
