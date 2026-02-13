// Global State
let expenseChartInstance = null;
const API_BASE = '/api';
const GROUP_ID = 'group_default'; // Default group

// DOM Elements
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

// Helper: Create Safe Element to prevent XSS
function createSafeElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
}

// Helper: Format Currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// 1. Initialization
document.addEventListener('DOMContentLoaded', () => {
    refreshData();
});

// 2. Fetch & Refresh Data
async function refreshData() {
    try {
        // Fetch all data in parallel
        // Use Promise.allSettled to ensure one failure doesn't break everything
        const [recordsRes, statsRes, settlementRes] = await Promise.allSettled([
            fetch(`${API_BASE}/records?group_id=${GROUP_ID}`),
            fetch(`${API_BASE}/stats?group_id=${GROUP_ID}`),
            fetch(`${API_BASE}/settlement?group_id=${GROUP_ID}`)
        ]);

        // Process Records
        if (recordsRes.status === 'fulfilled' && recordsRes.value.ok) {
            const records = await recordsRes.value.json();
            // Handle 503 retry signal from backend (table creation)
            if (records && records.error && records.error.includes("retry")) {
                console.log("Tables creating... retrying in 2s");
                setTimeout(refreshData, 2000);
                return;
            }
            renderRecords(records);
        } else {
            console.error("Records fetch failed", recordsRes);
            if (recordsRes.value && recordsRes.value.status === 503) {
                 setTimeout(refreshData, 2000);
                 return;
            }
        }

        // Process Stats
        if (statsRes.status === 'fulfilled') {
            if (statsRes.value.ok) {
                const stats = await statsRes.value.json();
                renderStats(stats);
            } else {
                 console.error("Stats fetch failed with status", statsRes.value.status);
                 renderStats([]);
            }
        } else {
            console.error("Stats fetch network failed");
            renderStats([]);
        }

        // Process Settlement
        if (settlementRes.status === 'fulfilled') {
            if (settlementRes.value.ok) {
                const settlement = await settlementRes.value.json();
                renderSettlement(settlement);
            } else {
                 console.error("Settlement fetch failed with status", settlementRes.value.status);
                 renderSettlement({balances: []});
            }
        } else {
             console.error("Settlement fetch network failed");
             renderSettlement({balances: []});
        }

    } catch (error) {
        console.error('Error fetching data:', error);
        // Don't alert immediately on load, as it might be temporary network issue
    }
}

// 3. Render Records
function renderRecords(records) {
    elements.memoList.innerHTML = '';

    if (!Array.isArray(records)) {
        console.error("renderRecords expected an array but got:", records);
        elements.memoList.appendChild(
            createSafeElement('div', 'text-center text-red-500 py-4', 'Error loading records.')
        );
        return;
    }

    if (records.length === 0) {
        elements.memoList.appendChild(
            createSafeElement('div', 'text-center text-slate-500 py-4', 'No records found.')
        );
        return;
    }

    records.forEach(r => {
        const isExpense = r.type === '支出';
        const amountClass = isExpense ? 'text-red-400' : 'text-green-400';
        const amountSign = isExpense ? '-' : '+';

        const card = createSafeElement('div', 'glass-card record-card');

        // Left Side: Icon & Info
        const leftDiv = document.createElement('div');
        leftDiv.className = 'record-left';

        // Icon based on category (simple mapping)
        const iconContainer = document.createElement('div');
        iconContainer.className = 'record-icon';
        iconContainer.textContent = isExpense ? '🛍️' : '💳';

        const infoDiv = document.createElement('div');
        const descEl = createSafeElement('h4', 'font-bold text-white', r.description);
        const metaEl = createSafeElement('p', 'text-xs text-slate-400', `${r.date} • ${r.payer_id}`);

        infoDiv.appendChild(descEl);
        infoDiv.appendChild(metaEl);

        leftDiv.appendChild(iconContainer);
        leftDiv.appendChild(infoDiv);

        // Right Side: Amount & Delete
        const rightDiv = document.createElement('div');
        rightDiv.className = 'record-right';

        const amountEl = createSafeElement('p', `font-bold ${amountClass}`, `${amountSign}${formatCurrency(r.amount)}`);
        const categoryEl = createSafeElement('p', 'text-xs text-slate-500', r.category);

        rightDiv.appendChild(amountEl);
        rightDiv.appendChild(categoryEl);

        // Delete Button (absolute positioned, shows on hover/focus)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '🗑';
        deleteBtn.onclick = () => deleteRecord(r.record_id);

        card.appendChild(leftDiv);
        card.appendChild(rightDiv);
        card.appendChild(deleteBtn);

        elements.memoList.appendChild(card);
    });
}

