-- Seed data for Sentinel Security Patrol Compliance Portal
-- Users, Site, 13 Checkpoints, Checklist Items

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
('Plant Site', 'Plant Area', 'Bhubaneswar', 'Odisha', '751001', 'Plant Security Officer', '0674-2500001', 'security@plant.com');

-- 13 Checkpoints
INSERT INTO checkpoints (site_id, checkpoint_code, name, description, area_type, patrol_frequency_hours, qr_code, latitude, longitude) VALUES
(1, 'ETP01', 'ETP', 'Effluent Treatment Plant', 'operational', 2, 'QR-ETP01', 20.171531, 85.655147),
(1, 'VOY01', 'Veg Oil Yard', 'Vegetable oil storage yard', 'critical', 1, 'QR-VOY01', 20.170960, 85.656346),
(1, 'LPG01', 'LPG Yard', 'Liquefied Petroleum Gas storage yard', 'critical', 1, 'QR-LPG01', 20.170529, 85.657595),
(1, 'LP01', 'Loading Point', 'Product loading point', 'critical', 1, 'QR-LP01', 20.171677, 85.658172),
(1, 'SS01', 'Sub Station', 'Main electrical substation', 'operational', 2, 'QR-SS01', 20.170329, 85.656117),
(1, 'SY01', 'Scrap Yard', 'Scrap storage yard', 'operational', 2, 'QR-SY01', 20.170173, 85.654894),
(1, 'PE01', 'Process Entrance', 'Main process area entrance/gate', 'critical', 1, 'QR-PE01', 20.169881, 85.657440),
(1, 'RM01', 'RM Area', 'Raw material storage area', 'operational', 2, 'QR-RM01', 20.169320, 85.656989),
(1, 'SD01', 'Scrap/Dumping Area', 'Scrap and dumping area', 'operational', 2, 'QR-SD01', 20.169429, 85.656524),
(1, 'BA01', 'Biscuit Area/Store', 'Biscuit storage area', 'operational', 2, 'QR-BA01', 20.170362, 85.656631),
(1, 'FGY01', 'FG Stock Yard', 'Finished goods stock yard', 'operational', 2, 'QR-FGY01', 20.171638, 85.656935),
(1, 'FGD01', 'FG Dock', 'Finished goods dispatch dock', 'operational', 2, 'QR-FGD01', 20.171295, 85.657593),
(1, 'PMD01', 'PM Dock', 'Packing material dock', 'operational', 2, 'QR-PMD01', 20.170648, 85.657375);

-- Checklist items (generic per area + specific per checkpoint)

-- ETP01 (operational common)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(1, 'Security', 'Area access controlled', 1, 0),
(1, 'Safety', 'Safety signage in place', 1, 1),
(1, 'Fire', 'Fire point equipment intact', 1, 2),
(1, 'Environmental', 'Drainage clear and clean', 1, 3),
(1, 'Environmental', 'Treatment units operating normally', 1, 4),
(1, 'Environmental', 'No visible effluent overflow', 1, 5),
(1, 'Housekeeping', 'No waste accumulation', 1, 6);

-- VOY01 (critical common + storage specific)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(2, 'Security', 'Access gates locked / guarded', 1, 0),
(2, 'Security', 'No unauthorized personnel in area', 1, 1),
(2, 'Safety', 'PPE compliance observed', 1, 2),
(2, 'Safety', 'No slip/trip hazards visible', 1, 3),
(2, 'Fire', 'Fire extinguisher accessible and charged', 1, 4),
(2, 'Fire', 'No combustible material stored near ignition sources', 1, 5),
(2, 'Environmental', 'No visible oil spillage', 1, 6),
(2, 'Housekeeping', 'Area clean and tidy', 1, 7),
(2, 'Safety', 'Storage tank level gauges readable', 1, 8),
(2, 'Environmental', 'Bund wall intact and clean', 1, 9);

-- LPG01 specific
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(3, 'Security', 'Access gates locked / guarded', 1, 0),
(3, 'Security', 'No unauthorized personnel in area', 1, 1),
(3, 'Safety', 'PPE compliance observed', 1, 2),
(3, 'Safety', 'No slip/trip hazards visible', 1, 3),
(3, 'Fire', 'Fire extinguisher accessible and charged', 1, 4),
(3, 'Fire', 'No combustible material stored near ignition sources', 1, 5),
(3, 'Environmental', 'No gas odour detected', 1, 6),
(3, 'Housekeeping', 'Area clean and tidy', 1, 7),
(3, 'Safety', 'LPG vessel pressure within safe range', 1, 8),
(3, 'Safety', 'Gas leak detector operational', 1, 9),
(3, 'Fire', 'Foam system ready for activation', 1, 10);

-- LP01 (Loading Point - critical, dispatch specific)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(4, 'Security', 'Access gates locked / guarded', 1, 0),
(4, 'Security', 'No unauthorized personnel in area', 1, 1),
(4, 'Safety', 'PPE compliance observed', 1, 2),
(4, 'Safety', 'No slip/trip hazards visible', 1, 3),
(4, 'Fire', 'Fire extinguisher accessible and charged', 1, 4),
(4, 'Fire', 'No combustible material stored near ignition sources', 1, 5),
(4, 'Environmental', 'No visible spillage', 1, 6),
(4, 'Housekeeping', 'Area clean and tidy', 1, 7),
(4, 'Security', 'Vehicle log register updated', 1, 8),
(4, 'Security', 'Loading documentation verified', 1, 9);

