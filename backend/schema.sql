-- D1 Schema for Sentinel Security Patrol Compliance Portal
-- Run with: wrangler d1 execute sentinel-db --file=./schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('system_admin', 'security_manager', 'security_supervisor', 'security_guard')),
  phone TEXT,
  shift TEXT CHECK(shift IN ('A', 'B', 'C', NULL)),
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  checkpoint_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  area_type TEXT NOT NULL CHECK(area_type IN ('critical', 'operational', 'support')),
  patrol_frequency_hours REAL NOT NULL DEFAULT 2,
  qr_code TEXT UNIQUE,
  latitude REAL,
  longitude REAL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  checkpoint_id INTEGER NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('Security', 'Safety', 'Fire', 'Housekeeping', 'Environmental')),
  item_text TEXT NOT NULL,
  is_required INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patrol_routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  schedule_type TEXT CHECK(schedule_type IN ('hourly', 'shift', 'custom')),
  schedule_config TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS route_checkpoints (
  route_id INTEGER NOT NULL,
  checkpoint_id INTEGER NOT NULL,
  sequence_order INTEGER NOT NULL,
  PRIMARY KEY (route_id, checkpoint_id),
  FOREIGN KEY (route_id) REFERENCES patrol_routes(id) ON DELETE CASCADE,
  FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS patrols (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  route_id INTEGER,
  guard_id INTEGER NOT NULL,
  site_id INTEGER NOT NULL,
  shift TEXT CHECK(shift IN ('A', 'B', 'C')),
  status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'in_progress', 'completed', 'missed', 'overdue')),
  scheduled_start DATETIME,
  scheduled_end DATETIME,
  actual_start DATETIME,
  actual_end DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (route_id) REFERENCES patrol_routes(id),
  FOREIGN KEY (guard_id) REFERENCES users(id),
  FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE IF NOT EXISTS patrol_checkpoints (
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

CREATE TABLE IF NOT EXISTS checklist_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patrol_checkpoint_id INTEGER NOT NULL,
  checklist_item_id INTEGER NOT NULL,
  response TEXT CHECK(response IN ('ok', 'issue', 'na')),
  notes TEXT,
  FOREIGN KEY (patrol_checkpoint_id) REFERENCES patrol_checkpoints(id) ON DELETE CASCADE,
  FOREIGN KEY (checklist_item_id) REFERENCES checklist_items(id)
);

CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  guard_id INTEGER,
  patrol_id INTEGER,
  checkpoint_id INTEGER,
  category TEXT NOT NULL CHECK(category IN ('Security', 'Safety', 'Fire', 'Housekeeping', 'Environmental', 'Equipment')),
  severity TEXT NOT NULL CHECK(severity IN ('Low', 'Medium', 'High', 'Critical')),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'Open' CHECK(status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
  is_escalated INTEGER DEFAULT 0,
  escalated_at DATETIME,
  escalated_to INTEGER,
  reported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  resolution_notes TEXT,
  latitude REAL,
  longitude REAL,
  photo_url TEXT,
  requires_evidence_closure INTEGER DEFAULT 0,
  closure_evidence_url TEXT,
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (guard_id) REFERENCES users(id),
  FOREIGN KEY (patrol_id) REFERENCES patrols(id),
  FOREIGN KEY (checkpoint_id) REFERENCES checkpoints(id),
  FOREIGN KEY (escalated_to) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS compliance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  site_id INTEGER NOT NULL,
  shift TEXT CHECK(shift IN ('A', 'B', 'C')),
  record_type TEXT NOT NULL CHECK(record_type IN ('patrol_completion', 'incident_response', 'training', 'equipment_check', 'audit')),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'passed', 'failed', 'needs_review')),
  score REAL,
  details TEXT,
  reviewed_by INTEGER,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('daily', 'shift', 'weekly', 'monthly', 'critical', 'audit_trail', 'custom')),
  site_id INTEGER,
  generated_by INTEGER NOT NULL,
  shift TEXT,
  date_from TEXT,
  date_to TEXT,
  parameters TEXT,
  file_path TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (site_id) REFERENCES sites(id),
  FOREIGN KEY (generated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('patrol_reminder', 'incident_alert', 'compliance_warning', 'critical_escalation', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id INTEGER,
  related_type TEXT,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL CHECK(action IN ('login', 'logout', 'qr_scan', 'patrol_start', 'patrol_submit', 'observation_create', 'observation_update', 'report_generate', 'user_create', 'user_update')),
  description TEXT,
  ip_address TEXT,
  device_info TEXT,
  related_id INTEGER,
  related_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_patrols_guard ON patrols(guard_id);
CREATE INDEX IF NOT EXISTS idx_patrols_status ON patrols(status);
CREATE INDEX IF NOT EXISTS idx_patrols_site ON patrols(site_id);
CREATE INDEX IF NOT EXISTS idx_patrols_shift ON patrols(shift);
CREATE INDEX IF NOT EXISTS idx_incidents_site ON incidents(site_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_patrol_checkpoints_patrol ON patrol_checkpoints(patrol_id);
CREATE INDEX IF NOT EXISTS idx_compliance_site ON compliance_records(site_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_checkpoints_code ON checkpoints(checkpoint_code);
