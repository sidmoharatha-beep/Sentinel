const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/sentinel.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`PRAGMA journal_mode = WAL`);
  db.run(`PRAGMA foreign_keys = ON`);
});

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function initSchema() {
  const schema = `
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
  `;

  db.exec(schema, (err) => {
    if (err) console.error('Schema init error:', err);
    else seedData();
  });
}

function seedData() {
  db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
    if (err || row.count > 0) return;

    const bcrypt = require('bcryptjs');

    db.serialize(() => {
      // ── USERS ──────────────────────────────────────────────────────────
      const insertUser = db.prepare(`
        INSERT INTO users (employee_id, username, email, password_hash, full_name, role, phone, shift)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insertUser.run('EMP001', 'admin', 'admin@sentinel.com', bcrypt.hashSync('admin123', 10), 'System Administrator', 'system_admin', '9000000001', null);
      insertUser.run('EMP002', 'mgr001', 'manager@sentinel.com', bcrypt.hashSync('manager123', 10), 'Rajesh Kumar (Manager)', 'security_manager', '9000000002', null);
      insertUser.run('EMP003', 'sup001', 'supervisor_a@sentinel.com', bcrypt.hashSync('super123', 10), 'Priya Nair (Supervisor A)', 'security_supervisor', '9000000003', 'A');
      insertUser.run('EMP004', 'sup002', 'supervisor_b@sentinel.com', bcrypt.hashSync('super123', 10), 'Amit Singh (Supervisor B)', 'security_supervisor', '9000000004', 'B');
      insertUser.run('EMP005', 'sup003', 'supervisor_c@sentinel.com', bcrypt.hashSync('super123', 10), 'Lakshmi Devi (Supervisor C)', 'security_supervisor', '9000000005', 'C');
      insertUser.run('EMP006', 'guard001', 'guard1@sentinel.com', bcrypt.hashSync('guard123', 10), 'Suresh Babu', 'security_guard', '9000000006', 'A');
      insertUser.run('EMP007', 'guard002', 'guard2@sentinel.com', bcrypt.hashSync('guard123', 10), 'Ramesh Yadav', 'security_guard', '9000000007', 'A');
      insertUser.run('EMP008', 'guard003', 'guard3@sentinel.com', bcrypt.hashSync('guard123', 10), 'Vijay Kumar', 'security_guard', '9000000008', 'B');
      insertUser.run('EMP009', 'guard004', 'guard4@sentinel.com', bcrypt.hashSync('guard123', 10), 'Mohan Das', 'security_guard', '9000000009', 'B');
      insertUser.run('EMP010', 'guard005', 'guard5@sentinel.com', bcrypt.hashSync('guard123', 10), 'Ravi Shankar', 'security_guard', '9000000010', 'C');
      insertUser.finalize();

      // ── SITE ───────────────────────────────────────────────────────────
      db.run(`
        INSERT INTO sites (name, address, city, state, zip, contact_name, contact_phone, contact_email)
        VALUES ('HPCL Visakh Refinery', 'Harbour Area', 'Visakhapatnam', 'Andhra Pradesh', '530001',
                'Plant Security Officer', '0891-2500001', 'security@hpclvizag.com')
      `, function(siteErr) {
        if (siteErr) { console.error('Site seed error:', siteErr); return; }
        const siteId = this.lastID;
        seedCheckpoints(db, siteId);
      });
    });
  });
}

function seedCheckpoints(db, siteId) {
  // 17 plant-specific checkpoints per spec
  const checkpoints = [
    { code: 'MG01', name: 'Main Gate',           desc: 'Main plant entry/exit gate',                   area: 'critical',     freq: 1,   lat: 17.7231, lng: 83.2986 },
    { code: 'PR01', name: 'Production Block',     desc: 'Primary crude processing units',               area: 'critical',     freq: 1,   lat: 17.7245, lng: 83.2991 },
    { code: 'LG01', name: 'LPG Yard',             desc: 'Liquefied Petroleum Gas storage yard',         area: 'critical',     freq: 1,   lat: 17.7252, lng: 83.3005 },
    { code: 'TK01', name: 'Tank Farm',            desc: 'Crude and product storage tanks',              area: 'critical',     freq: 1,   lat: 17.7238, lng: 83.3012 },
    { code: 'PS01', name: 'Pump Station',         desc: 'Main transfer pump station',                   area: 'critical',     freq: 1,   lat: 17.7241, lng: 83.2998 },
    { code: 'FH01', name: 'Fire Station',         desc: 'Plant fire station and emergency response',    area: 'critical',     freq: 1,   lat: 17.7228, lng: 83.2979 },
    { code: 'CU01', name: 'Control Unit',         desc: 'Central process control room',                 area: 'critical',     freq: 1,   lat: 17.7235, lng: 83.2995 },
    { code: 'EL01', name: 'Electrical Substation','Main HV/LV electrical substation',                   area: 'operational',  freq: 2,   lat: 17.7249, lng: 83.2988 },
    { code: 'WH01', name: 'Warehouse',            desc: 'Materials and spare parts warehouse',          area: 'operational',  freq: 2,   lat: 17.7256, lng: 83.2975 },
    { code: 'WT01', name: 'Water Treatment',      desc: 'Effluent and water treatment plant',           area: 'operational',  freq: 2,   lat: 17.7263, lng: 83.2982 },
    { code: 'OF01', name: 'Office Block',         desc: 'Administrative and engineering offices',       area: 'operational',  freq: 2,   lat: 17.7222, lng: 83.2973 },
    { code: 'MC01', name: 'Marine Jetty',         desc: 'Crude oil receiving marine jetty',             area: 'operational',  freq: 2,   lat: 17.7271, lng: 83.3020 },
    { code: 'RD01', name: 'Rail/Road Dispatch',   desc: 'Product dispatch via road tankers and rail',   area: 'operational',  freq: 2,   lat: 17.7259, lng: 83.3008 },
    { code: 'MS01', name: 'Medical Centre',       desc: 'Occupational health centre',                   area: 'support',      freq: 4,   lat: 17.7219, lng: 83.2966 },
    { code: 'CN01', name: 'Canteen',              desc: 'Staff canteen and rest area',                  area: 'support',      freq: 4,   lat: 17.7216, lng: 83.2971 },
    { code: 'PE01', name: 'Perimeter East',       desc: 'Eastern perimeter fence line',                 area: 'support',      freq: 4,   lat: 17.7268, lng: 83.3025 },
    { code: 'AB01', name: 'Administrative Block', desc: 'Security admin and visitor control',           area: 'support',      freq: 4,   lat: 17.7225, lng: 83.2969 },
  ];

  const insertCP = db.prepare(`
    INSERT INTO checkpoints (site_id, checkpoint_code, name, description, area_type, patrol_frequency_hours, qr_code, latitude, longitude)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  checkpoints.forEach(cp => {
    insertCP.run(siteId, cp.code, cp.name, cp.desc, cp.area, cp.freq, `QR-${cp.code}`, cp.lat, cp.lng);
  });
  insertCP.finalize();

  // Give SQLite a moment then seed checklists
  setTimeout(() => seedChecklists(db, siteId), 500);
}

function seedChecklists(db, siteId) {
  db.all('SELECT id, checkpoint_code, name, area_type FROM checkpoints WHERE site_id = ?', [siteId], (err, cps) => {
    if (err) { console.error('Checklist seed error:', err); return; }

    // Generic checklist items by area type
    const commonItems = {
      critical: [
        { cat: 'Security',      text: 'Access gates locked / guarded' },
        { cat: 'Security',      text: 'No unauthorized personnel in area' },
        { cat: 'Safety',        text: 'PPE compliance observed' },
        { cat: 'Safety',        text: 'No slip/trip hazards visible' },
        { cat: 'Fire',          text: 'Fire extinguisher accessible and charged' },
        { cat: 'Fire',          text: 'No combustible material stored near ignition sources' },
        { cat: 'Environmental', text: 'No visible oil/chemical spillage' },
        { cat: 'Housekeeping',  text: 'Area clean and tidy' },
      ],
      operational: [
        { cat: 'Security',      text: 'Area access controlled' },
        { cat: 'Safety',        text: 'Safety signage in place' },
        { cat: 'Fire',          text: 'Fire point equipment intact' },
        { cat: 'Environmental', text: 'Drainage clear and clean' },
        { cat: 'Housekeeping',  text: 'No waste accumulation' },
      ],
      support: [
        { cat: 'Security',      text: 'Area secure and locked outside hours' },
        { cat: 'Housekeeping',  text: 'Clean and orderly' },
        { cat: 'Safety',        text: 'Emergency exits clear' },
      ]
    };

    // Specific additional items for special checkpoints
    const specificItems = {
      LG01: [
        { cat: 'Safety',        text: 'LPG vessel pressure within safe range' },
        { cat: 'Safety',        text: 'Gas leak detector operational' },
        { cat: 'Fire',          text: 'Foam system ready for activation' },
        { cat: 'Environmental', text: 'No gas odour detected' },
      ],
      TK01: [
        { cat: 'Safety',        text: 'Tank level gauges readable' },
        { cat: 'Environmental', text: 'Bund wall intact and clean' },
        { cat: 'Fire',          text: 'Foam inlets unobstructed' },
      ],
      FH01: [
        { cat: 'Fire',          text: 'Fire engine ready and fuelled' },
        { cat: 'Fire',          text: 'Water tenders full' },
        { cat: 'Safety',        text: 'Fire crew on duty' },
      ],
      MG01: [
        { cat: 'Security',      text: 'Vehicle log register updated' },
        { cat: 'Security',      text: 'Visitor passes issued correctly' },
        { cat: 'Security',      text: 'CCTV cameras operational' },
      ]
    };

    const insertItem = db.prepare(`
      INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order)
      VALUES (?, ?, ?, 1, ?)
    `);

    cps.forEach(cp => {
      const baseItems = commonItems[cp.area_type] || commonItems.support;
      const extras = specificItems[cp.checkpoint_code] || [];
      const allItems = [...baseItems, ...extras];

      allItems.forEach((item, idx) => {
        insertItem.run(cp.id, item.cat, item.text, idx);
      });
    });

    insertItem.finalize();
    console.log('✅ Database seeded: 17 plant checkpoints + checklists + users');
  });
}

initSchema();

module.exports = { db, runAsync, getAsync, allAsync };
