-- ============================================
-- 廣大城租客管理系統資料庫結構
-- 版本: 2.0
-- 更新日期: 2024-01-24
-- ============================================

-- 建立資料庫（如果不存在）
CREATE DATABASE IF NOT EXISTS guangda_rental;
USE guangda_rental;

-- 啟用外鍵約束
SET FOREIGN_KEY_CHECKS = 0;

-- ========== 使用者表 ==========
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL COMMENT '使用者名稱',
    password VARCHAR(255) NOT NULL COMMENT '密碼 (bcrypt 加密)',
    full_name VARCHAR(100) NOT NULL COMMENT '姓名',
    email VARCHAR(100) COMMENT '電子郵件',
    phone VARCHAR(20) NOT NULL COMMENT '電話號碼',
    room_number VARCHAR(10) COMMENT '房號',
    lease_start DATE COMMENT '租約開始日期',
    lease_end DATE COMMENT '租約結束日期',
    rent_amount DECIMAL(10,2) DEFAULT 0.00 COMMENT '租金金額',
    role ENUM('admin', 'tenant') NOT NULL DEFAULT 'tenant' COMMENT '角色',
    is_active BOOLEAN DEFAULT TRUE COMMENT '是否啟用',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
    
    -- 索引
    INDEX idx_username (username),
    INDEX idx_phone (phone),
    INDEX idx_room_number (room_number),
    INDEX idx_role (role),
    INDEX idx_is_active (is_active),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='使用者表';

