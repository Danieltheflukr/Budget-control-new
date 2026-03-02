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
    // Inject default header for local dev/testing
    if (!options.headers) {
        options.headers = {};
    }
    if (!options.headers['X-Member-Id']) {
        options.headers['X-Member-Id'] = 'Daniel';
    }

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

    updateBudgetUI(totalExpense);
}

// 通用的安全元素建立工具
function createSafeElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text; // 確保 XSS 安全
    return el;
}

// --- UI Management ---

function updateBudgetUI(totalExpense) {
    const display = document.getElementById('totalExpenseDisplay');
    if (display) {
        display.textContent = `$${totalExpense.toFixed(2)}`;
    }

    const progress = document.getElementById('budgetProgress');
    const percentageText = document.getElementById('budgetPercentage');

    if (progress && percentageText) {
        let percentage = (totalExpense / BUDGET_LIMIT) * 100;
        // Cap at 100% for the progress bar visual
        let visualPercentage = Math.min(percentage, 100);

        progress.style.width = `${visualPercentage}%`;
        percentageText.textContent = `${percentage.toFixed(1)}%`;

        // Change color if over budget
        if (percentage >= 100) {
            progress.classList.remove('from-blue-500', 'to-cyan-400');
            progress.classList.add('from-red-500', 'to-orange-400');
        } else {
            progress.classList.remove('from-red-500', 'to-orange-400');
            progress.classList.add('from-blue-500', 'to-cyan-400');
        }
    }
}

function openModal() {
    const modal = document.getElementById('addRecordModal');
    const content = document.getElementById('modalContent');
    if (modal && content) {
        modal.classList.remove('hidden');
        // Small delay to allow display:block to apply before animating transform
        setTimeout(() => {
            content.classList.remove('translate-y-full');
            content.classList.add('translate-y-0');
        }, 10);
    }
}

function closeModal() {
    const modal = document.getElementById('addRecordModal');
    const content = document.getElementById('modalContent');
    if (modal && content) {
        content.classList.remove('translate-y-0');
        content.classList.add('translate-y-full');
        // Wait for animation to finish before hiding
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
}

// --- Data Interactions ---

async function deleteRecord(id) {
    const result = await apiFetch(`/api/records?id=${id}`, {
        method: 'DELETE'
    });
    if (result && result.success) {
        refreshData();
    }
}

async function loadSettlement() {
    const data = await apiFetch('/api/settlement');
    const container = document.getElementById('settlementContainer');
    if (!container || !data) return;

    container.innerHTML = '';

    // Summary block
    const summaryCard = document.createElement('div');
    summaryCard.className = 'glass-card p-4 rounded-xl flex justify-between items-center bg-blue-500/10 border border-blue-500/20';
    summaryCard.innerHTML = `
        <div class="text-xs text-blue-200">Group Total</div>
        <div class="font-bold text-lg text-blue-400">$${(data.total || 0).toFixed(2)}</div>
    `;
    container.appendChild(summaryCard);

    // Individual balances
    if (data.balances && data.balances.length > 0) {
        data.balances.forEach(b => {
            const bCard = document.createElement('div');
            bCard.className = 'glass-card p-3 rounded-xl flex justify-between items-center';

            const isOwed = b.balance > 0;
            const balanceColor = isOwed ? 'text-emerald-400' : 'text-red-400';
            const balanceSign = isOwed ? '+' : '';

            bCard.innerHTML = `
                <div>
                    <div class="font-semibold text-white">${b.name}</div>
                    <div class="text-xs text-slate-400">Paid: $${b.paid.toFixed(2)}</div>
                </div>
                <div class="text-right">
                    <div class="font-bold ${balanceColor}">${balanceSign}$${b.balance.toFixed(2)}</div>
                </div>
            `;
            container.appendChild(bCard);
        });
    }

    // Message block
    const msgCard = document.createElement('div');
    msgCard.className = 'glass-card p-4 rounded-xl mt-2 text-center text-sm text-cyan-200 bg-cyan-500/10 border border-cyan-500/20 font-medium';
    msgCard.textContent = data.message || "Settled up!";
    container.appendChild(msgCard);
}

async function loadStats() {
    const stats = await apiFetch('/api/stats');
    if (!stats) return;

    const ctx = document.getElementById('expenseChart');
    if (!ctx) return;

    const labels = stats.map(s => s.category);
    const data = stats.map(s => s.value);

    // Generate colors based on length
    const colors = [
        '#3b82f6', '#06b6d4', '#10b981', '#f59e0b',
        '#ef4444', '#8b5cf6', '#ec4899', '#64748b'
    ];
    const bgColors = labels.map((_, i) => colors[i % colors.length]);

    if (expenseChartInstance) {
        expenseChartInstance.destroy();
    }

    // Adjust chart global defaults for dark theme
    Chart.defaults.color = '#94a3b8';

    expenseChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: bgColors,
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false // Hide legend to save space
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(51, 65, 85, 0.5)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed);
                            }
                            return label;
                        }
                    }
                }
            },
            cutout: '70%'
        }
    });
}

async function handleAddRecord(event) {
    event.preventDefault();
    const form = event.target;

    // Quick validation
    const amount = parseFloat(form.amount.value);
    if (isNaN(amount) || amount <= 0) {
        alert("Please enter a valid amount greater than 0.");
        return;
    }

    const payload = {
        type: form.type.value,
        amount: amount,
        category: form.category.value,
        description: form.description.value,
        payer_id: form.payer_id.value,
        date: form.date.value
    };

    const result = await apiFetch('/api/records', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (result && result.success) {
        form.reset();
        // Reset date to today after submit
        form.date.valueAsDate = new Date();
        closeModal();
        refreshData();
    }
}
