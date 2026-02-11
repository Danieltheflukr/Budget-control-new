-- Clean up existing benchmark data
DELETE FROM members WHERE group_id = 'bench_group';
DELETE FROM records WHERE group_id = 'bench_group';

-- Insert members for benchmark group
INSERT INTO members (id, name, group_id) VALUES
('bench_m1', 'Member 1', 'bench_group'),
('bench_m2', 'Member 2', 'bench_group'),
('bench_m3', 'Member 3', 'bench_group'),
('bench_m4', 'Member 4', 'bench_group'),
('bench_m5', 'Member 5', 'bench_group');

-- Insert 1000 records
-- Using recursive CTE to generate rows (SQLite supports this)
WITH RECURSIVE cnt(x) AS (
  SELECT 1
  UNION ALL
  SELECT x+1 FROM cnt WHERE x < 1000
)
INSERT INTO records (record_id, type, category, description, amount, payer_id, group_id, date)
SELECT
  'rec_' || x,
  '支出',
  'Food',
  'Expense ' || x,
  (x % 100) + 10, -- Amount varies
  'bench_m' || ((x % 5) + 1), -- Cycle through 5 members
  'bench_group',
  '2023-01-01'
FROM cnt;
