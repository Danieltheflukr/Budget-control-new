// --- CONFIGURATION & STATE ---
const API_BASE = '/api';
const GROUP_ID = 'group_default';
const BUDGET_LIMIT = 30000;
let expenseChartInstance = null;

// --- DOM ELEMENTS ---
const elements = {
    memoList: document.getElementById('memoList'),
    totalExpenseDisplay: document.getElementById('totalExpenseDisplay'),
    budgetDisplay: document.getElementById('budgetDisplay'),
    budgetProgress: document.getElementById('budgetProgress'),
    budgetPercentage: document.getElementById('budgetPercentage'),
    settlementContainer: document.getElementById('settlementContainer'),
    addRecordModal: document.getElementById('addRecordModal'),
    recordForm: document.getElementById('recordForm'),
    expenseChartCanvas: document.getElementById('expenseChart')
};

// --- 1. UTILITIES ---

function createSafeElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// --- 2. INITIALIZATION & LISTENERS ---

document.addEventListener('DOMContentLoaded', () => {
    refreshData();

    // Set default date to today
    const dateInput = document.querySelector('input[name="date"]');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }
});

// Event Delegation for Delete Buttons (Performance Optimization)
if (elements.memoList) {
    elements.memoList.addEventListener('click', (e) => {
        // Look for the delete button (or its icon children)
        const btn = e.target.closest('.delete-btn');
        if (!btn) return;

        e.stopPropagation();

        // Find the parent card to get the ID
        const card = btn.closest('.glass-card');
        if (card && card.dataset.id) {
            deleteRecord(card.dataset.id);
        }
    });
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target === elements.addRecordModal) {
        closeModal();
    }
};

// --- 3. DATA FETCHING ---

async function refreshData() {
    try {
        // Fetch all data in parallel
        const [recordsRes, statsRes, settlementRes] = await Promise.all([
            fetch(`${API_BASE}/records?group_id=${GROUP_ID}`),
            fetch(`${API_BASE}/stats?group_id=${GROUP_ID}`),
            fetch(`${API_BASE}/settlement?group_id=${GROUP_ID}`)
        ]);

        const records = await recordsRes.json();
        const stats = await statsRes.json();
        const settlement = await settlementRes.json();

        renderRecords(records);
        renderStats(stats);
        renderSettlement(settlement);
    } catch (error) {
        console.error('Error fetching data:', error);
        alert('Failed to load data. Please try again.');
    }
}

// --- 4. RENDER FUNCTIONS ---

function renderRecords(records) {
    elements.memoList.innerHTML = '';

    if (!records || records.length === 0) {
        elements.memoList.appendChild(
            createSafeElement('div', 'text-center text-slate-500 py-4', 'No records found.')
        );
        return;
    }

    records.forEach(r => {
        const isExpense = r.type === '支出';
        const amountClass = isExpense ? 'text-red-400' : 'text-green-400';
        const amountSign = isExpense ? '-' : '+';

        // Container Card
        const card = createSafeElement('div', 'glass-card p-4 rounded-xl flex justify-between items-center relative group');
        // CRITICAL: Add ID for Event Delegation
        card.dataset.id = r.record_id;

        // Left Side: Icon & Info
        const leftDiv = document.createElement('div');
        leftDiv.className = 'flex items-center gap-3';

        // Icon
        const iconContainer = document.createElement('div');
        iconContainer.className = `w-10 h-10 rounded-full flex items-center justify-center ${isExpense ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`;
        const icon = document.createElement('i');
        icon.className = isExpense ? 'fas fa-shopping-bag' : 'fas fa-wallet';
        iconContainer.appendChild(icon);

        // Text Info
        const infoDiv = document.createElement('div');
        infoDiv.appendChild(createSafeElement('h4', 'font-bold text-white', r.description));
        infoDiv.appendChild(createSafeElement('p', 'text-xs text-slate-400', `${new Date(r.date).toLocaleDateString()} • ${r.payer_id}`));

        leftDiv.appendChild(iconContainer);
        leftDiv.appendChild(infoDiv);

        // Right Side: Amount & Category
        const rightDiv = document.createElement('div');
        rightDiv.className = 'text-right';
        rightDiv.appendChild(createSafeElement('p', `font-bold ${amountClass}`, `${amountSign}${formatCurrency(r.amount)}`));
        rightDiv.appendChild(createSafeElement('p', 'text-xs text-slate-500', r.category));

        // Delete Button (Class 'delete-btn' required for delegation)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn absolute top-2 right-2 text-slate-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';

        card.appendChild(leftDiv);
        card.appendChild(rightDiv);
        card.appendChild(deleteBtn);

        elements.memoList.appendChild(card);
    });
}