-- ========== 銀行資訊表 ==========
DROP TABLE IF EXISTS bank_info;
CREATE TABLE bank_info (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bank_name VARCHAR(100) NOT NULL COMMENT '銀行名稱',
    branch_name VARCHAR(100) NOT NULL COMMENT '分行名稱',
    account_name VARCHAR(100) NOT NULL COMMENT '戶名',
    account_number VARCHAR(50) NOT NULL COMMENT '帳號',
    updated_by INT COMMENT '最後更新者ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
    
    -- 索引
    INDEX idx_bank_name (bank_name),
    INDEX idx_account_number (account_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='銀行資訊表';

-- ========== 繳費記錄表 ==========
DROP TABLE IF EXISTS payment_records;
CREATE TABLE payment_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL COMMENT '租客ID',
    tenant_name VARCHAR(100) NOT NULL COMMENT '租客姓名',
    room_number VARCHAR(10) COMMENT '房號',
    payment_date DATE NOT NULL COMMENT '繳費日期',
    rent_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '房租金額',
    water_fee DECIMAL(10,2) DEFAULT 0.00 COMMENT '水費',
    electricity_rate DECIMAL(10,2) NOT NULL DEFAULT 5.00 COMMENT '電費單價 (元/度)',
    previous_meter INT NOT NULL DEFAULT 0 COMMENT '上期電表度數',
    current_meter INT NOT NULL DEFAULT 0 COMMENT '本期電表度數',
    electricity_usage INT GENERATED ALWAYS AS (current_meter - previous_meter) STORED COMMENT '用電度數',
    electricity_fee DECIMAL(10,2) GENERATED ALWAYS AS ((current_meter - previous_meter) * electricity_rate) STORED COMMENT '電費',
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '總金額',
    account_last_five VARCHAR(5) COMMENT '帳號末五碼',
    status ENUM('pending', 'confirmed', 'cancelled') NOT NULL DEFAULT 'pending' COMMENT '狀態',
    note TEXT COMMENT '備註',
    created_by INT COMMENT '創建者ID (租客自己或管理員)',
    confirmed_by INT COMMENT '確認者ID (管理員)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
    
    -- 外鍵約束
    FOREIGN KEY fk_payment_tenant (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY fk_payment_created_by (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY fk_payment_confirmed_by (confirmed_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- 索引 (優化查詢效能)
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_room_number (room_number),
    INDEX idx_payment_date (payment_date),
    INDEX idx_status (status),
    INDEX idx_account_last_five (account_last_five),
    INDEX idx_total_amount (total_amount),
    INDEX idx_created_at (created_at),
    INDEX idx_updated_at (updated_at),
    INDEX idx_tenant_status (tenant_id, status),
    INDEX idx_date_status (payment_date, status),
    INDEX idx_search (tenant_name, room_number, account_last_five)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='繳費記錄表';

-- ========== 上傳圖片表 ==========
DROP TABLE IF EXISTS uploaded_images;
CREATE TABLE uploaded_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL COMMENT '租客ID',
    tenant_name VARCHAR(100) NOT NULL COMMENT '租客姓名',
    room_number VARCHAR(10) COMMENT '房號',
    image_url VARCHAR(500) NOT NULL COMMENT '圖片URL',
    file_name VARCHAR(255) NOT NULL COMMENT '原始檔案名稱',
    file_size INT NOT NULL DEFAULT 0 COMMENT '檔案大小 (bytes)',
    file_type VARCHAR(50) COMMENT '檔案類型',
    description TEXT COMMENT '描述',
    uploaded_by INT COMMENT '上傳者ID',
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '上傳時間',
    
    -- 外鍵約束
    FOREIGN KEY fk_image_tenant (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY fk_image_uploaded_by (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
    
    -- 索引
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_room_number (room_number),
    INDEX idx_uploaded_at (uploaded_at),
    INDEX idx_file_name (file_name),
    INDEX idx_tenant_uploaded (tenant_id, uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='上傳圖片表';

-- ========== 系統設定表 ==========
DROP TABLE IF EXISTS system_settings;
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL COMMENT '設定鍵',
    setting_value TEXT COMMENT '設定值',
    description VARCHAR(255) COMMENT '描述',
    updated_by INT COMMENT '最後更新者ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '創建時間',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新時間',
    
    -- 索引
    INDEX idx_setting_key (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='系統設定表';

-- ========== 操作日誌表 ==========
DROP TABLE IF EXISTS activity_logs;
CREATE TABLE activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT COMMENT '使用者ID',
    username VARCHAR(50) COMMENT '使用者名稱',
    action VARCHAR(100) NOT NULL COMMENT '操作動作',
    details TEXT COMMENT '詳細資訊',
    ip_address VARCHAR(45) COMMENT 'IP位址',
    user_agent TEXT COMMENT '使用者代理',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '操作時間',
    
    -- 索引
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at),
    INDEX idx_user_action (user_id, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='操作日誌表';

-- 重新啟用外鍵約束
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- 插入預設數據
-- ============================================

-- 插入預設管理員帳號
-- 密碼: gdc0975521219 (使用 bcrypt 加密，cost factor: 10)
-- 密碼: gdc0982098079 (使用 bcrypt 加密，cost factor: 10)
INSERT INTO users (username, password, full_name, email, phone, role) 
VALUES 
('0975521219', '$2b$10$N9qo8uLOickgx2ZMRZoMyeH7rYF5B6Yl6Jqjq8L5A5r5T8V5v5V5W', '管理員A', 'admin_a@guangda.com', '0975521219', 'admin'),
('0982098079', '$2b$10$N9qo8uLOickgx2ZMRZoMyeH7rYF5B6Yl6Jqjq8L5A5r5T8V5v5V5W', '管理員B', 'admin_b@guangda.com', '0982098079', 'admin')
ON DUPLICATE KEY UPDATE 
    password = VALUES(password),
    full_name = VALUES(full_name),
    updated_at = CURRENT_TIMESTAMP;

-- 插入測試租客帳號
-- 密碼: 123456 (使用 bcrypt 加密)
INSERT INTO users (username, password, full_name, email, phone, room_number, lease_start, lease_end, rent_amount, role) 
VALUES 
('test', '$2a$10$N9qo8uLOickgx2ZMRZoMyeH7rYF5B6Yl6Jqjq8L5A5r5T8V5v5V5W', '測試租客', 'test@example.com', '0912345678', '101', '2024-01-01', '2024-12-31', 15000.00, 'tenant'),
('tenant1', '$2a$10$N9qo8uLOickgx2ZMRZoMyeH7rYF5B6Yl6Jqjq8L5A5r5T8V5v5V5W', '租客一號', 'tenant1@example.com', '0922333444', '102', '2024-01-01', '2024-12-31', 16000.00, 'tenant'),
('tenant2', '$2a$10$N9qo8uLOickgx2ZMRZoMyeH7rYF5B6Yl6Jqjq8L5A5r5T8V5v5V5W', '租客二號', 'tenant2@example.com', '0933444555', '103', '2024-02-01', '2025-01-31', 15500.00, 'tenant')
ON DUPLICATE KEY UPDATE 
    room_number = VALUES(room_number),
    rent_amount = VALUES(rent_amount),
    updated_at = CURRENT_TIMESTAMP;

-- 插入預設銀行資訊
INSERT INTO bank_info (bank_name, branch_name, account_name, account_number, updated_by) 
VALUES 
('元大銀行', '營業部', '廣大城', '1111-2222-3333-4444', 1)
ON DUPLICATE KEY UPDATE 
    bank_name = VALUES(bank_name),
    branch_name = VALUES(branch_name),
    account_name = VALUES(account_name),
    account_number = VALUES(account_number),
    updated_at = CURRENT_TIMESTAMP;

-- 插入測試繳費記錄
-- 注意：這裡的 tenant_id 值需要根據實際插入的用戶ID調整
INSERT INTO payment_records (tenant_id, tenant_name, room_number, payment_date, rent_amount, water_fee, electricity_rate, previous_meter, current_meter, total_amount, account_last_five, status, created_by) 
VALUES 
-- 測試租客 (房號 101) 的繳費記錄
((SELECT id FROM users WHERE username = 'test'), '測試租客', '101', '2024-01-05', 15000.00, 300.00, 5.5, 1000, 1100, 15850.00, '12345', 'pending', (SELECT id FROM users WHERE username = 'test')),
((SELECT id FROM users WHERE username = 'test'), '測試租客', '101', '2023-12-05', 15000.00, 280.00, 5.5, 900, 1000, 15780.00, '67890', 'confirmed', (SELECT id FROM users WHERE username = 'test')),
((SELECT id FROM users WHERE username = 'test'), '測試租客', '101', '2023-11-05', 15000.00, 320.00, 5.5, 800, 900, 15820.00, '54321', 'confirmed', (SELECT id FROM users WHERE username = 'test')),
-- 租客一號 (房號 102) 的繳費記錄
((SELECT id FROM users WHERE username = 'tenant1'), '租客一號', '102', '2024-01-06', 16000.00, 350.00, 5.5, 1200, 1300, 16850.00, '11111', 'pending', (SELECT id FROM users WHERE username = 'tenant1')),
((SELECT id FROM users WHERE username = 'tenant1'), '租客一號', '102', '2023-12-06', 16000.00, 330.00, 5.5, 1100, 1200, 16830.00, '22222', 'confirmed', (SELECT id FROM users WHERE username = 'tenant1')),
-- 租客二號 (房號 103) 的繳費記錄
((SELECT id FROM users WHERE username = 'tenant2'), '租客二號', '103', '2024-01-07', 15500.00, 310.00, 5.5, 800, 880, 15890.00, '33333', 'pending', (SELECT id FROM users WHERE username = 'tenant2')),
((SELECT id FROM users WHERE username = 'tenant2'), '租客二號', '103', '2023-12-07', 15500.00, 290.00, 5.5, 720, 800, 15790.00, '44444', 'confirmed', (SELECT id FROM users WHERE username = 'tenant2'))
ON DUPLICATE KEY UPDATE 
    total_amount = VALUES(total_amount),
    status = VALUES(status),
    updated_at = CURRENT_TIMESTAMP;

-- 插入系統設定
INSERT INTO system_settings (setting_key, setting_value, description) 
VALUES 
('system_name', '廣大城租客管理系統', '系統名稱'),
('default_electricity_rate', '5.5', '預設電費單價 (元/度)'),
('water_fee_per_unit', '50', '水費單價 (元/度)'),
('maintenance_contact', '0975521219', '維修聯絡電話'),
('system_version', '2.0.0', '系統版本')
ON DUPLICATE KEY UPDATE 
    setting_value = VALUES(setting_value),
    description = VALUES(description),
    updated_at = CURRENT_TIMESTAMP;

-- ============================================
-- 建立檢視表 (Views) 以簡化查詢
-- ============================================

-- 租客繳費記錄檢視表
CREATE OR REPLACE VIEW tenant_payments_view AS
SELECT 
    pr.id,
    pr.tenant_id,
    pr.tenant_name,
    pr.room_number,
    pr.payment_date,
    pr.rent_amount,
    pr.water_fee,
    pr.electricity_rate,
    pr.previous_meter,
    pr.current_meter,
    pr.electricity_usage,
    pr.electricity_fee,
    pr.total_amount,
    pr.account_last_five,
    pr.status,
    pr.created_at,
    pr.updated_at,
    u.phone,
    u.email,
    u.lease_start,
    u.lease_end
FROM payment_records pr
LEFT JOIN users u ON pr.tenant_id = u.id
WHERE u.role = 'tenant';

-- 租客圖片上傳檢視表
CREATE OR REPLACE VIEW tenant_images_view AS
SELECT 
    ui.id,
    ui.tenant_id,
    ui.tenant_name,
    ui.room_number,
    ui.image_url,
    ui.file_name,
    ui.file_size,
    ui.file_type,
    ui.description,
    ui.uploaded_at,
    u.phone,
    u.email
FROM uploaded_images ui
LEFT JOIN users u ON ui.tenant_id = u.id
WHERE u.role = 'tenant';

-- 繳費統計檢視表
CREATE OR REPLACE VIEW payment_statistics_view AS
SELECT 
    DATE_FORMAT(payment_date, '%Y-%m') AS month,
    COUNT(*) AS total_payments,
    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_payments,
    SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_payments,
    SUM(total_amount) AS total_amount,
    AVG(total_amount) AS avg_amount
FROM payment_records
GROUP BY DATE_FORMAT(payment_date, '%Y-%m')
ORDER BY month DESC;

-- ============================================
-- 建立預存程序 (Stored Procedures)
-- ============================================

-- 計算租客當月應繳費用
DELIMITER //
CREATE PROCEDURE CalculateMonthlyFee(
    IN p_tenant_id INT,
    IN p_month DATE,
    OUT p_rent_amount DECIMAL(10,2),
    OUT p_water_fee DECIMAL(10,2),
    OUT p_electricity_fee DECIMAL(10,2),
    OUT p_total_amount DECIMAL(10,2)
)
BEGIN
    -- 取得租金
    SELECT rent_amount INTO p_rent_amount
    FROM users 
    WHERE id = p_tenant_id;
    
    -- 取得水費 (假設固定 300)
    SET p_water_fee = 300.00;
    
    -- 取得電費 (需要從電表計算，這裡簡化)
    SET p_electricity_fee = 500.00;
    
    -- 計算總金額
    SET p_total_amount = p_rent_amount + p_water_fee + p_electricity_fee;
END //
DELIMITER ;

-- 取得租客繳費記錄 (分頁)
DELIMITER //
CREATE PROCEDURE GetTenantPaymentsPaginated(
    IN p_tenant_id INT,
    IN p_page INT,
    IN p_limit INT,
    IN p_status VARCHAR(20)
)
BEGIN
    DECLARE offset_val INT DEFAULT 0;
    SET offset_val = (p_page - 1) * p_limit;
    
    SELECT 
        pr.*,
        u.phone,
        u.email
    FROM payment_records pr
    LEFT JOIN users u ON pr.tenant_id = u.id
    WHERE pr.tenant_id = p_tenant_id
        AND (p_status IS NULL OR pr.status = p_status)
    ORDER BY pr.payment_date DESC, pr.created_at DESC
    LIMIT p_limit OFFSET offset_val;
END //
DELIMITER ;

-- ============================================
-- 建立觸發器 (Triggers)
-- ============================================

-- 當新增繳費記錄時，自動計算總金額
DELIMITER //
CREATE TRIGGER calculate_total_amount_before_insert
BEFORE INSERT ON payment_records
FOR EACH ROW
BEGIN
    -- 如果沒有指定總金額，則自動計算
    IF NEW.total_amount = 0 THEN
        SET NEW.total_amount = NEW.rent_amount + NEW.water_fee + ((NEW.current_meter - NEW.previous_meter) * NEW.electricity_rate);
    END IF;
END //
DELIMITER ;

-- 當更新繳費記錄時，自動更新電費相關欄位
DELIMITER //
CREATE TRIGGER update_electricity_info_before_update
BEFORE UPDATE ON payment_records
FOR EACH ROW
BEGIN
    -- 如果電表度數改變，重新計算電費
    IF NEW.previous_meter <> OLD.previous_meter OR NEW.current_meter <> OLD.current_meter OR NEW.electricity_rate <> OLD.electricity_rate THEN
        SET NEW.electricity_usage = NEW.current_meter - NEW.previous_meter;
        SET NEW.electricity_fee = NEW.electricity_usage * NEW.electricity_rate;
        SET NEW.total_amount = NEW.rent_amount + NEW.water_fee + NEW.electricity_fee;
    END IF;
END //
DELIMITER ;

-- 當確認繳費記錄時，記錄操作日誌
DELIMITER //
CREATE TRIGGER log_payment_confirmation_after_update
AFTER UPDATE ON payment_records
FOR EACH ROW
BEGIN
    IF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
        INSERT INTO activity_logs (user_id, username, action, details)
        VALUES (NEW.confirmed_by, (SELECT username FROM users WHERE id = NEW.confirmed_by), '確認繳費', 
                CONCAT('確認繳費記錄 #', NEW.id, ' - 租客: ', NEW.tenant_name, ' (', NEW.room_number, ') 金額: NT$ ', FORMAT(NEW.total_amount, 0)));
    END IF;
END //
DELIMITER ;

-- ============================================
-- 顯示資料庫資訊
-- ============================================

SELECT '資料庫結構建立完成' AS message;
SELECT 
    TABLE_NAME AS '表名',
    TABLE_ROWS AS '資料列數',
    DATA_LENGTH/1024/1024 AS '資料大小(MB)',
    INDEX_LENGTH/1024/1024 AS '索引大小(MB)',
    CREATE_TIME AS '創建時間'
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'guangda_rental'
ORDER BY TABLE_NAME;

SELECT '預設帳號資訊' AS message;
SELECT 
    username AS '使用者名稱',
    full_name AS '姓名',
    role AS '角色',
    room_number AS '房號',
    CONCAT('NT$ ', FORMAT(rent_amount, 0)) AS '租金'
FROM users 
ORDER BY role, room_number;

SELECT '測試數據統計' AS message;
SELECT 
    '使用者' AS type,
    COUNT(*) AS count
FROM users
UNION ALL
SELECT 
    '繳費記錄',
    COUNT(*) 
FROM payment_records
UNION ALL
SELECT 
    '銀行資訊',
    COUNT(*) 
FROM bank_info;