-- 0. Ensure old schema exists (Simulating current production state)
CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id TEXT,
    type TEXT,
    category TEXT,
    description TEXT,
    amount REAL,
    member TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 1. Create Groups Table
CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create Members Table
CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    group_id TEXT,
    name TEXT NOT NULL,
    email TEXT,
    FOREIGN KEY (group_id) REFERENCES groups(id)
);

-- 3. Add New Columns
-- Note: SQLite ALTER TABLE ADD COLUMN will fail if column exists.
-- This script is designed to run once.
ALTER TABLE records ADD COLUMN group_id TEXT;
ALTER TABLE records ADD COLUMN payer_id TEXT;
ALTER TABLE records ADD COLUMN split_type TEXT DEFAULT 'equal';

-- 4. Insert Default Data
INSERT OR IGNORE INTO groups (id, name) VALUES ('group_default', 'Family');

INSERT OR IGNORE INTO members (id, group_id, name, email) VALUES
('mem_daniel', 'group_default', 'Daniel', 'haveanewlife@gmail.com'),
('mem_jacky', 'group_default', 'Jacky', 'jacky01280128@gmail.com');

-- 5. Migrate Data
UPDATE records SET group_id = 'group_default' WHERE group_id IS NULL;
UPDATE records SET payer_id = 'mem_daniel' WHERE member = 'Daniel' AND payer_id IS NULL;
UPDATE records SET payer_id = 'mem_jacky' WHERE member = 'Jacky' AND payer_id IS NULL;
