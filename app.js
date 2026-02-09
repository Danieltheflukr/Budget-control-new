// 假設 list 是你的容器元素
const list = document.getElementById('record-list');
list.innerHTML = ''; // 清空舊內容

records.forEach(r => {
    // 1. 建立外層容器
    const card = document.createElement('div');
    card.className = 'glass-card p-3 mb-2 d-flex justify-content-between align-items-center';

    // 2. 建立內容文字 (textContent 會自動轉義，防止 HTML 注入)
    const content = document.createElement('div');
    const title = document.createElement('h4');
    title.className = 'mb-1';
    title.textContent = r.description; // 安全！
    
    const subtitle = document.createElement('small');
    subtitle.textContent = `ID: ${r.record_id}`;
    
    content.appendChild(title);
    content.appendChild(subtitle);

    // 3. 建立刪除按鈕 (使用 addEventListener 而非 inline onclick)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger btn-sm';
    deleteBtn.textContent = '刪除';
    deleteBtn.addEventListener('click', () => {
        if(confirm('確定要刪除嗎？')) {
            deleteRecord(r.record_id); // 安全！直接傳遞變數，不經過字串拼接
        }
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

// 應用在您的 loadRecords 循環中
function renderMember(b) {
    const card = createSafeElement('div', 'flex items-center justify-between p-4 bg-white/10 rounded-lg');
    
    const infoDiv = document.createElement('div');
    infoDiv.appendChild(createSafeElement('p', 'text-white font-medium', b.name));
    infoDiv.appendChild(createSafeElement('p', 'text-gray-400 text-xs', `狀態: ${b.paid ? '已支付' : '未支付'}`));
    
    const balanceDiv = createSafeElement('div', 'text-right');
    const balanceText = createSafeElement('p', b.balance >= 0 ? 'text-green-400' : 'text-red-400', `$${b.balance}`);
    balanceDiv.appendChild(balanceText);
    
    card.appendChild(infoDiv);
    card.appendChild(balanceDiv);
    
    return card;
}