-- SS01 (Sub Station - operational, electrical specific)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(5, 'Security', 'Area access controlled', 1, 0),
(5, 'Safety', 'Safety signage in place', 1, 1),
(5, 'Fire', 'Fire point equipment intact', 1, 2),
(5, 'Environmental', 'Drainage clear and clean', 1, 3),
(5, 'Safety', 'No abnormal sounds / overheating from equipment', 1, 4),
(5, 'Housekeeping', 'No waste accumulation', 1, 5);

-- SY01 (Scrap Yard - operational)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(6, 'Security', 'Area access controlled', 1, 0),
(6, 'Safety', 'Safety signage in place', 1, 1),
(6, 'Fire', 'Fire point equipment intact', 1, 2),
(6, 'Environmental', 'Drainage clear and clean', 1, 3),
(6, 'Housekeeping', 'No waste accumulation', 1, 4),
(6, 'Housekeeping', 'Scrap segregated and stacked properly', 1, 5);

-- PE01 (Process Entrance - critical, gate specific)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(7, 'Security', 'Access gates locked / guarded', 1, 0),
(7, 'Security', 'No unauthorized personnel in area', 1, 1),
(7, 'Safety', 'PPE compliance observed', 1, 2),
(7, 'Safety', 'No slip/trip hazards visible', 1, 3),
(7, 'Fire', 'Fire extinguisher accessible and charged', 1, 4),
(7, 'Fire', 'No combustible material stored near ignition sources', 1, 5),
(7, 'Environmental', 'No visible oil/chemical spillage', 1, 6),
(7, 'Housekeeping', 'Area clean and tidy', 1, 7),
(7, 'Security', 'Vehicle log register updated', 1, 8),
(7, 'Security', 'Visitor passes issued correctly', 1, 9),
(7, 'Security', 'CCTV cameras operational', 1, 10);

-- RM01 (RM Area - operational)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(8, 'Security', 'Area access controlled', 1, 0),
(8, 'Safety', 'Safety signage in place', 1, 1),
(8, 'Fire', 'Fire point equipment intact', 1, 2),
(8, 'Environmental', 'Drainage clear and clean', 1, 3),
(8, 'Housekeeping', 'No waste accumulation', 1, 4),
(8, 'Housekeeping', 'Raw material stacked and stored properly', 1, 5);

-- SD01 (Scrap/Dumping Area - operational)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(9, 'Security', 'Area access controlled', 1, 0),
(9, 'Safety', 'Safety signage in place', 1, 1),
(9, 'Fire', 'Fire point equipment intact', 1, 2),
(9, 'Environmental', 'Drainage clear and clean', 1, 3),
(9, 'Environmental', 'Waste segregation followed', 1, 4),
(9, 'Housekeeping', 'No waste accumulation', 1, 5);

-- BA01 (Biscuit Area/Store - operational)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(10, 'Security', 'Area access controlled', 1, 0),
(10, 'Safety', 'Safety signage in place', 1, 1),
(10, 'Fire', 'Fire point equipment intact', 1, 2),
(10, 'Environmental', 'Drainage clear and clean', 1, 3),
(10, 'Housekeeping', 'No waste accumulation', 1, 4),
(10, 'Housekeeping', 'Stock stacked safely and within limits', 1, 5);

-- FGY01 (FG Stock Yard - operational)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(11, 'Security', 'Area access controlled', 1, 0),
(11, 'Safety', 'Safety signage in place', 1, 1),
(11, 'Fire', 'Fire point equipment intact', 1, 2),
(11, 'Environmental', 'Drainage clear and clean', 1, 3),
(11, 'Housekeeping', 'No waste accumulation', 1, 4),
(11, 'Housekeeping', 'Finished goods stacked and covered properly', 1, 5);

-- FGD01 (FG Dock - operational, dispatch specific)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(12, 'Security', 'Area access controlled', 1, 0),
(12, 'Safety', 'Safety signage in place', 1, 1),
(12, 'Fire', 'Fire point equipment intact', 1, 2),
(12, 'Environmental', 'Drainage clear and clean', 1, 3),
(12, 'Housekeeping', 'No waste accumulation', 1, 4),
(12, 'Security', 'Dispatch documentation verified', 1, 5);

-- PMD01 (PM Dock - operational, dispatch specific)
INSERT INTO checklist_items (checkpoint_id, category, item_text, is_required, sort_order) VALUES
(13, 'Security', 'Area access controlled', 1, 0),
(13, 'Safety', 'Safety signage in place', 1, 1),
(13, 'Fire', 'Fire point equipment intact', 1, 2),
(13, 'Environmental', 'Drainage clear and clean', 1, 3),
(13, 'Housekeeping', 'No waste accumulation', 1, 4),
(13, 'Security', 'Incoming material documentation verified', 1, 5);
