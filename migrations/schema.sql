-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  group_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS records (
  record_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,          -- '支出' | '收入'
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  payer_id TEXT NOT NULL,      -- members.id
  group_id TEXT NOT NULL,
  date TEXT NOT NULL           -- ISO date string 'YYYY-MM-DD'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_records_group_date ON records(group_id, date);
CREATE INDEX IF NOT EXISTS idx_records_group_payer ON records(group_id, payer_id);
CREATE INDEX IF NOT EXISTS idx_members_group ON members(group_id);

-- Initial seed data for 'group_default'
INSERT OR IGNORE INTO members (id, name, group_id) VALUES ('Daniel', 'Daniel', 'group_default');
INSERT OR IGNORE INTO members (id, name, group_id) VALUES ('Jacky', 'Jacky', 'group_default');
