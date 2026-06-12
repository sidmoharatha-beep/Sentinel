-- Seed data for Sentinel Security Patrol Compliance Portal
-- Users, Site, 17 Checkpoints, Checklist Items

-- Passwords (bcrypt hashes for 'admin123', 'manager123', 'super123', 'guard123')
-- Generated with cost factor 10

INSERT INTO users (employee_id, username, email, password_hash, full_name, role, phone, shift) VALUES
('EMP001', 'admin', 'admin@sentinel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator', 'system_admin', '9000000001', NULL),
('EMP002', 'mgr001', 'manager@sentinel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Rajesh Kumar (Manager)', 'security_manager', '9000000002', NULL),
('EMP003', 'sup001', 'supervisor_a@sentinel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Priya Nair (Supervisor A)', 'security_supervisor', '9000000003', 'A'),
('EMP004', 'sup002', 'supervisor_b@sentinel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Amit Singh (Supervisor B)', 'security_supervisor', '9000000004', 'B'),
('EMP005', 'sup003', 'supervisor_c@sentinel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Lakshmi Devi (Supervisor C)', 'security_supervisor', '9000000005', 'C'),
('EMP006', 'guard001', 'guard1@sentinel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Suresh Babu', 'security_guard', '9000000006', 'A'),
('EMP007', 'guard002', 'guard2@sentinel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ramesh Yadav', 'security_guard', '9000000007', 'A'),
('EMP008', 'guard003', 'guard3@sentinel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Vijay Kumar', 'security_guard', '9000000008', 'B'),
('EMP009', 'guard004', 'guard4@sentinel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Mohan Das', 'security_guard', '9000000009', 'B'),
('EMP010', 'guard005', 'guard5@sentinel.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Ravi Shankar', 'security_guard', '9000000010', 'C');

INSERT INTO sites (name, address, city, state, zip, contact_name, contact_phone, contact_email) VALUES
('HPCL Visakh Refinery', 'Harbour Area', 'Visakhapatnam', 'Andhra Pradesh', '530001', 'Plant Security Officer', '0891-2500001', 'security@hpclvizag.com');

-- 17 Checkpoints
INSERT INTO checkpoints (site_id, checkpoint_code, name, description, area_type, patrol_frequency_hours, qr_code, latitude, longitude) VALUES
(1, 'MG01', 'Main Gate', 'Main plant entry/exit gate', 'critical', 1, 'QR-MG01', 17.7231, 83.2986),
(1, 'PR01', 'Production Block', 'Primary crude processing units', 'critical', 1, 'QR-PR01', 17.7245, 83.2991),
(1, 'LG01', 'LPG Yard', 'Liquefied Petroleum Gas storage yard', 'critical', 1, 'QR-LG01', 17.7252, 83.3005),
(1, 'TK01', 'Tank Farm', 'Crude and product storage tanks', 'critical', 1, 'QR-TK01', 17.7238, 83.3012),
(1, 'PS01', 'Pump Station', 'Main transfer pump station', 'critical', 1, 'QR-PS01', 17.7241, 83.2998),
(1, 'FH01', 'Fire Station', 'Plant fire station and emergency response', 'critical', 1, 'QR-FH01', 17.7228, 83.2979),
(1, 'CU01', 'Control Unit', 'Central process control room', 'critical', 1, 'QR-CU01', 17.7235, 83.2995),
(1, 'EL01', 'Electrical Substation', 'Main HV/LV electrical substation', 'operational', 2, 'QR-EL01', 17.7249, 83.2988),
(1, 'WH01', 'Warehouse', 'Materials and spare parts warehouse', 'operational', 2, 'QR-WH01', 17.7256, 83.2975),
(1, 'WT01', 'Water Treatment', 'Effluent and water treatment plant', 'operational', 2, 'QR-WT01', 17.7263, 83.2982),
(1, 'OF01', 'Office Block', 'Administrative and engineering offices', 'operational', 2, 'QR-OF01', 17.7222, 83.2973),
(1, 'MC01', 'Marine Jetty', 'Crude oil receiving marine jetty', 'operational', 2, 'QR-MC01', 17.7271, 83.3020),
(1, 'RD01', 'Rail/Road Dispatch', 'Product dispatch via road tankers and rail', 'operational', 2, 'QR-RD01', 17.7259, 83.3008),
(1, 'MS01', 'Medical Centre', 'Occupational health centre', 'support', 4, 'QR-MS01', 17.7219, 83.2966),
(1, 'CN01', 'Canteen', 'Staff canteen and rest area', 'support', 4, 'QR-CN01', 17.7216, 83.2971),
(1, 'PE01', 'Perimeter East', 'Eastern perimeter fence line', 'support', 4, 'QR-PE01', 17.7268, 83.3025),
(1, 'AB01', 'Administrative Block', 'Security admin and visitor control', 'support', 4, 'QR-AB01', 17.7225, 83.2969);

