-- Clear existing data
DELETE FROM checkpoints;
DELETE FROM sites;

-- Insert ITC Khordha as the single site
INSERT INTO sites (id, name, address, city, state, contact_name, is_active, created_at)
VALUES (1, 'ITC Limited, Khordha', 'ITC Limited Factory, Khordha', 'Khordha', 'Odisha', 'Security Manager', 1, datetime('now'));

-- Insert all 13 real checkpoints (all every 2 hours)
INSERT INTO checkpoints (site_id, checkpoint_code, name, description, latitude, longitude, patrol_frequency_hours, area_type, qr_code, is_active, created_at) VALUES
(1, 'ETP01',  'ETP',               'Effluent Treatment Plant',      20.171531, 85.655147, 2, 'operational', 'QR-ETP01', 1, datetime('now')),
(1, 'VOY01',  'Veg Oil Yard',      'Vegetable Oil Yard',            20.170960, 85.656346, 2, 'critical',    'QR-VOY01', 1, datetime('now')),
(1, 'LPG01',  'LPG Yard',         'LPG Storage Yard',              20.170529, 85.657595, 2, 'critical',    'QR-LPG01', 1, datetime('now')),
(1, 'LDP01',  'Loading Point',    'Loading/Dispatch Point',         20.171677, 85.658172, 2, 'operational', 'QR-LDP01', 1, datetime('now')),
(1, 'SST01',  'Sub Station',      'Electrical Sub Station',         20.170329, 85.656117, 2, 'critical',    'QR-SST01', 1, datetime('now')),
(1, 'SCY01',  'Scrap Yard',       'Scrap Storage Yard',             20.170173, 85.654894, 2, 'support',     'QR-SCY01', 1, datetime('now')),
(1, 'PRE01',  'Process Entrance', 'Process Area Entrance',          20.169881, 85.657440, 2, 'critical',    'QR-PRE01', 1, datetime('now')),
(1, 'RMA01',  'RM Area',          'Raw Material Area',              20.169320, 85.656989, 2, 'operational', 'QR-RMA01', 1, datetime('now')),
(1, 'SDA01',  'Scrap/Dumping Area','Scrap and Dumping Area',        20.169429, 85.656524, 2, 'support',     'QR-SDA01', 1, datetime('now')),
(1, 'BAS01',  'Biscuit Area/Store','Biscuit Production Area/Store', 20.170362, 85.656631, 2, 'operational', 'QR-BAS01', 1, datetime('now')),
(1, 'FGS01',  'FG Stock Yard',    'Finished Goods Stock Yard',      20.171638, 85.656935, 2, 'operational', 'QR-FGS01', 1, datetime('now')),
(1, 'FGD01',  'FG Dock',          'Finished Goods Dock',            20.171295, 85.657593, 2, 'operational', 'QR-FGD01', 1, datetime('now')),
(1, 'PMD01',  'PM Dock',          'Packaging Material Dock',        20.170648, 85.657375, 2, 'operational', 'QR-PMD01', 1, datetime('now'));