function renderStats(stats) {
    const totalExpense = stats.reduce((sum, item) => sum + item.value, 0);
    
    if(elements.totalExpenseDisplay) {
        elements.totalExpenseDisplay.textContent = formatCurrency(totalExpense);
    }

    // Update Budget Bar
    if (elements.budgetProgress) {
        const percentage = Math.min((totalExpense / BUDGET_LIMIT) * 100, 100).toFixed(1);
        elements.budgetProgress.style.width = `${percentage}%`;
        
        if (percentage > 90) {
            elements.budgetProgress.className = 'bg-red-500 h-2 rounded-full transition-all duration-500';
        } else {
            elements.budgetProgress.className = 'bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all duration-500';
        }
        
        if (elements.budgetPercentage) {
            elements.budgetPercentage.textContent = `${percentage}%`;
        }
    }

    // Render Chart
    if (elements.expenseChartCanvas) {
        if (expenseChartInstance) {
            expenseChartInstance.destroy();
        }

        const ctx = elements.expenseChartCanvas.getContext('2d');
        if (typeof Chart !== 'undefined') {
            expenseChartInstance = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: stats.map(s => s.category),
                    datasets: [{
                        data: stats.map(s => s.value),
                        backgroundColor: ['#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    cutout: '70%'
                }
            });
        }
    }
}

function renderSettlement(data) {
    elements.settlementContainer.innerHTML = '';

    if (!data.balances || data.balances.length === 0) {
        elements.settlementContainer.innerHTML = '<div class="text-center text-slate-500">No settlement data available.</div>';
        return;
    }

    data.balances.forEach(b => {
        const card = createSafeElement('div', 'glass-card p-3 rounded-xl flex justify-between items-center');

        // Left
        const leftDiv = document.createElement('div');
        leftDiv.className = 'flex items-center gap-3';
        const avatar = createSafeElement('div', 'w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white', b.name.charAt(0));
        const nameDiv = document.createElement('div');
        nameDiv.appendChild(createSafeElement('p', 'text-sm font-bold text-white', b.name));
        nameDiv.appendChild(createSafeElement('p', 'text-xs text-slate-400', `Paid: ${formatCurrency(b.paid)}`));
        leftDiv.appendChild(avatar);
        leftDiv.appendChild(nameDiv);

        // Right
        const rightDiv = document.createElement('div');
        rightDiv.className = 'text-right';
        const isPositive = b.balance >= 0;
        const colorClass = isPositive ? 'text-green-400' : 'text-red-400';
        rightDiv.appendChild(createSafeElement('p', `text-sm font-bold ${colorClass}`, formatCurrency(Math.abs(b.balance))));
        rightDiv.appendChild(createSafeElement('p', 'text-xs text-slate-500', isPositive ? 'Receives' : 'Pays'));

        card.appendChild(leftDiv);
        card.appendChild(rightDiv);
        elements.settlementContainer.appendChild(card);
    });
}

// --- 5. ACTIONS ---

function openModal() {
    elements.addRecordModal.classList.remove('hidden');
}

function closeModal() {
    elements.addRecordModal.classList.add('hidden');
    elements.recordForm.reset();
}

async function handleAddRecord(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data = {
        type: formData.get('type'),
        amount: parseFloat(formData.get('amount')),
        description: formData.get('description'),
        category: 'General',
        payer_id: formData.get('payer_id'),
        date: formData.get('date'),
        group_id: GROUP_ID
    };

    // Auto-categorize
    const desc = data.description.toLowerCase();
    if (desc.includes('food') || desc.includes('lunch')) data.category = 'Food';
    else if (desc.includes('transport') || desc.includes('uber')) data.category = 'Transport';
    else if (desc.includes('bill')) data.category = 'Utilities';
    else if (desc.includes('shop')) data.category = 'Shopping';

    try {
        const res = await fetch(`${API_BASE}/records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            closeModal();
            refreshData();
        } else {
            const err = await res.json();
            alert(`Error: ${err.error}`);
        }
    } catch (error) {
        console.error('Error adding record:', error);
        alert('Failed to add record.');
    }
}

async function deleteRecord(id) {
    if (!confirm('Are you sure you want to delete this record?')) return;

    try {
        const res = await fetch(`${API_BASE}/records?id=${id}&group_id=${GROUP_ID}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            refreshData();
        } else {
            alert('Failed to delete record.');
        }
    } catch (error) {
        console.error('Error deleting record:', error);
        alert('Error deleting record.');
    }
}

// --- 6. BENCHMARKING ---

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
    // Directly invoke render to test DOM performance
    renderRecords(dummyRecords);
    console.timeEnd('Render Time');
    console.log(`Rendered ${count} items.`);
}

// Expose to Global Scope (for HTML on click attributes)
window.refreshData = refreshData;
window.openModal = openModal;
window.closeModal = closeModal;
window.handleAddRecord = handleAddRecord;
window.deleteRecord = deleteRecord;
window.runBenchmark = runBenchmark;