-- Checklist items (generic per area + specific per checkpoint)
-- critical common
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(1, 'Security', 'Access gates locked / guarded', 1, 0),
(1, 'Security', 'No unauthorized personnel in area', 1, 1),
(1, 'Safety', 'PPE compliance observed', 1, 2),
(1, 'Safety', 'No slip/trip hazards visible', 1, 3),
(1, 'Fire', 'Fire extinguisher accessible and charged', 1, 4),
(1, 'Fire', 'No combustible material stored near ignition sources', 1, 5),
(1, 'Environmental', 'No visible oil/chemical spillage', 1, 6),
(1, 'Housekeeping', 'Area clean and tidy', 1, 7);

-- MG01 specific
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(1, 'Security', 'Vehicle log register updated', 1, 8),
(1, 'Security', 'Visitor passes issued correctly', 1, 9),
(1, 'Security', 'CCTV cameras operational', 1, 10);

-- PR01 (critical common)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(2, 'Security', 'Access gates locked / guarded', 1, 0),
(2, 'Security', 'No unauthorized personnel in area', 1, 1),
(2, 'Safety', 'PPE compliance observed', 1, 2),
(2, 'Safety', 'No slip/trip hazards visible', 1, 3),
(2, 'Fire', 'Fire extinguisher accessible and charged', 1, 4),
(2, 'Fire', 'No combustible material stored near ignition sources', 1, 5),
(2, 'Environmental', 'No visible oil/chemical spillage', 1, 6),
(2, 'Housekeeping', 'Area clean and tidy', 1, 7);

-- LG01 specific
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(3, 'Security', 'Access gates locked / guarded', 1, 0),
(3, 'Security', 'No unauthorized personnel in area', 1, 1),
(3, 'Safety', 'PPE compliance observed', 1, 2),
(3, 'Safety', 'No slip/trip hazards visible', 1, 3),
(3, 'Fire', 'Fire extinguisher accessible and charged', 1, 4),
(3, 'Fire', 'No combustible material stored near ignition sources', 1, 5),
(3, 'Environmental', 'No visible oil/chemical spillage', 1, 6),
(3, 'Housekeeping', 'Area clean and tidy', 1, 7),
(3, 'Safety', 'LPG vessel pressure within safe range', 1, 8),
(3, 'Safety', 'Gas leak detector operational', 1, 9),
(3, 'Fire', 'Foam system ready for activation', 1, 10),
(3, 'Environmental', 'No gas odour detected', 1, 11);

-- TK01 specific
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(4, 'Security', 'Access gates locked / guarded', 1, 0),
(4, 'Security', 'No unauthorized personnel in area', 1, 1),
(4, 'Safety', 'PPE compliance observed', 1, 2),
(4, 'Safety', 'No slip/trip hazards visible', 1, 3),
(4, 'Fire', 'Fire extinguisher accessible and charged', 1, 4),
(4, 'Fire', 'No combustible material stored near ignition sources', 1, 5),
(4, 'Environmental', 'No visible oil/chemical spillage', 1, 6),
(4, 'Housekeeping', 'Area clean and tidy', 1, 7),
(4, 'Safety', 'Tank level gauges readable', 1, 8),
(4, 'Environmental', 'Bund wall intact and clean', 1, 9),
(4, 'Fire', 'Foam inlets unobstructed', 1, 10);

-- PS01 (critical common)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(5, 'Security', 'Access gates locked / guarded', 1, 0),
(5, 'Security', 'No unauthorized personnel in area', 1, 1),
(5, 'Safety', 'PPE compliance observed', 1, 2),
(5, 'Safety', 'No slip/trip hazards visible', 1, 3),
(5, 'Fire', 'Fire extinguisher accessible and charged', 1, 4),
(5, 'Fire', 'No combustible material stored near ignition sources', 1, 5),
(5, 'Environmental', 'No visible oil/chemical spillage', 1, 6),
(5, 'Housekeeping', 'Area clean and tidy', 1, 7);

