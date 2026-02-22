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
    // Init Date Picker with Today
    const dateInput = document.querySelector('input[name="date"]');
    if(dateInput && !dateInput.value) {
        dateInput.valueAsDate = new Date();
    }

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

    // Optimization: Use DocumentFragment
    const fragment = document.createDocumentFragment();

    records.forEach(r => {
        const isExpense = r.type === '支出';

        // Updated styling to match index.html prototype
        const card = createSafeElement('div', 'glass-card p-4 rounded-xl flex justify-between items-center relative group bg-slate-800/50 backdrop-blur-md border border-slate-700/50 hover:bg-slate-800/70 transition-all cursor-default mb-3');

        // Left Side: Icon & Info
        const leftDiv = document.createElement('div');
        leftDiv.className = 'flex items-center gap-4';

        // Icon based on category
        const iconContainer = document.createElement('div');
        const iconBg = isExpense ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400';
        iconContainer.className = `w-12 h-12 rounded-2xl flex items-center justify-center ${iconBg} shadow-inner`;

        const icon = document.createElement('i');
        // Simple icon mapping based on common categories
        let iconClass = 'fas fa-wallet';
        const cat = (r.category || '').toLowerCase();
        if (cat.includes('food')) iconClass = 'fas fa-utensils';
        else if (cat.includes('transport')) iconClass = 'fas fa-car';
        else if (cat.includes('util')) iconClass = 'fas fa-bolt';
        else if (cat.includes('shop')) iconClass = 'fas fa-shopping-bag';
        else if (cat.includes('entert')) iconClass = 'fas fa-film';
        else if (isExpense) iconClass = 'fas fa-receipt';

        icon.className = iconClass;
        iconContainer.appendChild(icon);

        const infoDiv = document.createElement('div');
        const descEl = createSafeElement('h4', 'font-bold text-white text-sm mb-0.5', r.description);
        const metaEl = createSafeElement('p', 'text-[10px] font-bold text-slate-500 uppercase tracking-wide', `${r.date} • ${r.payer_id}`);

        infoDiv.appendChild(descEl);
        infoDiv.appendChild(metaEl);

        leftDiv.appendChild(iconContainer);
        leftDiv.appendChild(infoDiv);

        // Right Side: Amount & Delete
        const rightDiv = document.createElement('div');
        rightDiv.className = 'text-right';

        const amountClass = isExpense ? 'text-rose-400' : 'text-emerald-400';
        const amountSign = isExpense ? '-' : '+';
        const amountEl = createSafeElement('p', `font-bold ${amountClass} text-base`, `${amountSign}${formatCurrency(r.amount)}`);
        const categoryEl = createSafeElement('p', 'text-[10px] text-slate-500 font-medium', r.category);

        rightDiv.appendChild(amountEl);
        rightDiv.appendChild(categoryEl);

        // Delete Button (absolute positioned, shows on hover/focus)
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'absolute top-3 right-3 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-full hover:bg-slate-700/50';
        deleteBtn.title = "Delete Record";

        const deleteIcon = document.createElement('i');
        deleteIcon.className = 'fas fa-trash-alt';
        deleteBtn.appendChild(deleteIcon);

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent card click if we add that later
            deleteRecord(r.record_id);
        });

        card.appendChild(leftDiv);
        card.appendChild(rightDiv);
        card.appendChild(deleteBtn);

        fragment.appendChild(card);
    });

    elements.memoList.appendChild(fragment);
}

// 4. Render Stats (Chart + Total)
function renderStats(stats) {
    if (!Array.isArray(stats)) {
        console.error("renderStats expected an array but got:", stats);
        return;
    }

    // Calculate total expense
    const totalExpense = stats.reduce((sum, item) => sum + item.value, 0);
    elements.totalExpenseDisplay.textContent = formatCurrency(totalExpense);

    // Update Budget (Hardcoded 30,000 for now)
    const budget = 30000;
    const percentage = Math.min((totalExpense / budget) * 100, 100).toFixed(1);

    elements.budgetProgress.style.width = `${percentage}%`;
    elements.budgetPercentage.textContent = `${percentage}% Used`;

    // Color code progress bar with improved gradients
    if (percentage > 90) {
        elements.budgetProgress.className = 'bg-gradient-to-r from-orange-500 to-red-500 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    } else {
        elements.budgetProgress.className = 'bg-gradient-to-r from-blue-500 via-cyan-400 to-teal-400 h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(6,182,212,0.5)]';
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
                        '#3b82f6', '#06b6d4', '#14b8a6', '#8b5cf6', '#f43f5e', '#f59e0b'
                    ],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#fff',
                        bodyColor: '#cbd5e1',
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: true
                    }
                },
                cutout: '75%',
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
    }
}

// 5. Render Settlement
function renderSettlement(data) {
    elements.settlementContainer.innerHTML = '';

    if (!data || !data.balances || data.balances.length === 0) {
        elements.settlementContainer.innerHTML = `
            <div class="glass-card p-6 rounded-xl text-center border-dashed border border-slate-700/50">
                <i class="fas fa-check-circle text-slate-600 text-2xl mb-2"></i>
                <p class="text-xs text-slate-500 font-medium">No settlement data available.</p>
            </div>`;
        return;
    }

    data.balances.forEach(b => {
        const card = createSafeElement('div', 'glass-card p-4 rounded-xl flex justify-between items-center mb-2');

        // Member Info
        const leftDiv = document.createElement('div');
        leftDiv.className = 'flex items-center gap-3';

        // Avatar
        const avatar = createSafeElement('div', 'w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-sm font-bold text-white shadow-lg border border-slate-600', b.name.charAt(0));

        const nameDiv = document.createElement('div');
        nameDiv.appendChild(createSafeElement('p', 'text-sm font-bold text-white', b.name));
        nameDiv.appendChild(createSafeElement('p', 'text-[10px] text-slate-400 uppercase tracking-wide', `Paid: ${formatCurrency(b.paid)}`));

        leftDiv.appendChild(avatar);
        leftDiv.appendChild(nameDiv);

        // Balance Info
        const rightDiv = document.createElement('div');
        rightDiv.className = 'text-right';

        const isPositive = b.balance >= 0;
        const colorClass = isPositive ? 'text-emerald-400' : 'text-rose-400';
        const labelText = isPositive ? 'Receives' : 'Pays';

        const amountEl = createSafeElement('p', `text-sm font-bold ${colorClass}`, formatCurrency(Math.abs(b.balance)));

        const labelEl = createSafeElement('p', 'text-[10px] text-slate-500 font-bold uppercase', labelText);

        rightDiv.appendChild(amountEl);
        rightDiv.appendChild(labelEl);

        card.appendChild(leftDiv);
        card.appendChild(rightDiv);

        elements.settlementContainer.appendChild(card);
    });
}

// 6. UI Interactions
function openModal() {
    elements.addRecordModal.classList.remove('hidden');
    // Animate in logic could go here if handled by JS, but CSS animation handles it via class
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
        category: formData.get('category'), // Now using select
        payer_id: formData.get('payer_id'),
        date: formData.get('date'),
        group_id: GROUP_ID
    };

    // Fallback if category empty (though required in HTML)
    if (!data.category) data.category = 'Other';

    try {
        const res = await fetch(`${API_BASE}/records`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                // 這裡必須帶上你的 ID：1035248545
                'X-Member-Id': '1035248545' 
            },
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
