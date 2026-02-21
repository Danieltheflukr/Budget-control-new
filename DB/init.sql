CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT,
  group_id TEXT
);

INSERT OR IGNORE INTO members (id, name, group_id) VALUES 
('Daniel', 'Daniel', 'group_default'),
('Jacky', 'Jacky', 'group_default');

CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY,
  record_id TEXT,
  type TEXT,
  category TEXT,
  description TEXT,
  amount REAL,
  payer_id TEXT,
  group_id TEXT,
  date TEXT
);
