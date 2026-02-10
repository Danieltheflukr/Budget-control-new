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

    // Update Total Expense Display
    const totalDisplay = document.getElementById('totalExpenseDisplay');
    if (totalDisplay) totalDisplay.textContent = `$${totalExpense.toFixed(2)}`;

    // Update Budget Progress
    updateBudgetProgress(totalExpense);
}

function updateBudgetProgress(total) {
    const percentage = Math.min((total / BUDGET_LIMIT) * 100, 100);
    const progressEl = document.getElementById('budgetProgress');
    const percentText = document.getElementById('budgetPercentage');
    
    if (progressEl) progressEl.style.width = `${percentage}%`;
    if (percentText) percentText.textContent = `${percentage.toFixed(1)}% used of $${BUDGET_LIMIT.toLocaleString()}`;
}

async function handleAddRecord(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    
    const data = Object.fromEntries(formData.entries());
    
    // Add loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const result = await apiFetch('/api/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (result && result.success) {
            closeModal();
            form.reset();
            // Reset date to today
            const dateInput = form.querySelector('input[name="date"]');
            if(dateInput) dateInput.valueAsDate = new Date();
            refreshData();
        }
    } catch (e) {
        alert('Error saving record');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

async function deleteRecord(id) {
    const result = await apiFetch(`/api/records?id=${id}`, { method: 'DELETE' });
    if (result && result.success) {
        refreshData();
    }
}

// --- Settlement ---

async function loadSettlement() {
    const data = await apiFetch('/api/settlement');
    const container = document.getElementById('settlementContainer');
    if (!container || !data) return;

    container.innerHTML = '';

    if (!data.balances || data.balances.length === 0) {
        container.innerHTML = '<div class="glass-card p-4 rounded-xl text-slate-400 text-center italic text-sm">No settlement data yet</div>';
        return;
    }

    // Calculate simplified debts
    // Balances: positive = receives, negative = owes
    // Clone data to avoid modifying original balances for display
    let debtors = data.balances.filter(b => b.balance < -0.01).map(b => ({ ...b, balance: Math.abs(b.balance) }));
    let creditors = data.balances.filter(b => b.balance > 0.01).map(b => ({ ...b }));

    // Sort by magnitude to optimize matching
    debtors.sort((a, b) => b.balance - a.balance);
    creditors.sort((a, b) => b.balance - a.balance);

    const transfers = [];
    let i = 0; // debtor index
    let j = 0; // creditor index

    while (i < debtors.length && j < creditors.length) {
        let debt = debtors[i];
        let credit = creditors[j];

        let amount = Math.min(debt.balance, credit.balance);

        transfers.push({
            from: debt.name,
            to: credit.name,
            amount: amount
        });

        debt.balance -= amount;
        credit.balance -= amount;

        if (debt.balance < 0.01) i++;
        if (credit.balance < 0.01) j++;
    }

    // Render Transfers (Action Plan)
    if (transfers.length > 0) {
        const planDiv = document.createElement('div');
        planDiv.className = 'glass-card p-5 rounded-2xl border border-cyan-500/20 shadow-lg shadow-cyan-900/20';
        planDiv.innerHTML = '<h4 class="text-cyan-400 text-xs font-bold mb-4 uppercase tracking-wider flex items-center"><i class="fas fa-exchange-alt mr-2"></i> Settlement Plan</h4>';

        transfers.forEach(t => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between py-3 border-b border-cyan-500/10 last:border-0';

            const text = document.createElement('div');
            text.className = 'flex items-center gap-2 text-sm';
            text.innerHTML = `
                <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-white border border-slate-700">${t.from.charAt(0)}</div>
                <div class="text-slate-400 text-xs"><i class="fas fa-arrow-right text-cyan-500/50"></i></div>
                <div class="w-8 h-8 rounded-full bg-cyan-900/50 flex items-center justify-center text-xs font-bold text-cyan-200 border border-cyan-700/50">${t.to.charAt(0)}</div>
            `;

            const amt = document.createElement('div');
            amt.className = 'text-cyan-300 font-bold text-lg';
            amt.textContent = `$${t.amount.toFixed(2)}`;

            row.appendChild(text);
            row.appendChild(amt);
            planDiv.appendChild(row);
        });
        container.appendChild(planDiv);
    } else {
         const planDiv = document.createElement('div');
        planDiv.className = 'glass-card p-4 rounded-xl text-center text-emerald-400 font-medium flex items-center justify-center gap-2';
        planDiv.innerHTML = '<i class="fas fa-check-circle"></i> All settled up!';
        container.appendChild(planDiv);
    }

    // Render Balances (Status) - Minimalist
    const statusDiv = document.createElement('div');
    statusDiv.className = 'glass-card p-4 rounded-xl mt-3';
    statusDiv.innerHTML = '<h4 class="text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Current Balances</h4>';

    data.balances.forEach(b => {
        const row = document.createElement('div');
        row.className = 'flex justify-between items-center py-2 text-sm';

        const name = document.createElement('span');
        name.className = 'text-slate-300';
        name.textContent = b.name;

        const bal = document.createElement('span');
        const isPositive = b.balance >= 0;
        bal.className = isPositive ? 'text-emerald-400' : 'text-rose-400';
        bal.textContent = `${isPositive ? '+' : ''}$${b.balance.toFixed(2)}`;

        row.appendChild(name);
        row.appendChild(bal);
        statusDiv.appendChild(row);
    });
    container.appendChild(statusDiv);
}

// --- Stats (Chart) ---

async function loadStats() {
    const stats = await apiFetch('/api/stats');
    if (!stats) return;

    const ctx = document.getElementById('expenseChart');
    if (!ctx) return;

    const labels = stats.map(s => s.category);
    const data = stats.map(s => s.value);

    // Luxury Palette
    const backgroundColors = [
        '#06b6d4', // Cyan 500
        '#3b82f6', // Blue 500
        '#8b5cf6', // Violet 500
        '#ec4899', // Pink 500
        '#f43f5e', // Rose 500
        '#f59e0b', // Amber 500
    ];

    if (expenseChartInstance) {
        expenseChartInstance.destroy();
    }

    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: true,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1
                }
            },
            cutout: '75%'
        }
    });
}

// --- Modal ---

function openModal() {
    const modal = document.getElementById('addRecordModal');
    modal.classList.remove('hidden');
    // Animate content up
    setTimeout(() => {
        const content = document.getElementById('modalContent');
        content.classList.remove('translate-y-full');
    }, 10);
}

function closeModal() {
    const content = document.getElementById('modalContent');
    content.classList.add('translate-y-full');
    
    setTimeout(() => {
        const modal = document.getElementById('addRecordModal');
        modal.classList.add('hidden');
    }, 300);
}

// Utility
function createSafeElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}