// 4. Render Stats (Chart + Total)
function renderStats(stats) {
    // stats is array: [{category, value}, ...]

    if (!Array.isArray(stats)) {
        console.error("renderStats expected an array but got:", stats);
        return;
    }
    
    // Calculate total expense
    const totalExpense = stats.reduce((sum, item) => sum + item.value, 0);
    elements.totalExpenseDisplay.textContent = formatCurrency(totalExpense);

    // Update Budget (Hardcoded 30,000 for now based on HTML)
    const budget = 30000;
    const percentage = Math.min((totalExpense / budget) * 100, 100).toFixed(1);

    elements.budgetProgress.style.width = `${percentage}%`;
    elements.budgetPercentage.textContent = `${percentage}%`;

    // Color code progress bar
    if (percentage > 90) {
        elements.budgetProgress.className = 'progress-bar progress-danger';
    } else {
        elements.budgetProgress.className = 'progress-bar';
    }

    // Render Chart
    if (elements.expenseChartCanvas) {
        if (expenseChartInstance) {
            expenseChartInstance.destroy();
        }

        const ctx = elements.expenseChartCanvas.getContext('2d');
        expenseChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: stats.map(s => s.category),
                datasets: [{
                    data: stats.map(s => s.value),
                    backgroundColor: [
                        '#3b82f6', '#06b6d4', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                cutout: '70%'
            }
        });
    }
}

// 5. Render Settlement
function renderSettlement(data) {
    // data: { total, perPerson, balances: [{id, name, paid, balance}] }
    elements.settlementContainer.innerHTML = '';

    if (!data || !data.balances || data.balances.length === 0) {
        elements.settlementContainer.innerHTML = '<div class="text-center text-slate-500">No settlement data available.</div>';
        return;
    }

    data.balances.forEach(b => {
        const card = createSafeElement('div', 'glass-card settlement-card');

        // Member Info
        const leftDiv = document.createElement('div');
        leftDiv.className = 'settlement-left';
        const avatar = createSafeElement('div', 'avatar', b.name.charAt(0));
        const nameDiv = document.createElement('div');
        nameDiv.appendChild(createSafeElement('p', 'text-sm font-bold text-white', b.name));
        nameDiv.appendChild(createSafeElement('p', 'text-xs text-slate-400', `Paid: ${formatCurrency(b.paid)}`));

        leftDiv.appendChild(avatar);
        leftDiv.appendChild(nameDiv);

        // Balance Info
        const rightDiv = document.createElement('div');
        rightDiv.className = 'settlement-right';

        const isPositive = b.balance >= 0;
        const colorClass = isPositive ? 'text-green-400' : 'text-red-400';
        const labelText = isPositive ? 'Receives' : 'Pays';

        rightDiv.appendChild(createSafeElement('p', `text-sm font-bold ${colorClass}`, formatCurrency(Math.abs(b.balance))));
        rightDiv.appendChild(createSafeElement('p', 'text-xs text-slate-500', labelText));

        card.appendChild(leftDiv);
        card.appendChild(rightDiv);

        elements.settlementContainer.appendChild(card);
    });
}

// 6. UI Interactions
function openModal() {
    elements.addRecordModal.classList.remove('hidden');
}

function closeModal() {
    elements.addRecordModal.classList.add('hidden');
    elements.recordForm.reset();
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target === elements.addRecordModal) {
        closeModal();
    }
};

// 7. Handle Add Record
async function handleAddRecord(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data = {
        type: formData.get('type'),
        amount: parseFloat(formData.get('amount')),
        description: formData.get('description'),
        category: String(formData.get('category') || '').trim() || 'General',
        payer_id: formData.get('payer_id'),
        date: formData.get('date'),
        group_id: GROUP_ID
    };

    // Auto-categorize only when user chooses Auto Detect
    const desc = data.description.toLowerCase();
    if (!formData.get('category')) {
        if (desc.includes('food') || desc.includes('lunch') || desc.includes('dinner')) data.category = 'Food';
        else if (desc.includes('transport') || desc.includes('uber') || desc.includes('bus')) data.category = 'Transport';
        else if (desc.includes('bill') || desc.includes('electric')) data.category = 'Utilities';
        else if (desc.includes('shop') || desc.includes('buy')) data.category = 'Shopping';
        else if (desc.includes('movie') || desc.includes('game') || desc.includes('netflix')) data.category = 'Entertainment';
        else if (desc.includes('flight') || desc.includes('hotel') || desc.includes('trip')) data.category = 'Travel';
    }

    try {
        const res = await fetch(`${API_BASE}/records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            closeModal();
            refreshData(); // Reload everything
        } else {
            const err = await res.json();
            alert(`Error: ${err.error}`);
        }
    } catch (error) {
        console.error('Error adding record:', error);
        alert('Failed to add record.');
    }
}

// 8. Handle Delete Record
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

// Expose functions to global scope for HTML inline events (onclick)
window.refreshData = refreshData;
window.openModal = openModal;
window.closeModal = closeModal;
window.handleAddRecord = handleAddRecord;
window.deleteRecord = deleteRecord;