-- FH01 specific
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(6, 'Security', 'Access gates locked / guarded', 1, 0),
(6, 'Security', 'No unauthorized personnel in area', 1, 1),
(6, 'Safety', 'PPE compliance observed', 1, 2),
(6, 'Safety', 'No slip/trip hazards visible', 1, 3),
(6, 'Fire', 'Fire extinguisher accessible and charged', 1, 4),
(6, 'Fire', 'No combustible material stored near ignition sources', 1, 5),
(6, 'Environmental', 'No visible oil/chemical spillage', 1, 6),
(6, 'Housekeeping', 'Area clean and tidy', 1, 7),
(6, 'Fire', 'Fire engine ready and fuelled', 1, 8),
(6, 'Fire', 'Water tenders full', 1, 9),
(6, 'Safety', 'Fire crew on duty', 1, 10);

-- CU01 (critical common)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(7, 'Security', 'Access gates locked / guarded', 1, 0),
(7, 'Security', 'No unauthorized personnel in area', 1, 1),
(7, 'Safety', 'PPE compliance observed', 1, 2),
(7, 'Safety', 'No slip/trip hazards visible', 1, 3),
(7, 'Fire', 'Fire extinguisher accessible and charged', 1, 4),
(7, 'Fire', 'No combustible material stored near ignition sources', 1, 5),
(7, 'Environmental', 'No visible oil/chemical spillage', 1, 6),
(7, 'Housekeeping', 'Area clean and tidy', 1, 7);

-- operational common (EL01, WH01, WT01, OF01, MC01, RD01)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(8, 'Security', 'Area access controlled', 1, 0),
(8, 'Safety', 'Safety signage in place', 1, 1),
(8, 'Fire', 'Fire point equipment intact', 1, 2),
(8, 'Environmental', 'Drainage clear and clean', 1, 3),
(8, 'Housekeeping', 'No waste accumulation', 1, 4),

(9, 'Security', 'Area access controlled', 1, 0),
(9, 'Safety', 'Safety signage in place', 1, 1),
(9, 'Fire', 'Fire point equipment intact', 1, 2),
(9, 'Environmental', 'Drainage clear and clean', 1, 3),
(9, 'Housekeeping', 'No waste accumulation', 1, 4),

(10, 'Security', 'Area access controlled', 1, 0),
(10, 'Safety', 'Safety signage in place', 1, 1),
(10, 'Fire', 'Fire point equipment intact', 1, 2),
(10, 'Environmental', 'Drainage clear and clean', 1, 3),
(10, 'Housekeeping', 'No waste accumulation', 1, 4),

(11, 'Security', 'Area access controlled', 1, 0),
(11, 'Safety', 'Safety signage in place', 1, 1),
(11, 'Fire', 'Fire point equipment intact', 1, 2),
(11, 'Environmental', 'Drainage clear and clean', 1, 3),
(11, 'Housekeeping', 'No waste accumulation', 1, 4),

(12, 'Security', 'Area access controlled', 1, 0),
(12, 'Safety', 'Safety signage in place', 1, 1),
(12, 'Fire', 'Fire point equipment intact', 1, 2),
(12, 'Environmental', 'Drainage clear and clean', 1, 3),
(12, 'Housekeeping', 'No waste accumulation', 1, 4),

(13, 'Security', 'Area access controlled', 1, 0),
(13, 'Safety', 'Safety signage in place', 1, 1),
(13, 'Fire', 'Fire point equipment intact', 1, 2),
(13, 'Environmental', 'Drainage clear and clean', 1, 3),
(13, 'Housekeeping', 'No waste accumulation', 1, 4);

-- support common (MS01, CN01, PE01, AB01)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(14, 'Security', 'Area secure and locked outside hours', 1, 0),
(14, 'Housekeeping', 'Clean and orderly', 1, 1),
(14, 'Safety', 'Emergency exits clear', 1, 2),

(15, 'Security', 'Area secure and locked outside hours', 1, 0),
(15, 'Housekeeping', 'Clean and orderly', 1, 1),
(15, 'Safety', 'Emergency exits clear', 1, 2),

(16, 'Security', 'Area secure and locked outside hours', 1, 0),
(16, 'Housekeeping', 'Clean and orderly', 1, 1),
(16, 'Safety', 'Emergency exits clear', 1, 2),

(17, 'Security', 'Area secure and locked outside hours', 1, 0),
(17, 'Housekeeping', 'Clean and orderly', 1, 1),
(17, 'Safety', 'Emergency exits clear', 1, 2);
