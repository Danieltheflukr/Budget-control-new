const API_URL = '/api/records';
const memoList = document.getElementById('memoList');
const totalExpenseDisplay = document.getElementById('totalExpenseDisplay');

// Event Delegation for Delete Actions
memoList.addEventListener('click', (e) => {
    // Check if clicked element is (or is inside) a delete button
    const btn = e.target.closest('.delete-btn');
    if (!btn) return;

    // Stop propagation if needed (though usually fine with delegation)
    e.stopPropagation();

    const card = btn.closest('.glass-card');
    if (card && card.dataset.id) {
        if(confirm('Delete this record?')) {
            deleteRecord(card.dataset.id);
        }
    }
});

// Utility to fetch records
async function loadRecords() {
    try {
        const res = await fetch(API_URL);
        const records = await res.json();
        renderRecords(records);
        updateStats(records);
    } catch (e) {
        console.error('Failed to load records:', e);
    }
}

// Render records - "Baseline" implementation with individual event listeners
function renderRecords(records) {
    memoList.innerHTML = ''; // Clear list

    records.forEach(r => {
        const card = document.createElement('div');
        card.className = 'glass-card p-4 rounded-xl flex justify-between items-center relative group';
        card.dataset.id = r.record_id;

        // Left side: Icon + Info
        const left = document.createElement('div');
        left.className = 'flex items-center gap-3';

        // Icon based on type
        const iconContainer = document.createElement('div');
        iconContainer.className = `w-10 h-10 rounded-full flex items-center justify-center ${r.type === '支出' ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`;
        iconContainer.innerHTML = r.type === '支出' ? '<i class="fas fa-arrow-down"></i>' : '<i class="fas fa-arrow-up"></i>';

        const info = document.createElement('div');
        const desc = document.createElement('h4');
        desc.className = 'font-semibold text-white';
        desc.textContent = r.description;

        const meta = document.createElement('p');
        meta.className = 'text-xs text-slate-400';
        meta.textContent = `${r.date} • ${r.payer_id}`;

        info.appendChild(desc);
        info.appendChild(meta);
        left.appendChild(iconContainer);
        left.appendChild(info);

        // Right side: Amount + Delete
        const right = document.createElement('div');
        right.className = 'flex items-center gap-3';

        const amount = document.createElement('span');
        amount.className = `font-bold ${r.type === '支出' ? 'text-white' : 'text-green-400'}`;
        amount.textContent = `$${parseFloat(r.amount).toFixed(2)}`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn p-2 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100'; // Hidden by default, shown on hover
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';

        // --- OPTIMIZED: Removed Individual Event Listener ---
        // Event delegation handled on container

        right.appendChild(amount);
        right.appendChild(deleteBtn);

        card.appendChild(left);
        card.appendChild(right);

        memoList.appendChild(card);
    });
}

async function deleteRecord(id) {
    try {
        const res = await fetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            loadRecords(); // Reload
        } else {
            alert('Failed to delete');
        }
    } catch (e) {
        console.error(e);
        alert('Error deleting record');
    }
}

// Add Record Handler
async function handleAddRecord(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Convert amount to number
    data.amount = parseFloat(data.amount);

    // Default category if missing (since HTML form doesn't have it)
    if (!data.category) {
        data.category = 'General';
    }
    
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (res.ok) {
            closeModal();
            e.target.reset();
            loadRecords();
        } else {
            const err = await res.json();
            alert('Error: ' + err.error);
        }
    } catch (e) {
        console.error(e);
        alert('Failed to save record');
    }
}

// Stats (simple total calculation)
function updateStats(records) {
    const total = records
        .filter(r => r.type === '支出')
        .reduce((sum, r) => sum + r.amount, 0);
    totalExpenseDisplay.textContent = `$${total.toFixed(2)}`;
    
    // Update chart if needed (skipping full chart implementation for this task)
}

// Modal logic from index.html
function openModal() {
    document.getElementById('addRecordModal').classList.remove('hidden');
}
function closeModal() {
    document.getElementById('addRecordModal').classList.add('hidden');
}

// Init
loadRecords();

// Benchmark
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
    renderRecords(dummyRecords);
    console.timeEnd('Render Time');
    
    console.log(`Rendered ${count} items.`);
    // In browser, you'd check memory or getEventListeners(btn)
}

// Expose needed functions to global scope for HTML onclick attributes
window.handleAddRecord = handleAddRecord;
window.refreshData = loadRecords;
window.openModal = openModal;
window.closeModal = closeModal;
window.runBenchmark = runBenchmark;
