-- 1. 成員表
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  group_id TEXT NOT NULL
);

-- 2. 支出紀錄表 (新增了比例分擔欄位)
CREATE TABLE IF NOT EXISTS records (
  record_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,          -- '支出' | '收入'
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  payer_id TEXT NOT NULL,      -- 支付者 ID
  group_id TEXT NOT NULL,
  date TEXT NOT NULL,          -- ISO 'YYYY-MM-DD'
  daniel_share REAL DEFAULT 0, -- Daniel 應負擔金額
  jacky_share REAL DEFAULT 0   -- Jacky 應負擔金額
);

-- 3. 儲蓄紀錄表
CREATE TABLE IF NOT EXISTS savings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  payer_id TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  target_name TEXT DEFAULT 'General'
);

-- 索引優化 (這部分你做得很棒！)
CREATE INDEX IF NOT EXISTS idx_records_group_date ON records(group_id, date);
CREATE INDEX IF NOT EXISTS idx_records_group_payer ON records(group_id, payer_id);
CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id);
CREATE INDEX IF NOT EXISTS idx_savings_payer ON savings(payer_id);

-- 初始成員資料
INSERT OR IGNORE INTO members (id, name, group_id) VALUES ('Daniel', 'Daniel', 'group_default');
INSERT OR IGNORE INTO members (id, name, group_id) VALUES ('Jacky', 'Jacky', 'group_default');
