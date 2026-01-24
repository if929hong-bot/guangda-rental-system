-- 建立資料庫
CREATE DATABASE IF NOT EXISTS guangda_rental;
USE guangda_rental;

-- 使用者表
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(20),
    role ENUM('admin', 'tenant') NOT NULL DEFAULT 'tenant',
    room_number VARCHAR(10),
    lease_start DATE,
    lease_end DATE,
    rent_amount DECIMAL(10,2),
    full_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_role (role),
    INDEX idx_room_number (room_number)
);

-- 銀行資訊表
CREATE TABLE IF NOT EXISTS bank_info (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bank_name VARCHAR(100) NOT NULL,
    branch_name VARCHAR(100) NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 繳費記錄表
CREATE TABLE IF NOT EXISTS payment_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    tenant_name VARCHAR(100),
    payment_date DATE NOT NULL,
    rent_amount DECIMAL(10,2) NOT NULL,
    water_fee DECIMAL(10,2) DEFAULT 0,
    electricity_rate DECIMAL(10,2) NOT NULL,
    previous_meter INT NOT NULL,
    current_meter INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    account_last_five VARCHAR(5),
    status ENUM('pending', 'confirmed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_status (status),
    INDEX idx_payment_date (payment_date),
    INDEX idx_created_at (created_at)
);

-- 上傳圖片表
CREATE TABLE IF NOT EXISTS uploaded_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tenant_id INT NOT NULL,
    tenant_name VARCHAR(100),
    image_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255),
    file_size INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_tenant_id (tenant_id),
    INDEX idx_uploaded_at (uploaded_at)
);

-- 插入預設管理員帳號 (密碼: admin123)
INSERT INTO users (username, password, email, phone, role, full_name) 
VALUES ('admin', '$2b$10$N9qo8uLOickgx2ZMRZoMyeH7rYF5B6Yl6Jqjq8L5A5r5T8V5v5V5W', 'admin@guangda.com', '0912345678', 'admin', '系統管理員')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- 插入預設銀行資訊
INSERT INTO bank_info (bank_name, branch_name, account_name, account_number, updated_by)
VALUES ('元大銀行', '營業部', '廣大城', '111122223333', 1)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;