const API_BASE = '/api';
let expenseChart = null;

// Icons mapping
const CATEGORY_ICONS = {
    '食': 'fa-utensils',
    '衣': 'fa-tshirt',
    '住': 'fa-home',
    '行': 'fa-bus',
    '育': 'fa-book',
    '樂': 'fa-gamepad',
    '其他': 'fa-asterisk'
};

const CATEGORY_COLORS = {
    '食': 'text-orange-400',
    '衣': 'text-purple-400',
    '住': 'text-blue-400',
    '行': 'text-green-400',
    '育': 'text-yellow-400',
    '樂': 'text-pink-400',
    '其他': 'text-gray-400'
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Set default date
    const today = new Date().toISOString().split('T')[0];
    document.querySelector('input[name="date"]').value = today;

    await loadMembers();
    await refreshData();
}

async function refreshData() {
    await Promise.all([
        loadRecords(),
        loadStats(),
        loadSettlement()
    ]);
}

async function loadMembers() {
    try {
        const res = await fetch(`${API_BASE}/members`);
        const members = await res.json();
        const select = document.getElementById('payerSelect');
        if (members.length) {
            select.innerHTML = members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        }
    } catch (e) {
        console.error("Failed to load members", e);
    }
}

async function loadRecords() {
    try {
        const res = await fetch(`${API_BASE}/records?limit=50`);
        const records = await res.json();
        const list = document.getElementById('recordsList');

        if (!records.length) {
            list.innerHTML = '<div class="text-center text-slate-500 py-4">No records found</div>';
            return;
        }

        list.innerHTML = records.map(r => `
            <div class="glass-card p-3 rounded-xl flex justify-between items-center group relative overflow-hidden hover:bg-white/5 transition-colors">
                <div class="flex items-center gap-3 z-10">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center bg-slate-800 border border-slate-700">
                        <i class="fas ${CATEGORY_ICONS[r.category] || 'fa-tag'} ${CATEGORY_COLORS[r.category] || 'text-white'}"></i>
                    </div>
                    <div>
                        <h4 class="text-sm font-medium text-slate-200">${r.description}</h4>
                        <p class="text-xs text-slate-500">${r.member || r.payer_id} • ${r.date}</p>
                    </div>
                </div>
                <div class="text-right z-10">
                    <p class="font-bold ${r.type === '支出' ? 'text-rose-400' : 'text-emerald-400'}">
                        ${r.type === '支出' ? '-' : '+'}${parseFloat(r.amount).toLocaleString()}
                    </p>
                    <p class="text-[10px] text-slate-600 uppercase tracking-wide">${r.category}</p>
                </div>

                <button onclick="deleteRecord('${r.record_id}')" class="absolute right-0 top-0 bottom-0 w-14 bg-rose-600/90 text-white flex items-center justify-center transform translate-x-full group-hover:translate-x-0 transition-transform duration-200 z-20 hover:bg-rose-700">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `).join('');
    } catch (e) {
        console.error("Failed to load records", e);
    }
}

async function loadStats() {
    try {
        const res = await fetch(`${API_BASE}/stats`);
        const data = await res.json();

        // Update Chart
        const ctx = document.getElementById('expenseChart').getContext('2d');
        const labels = data.map(d => d.category);
        const values = data.map(d => d.value);
        const total = values.reduce((a, b) => a + b, 0);

        // Update Total Display
        document.getElementById('totalExpenseDisplay').innerText = `$${total.toLocaleString()}`;

        // Update Budget Progress (Hardcoded budget 30000 for now, could be dynamic later)
        const budget = 30000;
        const percentage = Math.min((total / budget) * 100, 100);
        document.getElementById('budgetProgress').style.width = `${percentage}%`;
        document.getElementById('budgetPercentage').innerText = `${percentage.toFixed(1)}%`;

        // Chart Config
        if (expenseChart) {
            expenseChart.destroy();
        }

        expenseChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: [
                        '#fb923c', // orange (food)
                        '#c084fc', // purple (clothing)
                        '#60a5fa', // blue (housing)
                        '#4ade80', // green (transport)
                        '#facc15', // yellow (edu)
                        '#f472b6', // pink (fun)
                        '#94a3b8'  // gray (other)
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
                        callbacks: {
                            label: function(context) {
                                return ` $${context.parsed.toLocaleString()}`;
                            }
                        }
                    }
                },
                cutout: '70%'
            }
        });

    } catch (e) {
        console.error("Failed to load stats", e);
    }
}

async function loadSettlement() {
    try {
        const res = await fetch(`${API_BASE}/settlement`);
        const data = await res.json();
        const container = document.getElementById('settlementContainer');

        if (!data.balances || !data.balances.length) {
            container.innerHTML = '<div class="text-center text-slate-500 text-sm">No settlement data</div>';
            return;
        }

        container.innerHTML = data.balances.map(b => {
            const isOwe = b.balance < 0;
            const absBal = Math.abs(b.balance);
            const colorClass = isOwe ? 'text-rose-400' : 'text-emerald-400';
            const icon = isOwe ? 'fa-arrow-trend-down' : 'fa-arrow-trend-up';
            const statusText = isOwe ? 'Owes' : 'Receives'; // Simplistic

            return `
                <div class="glass-card p-3 rounded-xl flex justify-between items-center">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-700">
                            ${b.name.charAt(0)}
                        </div>
                        <div>
                            <p class="text-sm font-semibold text-white">${b.name}</p>
                            <p class="text-xs text-slate-500">Paid: $${b.paid.toLocaleString()}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-sm font-bold ${colorClass}">
                            ${b.balance > 0 ? '+' : ''}${b.balance.toFixed(0)}
                        </p>
                        <p class="text-[10px] text-slate-500">${statusText}</p>
                    </div>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error("Failed to load settlement", e);
    }
}

async function handleAddRecord(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    // Ensure amount is number
    data.amount = parseFloat(data.amount);
    // Add group_id default
    data.group_id = 'group_default';

    try {
        const res = await fetch(`${API_BASE}/records`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            closeModal();
            form.reset();
            // Reset date to today
            document.querySelector('input[name="date"]').valueAsDate = new Date();
            await refreshData();
        } else {
            alert('Failed to add record');
        }
    } catch (err) {
        console.error(err);
        alert('Error adding record');
    }
}

async function deleteRecord(id) {
    if (!confirm('Delete this record?')) return;

    try {
        const res = await fetch(`${API_BASE}/records?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            await refreshData();
        } else {
            alert('Failed to delete');
        }
    } catch (err) {
        console.error(err);
    }
}

// UI Functions
function openModal() {
    const modal = document.getElementById('addRecordModal');
    const content = document.getElementById('modalContent');
    modal.classList.remove('hidden');
    // Simple animation trigger
    setTimeout(() => {
        content.classList.remove('translate-y-full');
    }, 10);
}

function closeModal() {
    const modal = document.getElementById('addRecordModal');
    const content = document.getElementById('modalContent');
    content.classList.add('translate-y-full');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

function toggleType(type) {
    // Maybe change UI color based on type
}
