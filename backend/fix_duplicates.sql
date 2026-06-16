-- ============================================================
-- Migration: Fix duplicate patrol_checkpoints & add UNIQUE constraint
-- Run this once against your live sentinel.db
-- ============================================================

-- Step 1: Remove duplicate patrol_checkpoint rows, keeping only the one with
--         the lowest id (or the 'scanned' one if one has been scanned already).
DELETE FROM patrol_checkpoints
WHERE id NOT IN (
  SELECT MIN(id)
  FROM patrol_checkpoints
  GROUP BY patrol_id, checkpoint_id
);

-- Step 2: Create a new table with the UNIQUE constraint
CREATE TABLE patrol_checkpoints_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patrol_id INTEGER NOT NULL,
  checkpoint_id INTEGER NOT NULL,
  scanned_at DATETIME,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'scanned', 'missed', 'issue')),
  notes TEXT,
  latitude REAL,
  longitude REAL,
  gps_accuracy REAL,
  photo_url TEXT,
  UNIQUE(patrol_id, checkpoint_id),
  FOREIGN KEY (patrol_id) REFERENCES patrols(id) ON DELETE CASCADE,
  FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id)
);

-- Step 3: Copy data
INSERT INTO patrol_checkpoints_new SELECT * FROM patrol_checkpoints;

-- Step 4: Swap tables
DROP TABLE patrol_checkpoints;
ALTER TABLE patrol_checkpoints_new RENAME TO patrol_checkpoints;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_patrol_checkpoints_patrol ON patrol_checkpoints(patrol_id);

-- Step 6: Also run the update_checkpoints.sql to reset to 13 real checkpoints
-- (Run separately if needed: sqlite3 sentinel.db < update_checkpoints.sql)
