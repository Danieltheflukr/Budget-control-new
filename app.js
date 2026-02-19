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
            refreshData(); 
        } else {
            const err = await res.json();
            alert(`Error: ${err.error || '身分驗證失敗 (401)'}`);
        }
    } catch (error) {
        console.error('Error adding record:', error);
        alert('新增紀錄失敗。');
    }
}
