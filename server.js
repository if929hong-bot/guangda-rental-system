require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto'); // 新增這行

// ========================================
// 自動生成 JWT_SECRET（如果未設定）
// ========================================
if (!process.env.JWT_SECRET) {
    const generatedSecret = crypto.randomBytes(64).toString('hex');
    console.log('========================================');
    console.log('⚠️  警告：未設定 JWT_SECRET 環境變數');
    console.log('已自動生成新的 JWT_SECRET：');
    console.log('========================================');
    console.log(generatedSecret);
    console.log('========================================');
    console.log('請將以下值複製到 Zeabur 環境變數中：');
    console.log('JWT_SECRET=' + generatedSecret);
    console.log('========================================');
    
    process.env.JWT_SECRET = generatedSecret;
}
// ========================================

const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 初始化資料庫
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    // 建立用戶表
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'tenant',
        name TEXT,
        phone TEXT,
        email TEXT,
        room_number TEXT,
        lease_start DATE,
        lease_end DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // 建立銀行資訊表
    db.run(`
        CREATE TABLE IF NOT EXISTS bank_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank_name TEXT NOT NULL,
        branch_name TEXT NOT NULL,
        account_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by INTEGER
        )
    `);

    // 建立繳費記錄表
    db.run(`
        CREATE TABLE IF NOT EXISTS payment_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        payment_date DATE NOT NULL,
        rent REAL NOT NULL,
        water_fee REAL DEFAULT 0,
        electricity_fee REAL DEFAULT 0,
        previous_meter REAL,
        current_meter REAL,
        total_amount REAL NOT NULL,
        last_five_digits TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users (id)
        )
    `);

    // 建立圖片記錄表
    db.run(`
        CREATE TABLE IF NOT EXISTS uploaded_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        image_url TEXT NOT NULL,
        filename TEXT NOT NULL,
        description TEXT,
        upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES users (id)
        )
    `);

    // 插入預設管理員帳號 (username: admin, password: admin123)
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(
        `INSERT OR IGNORE INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)`,
        ['admin', adminPassword, 'admin', '系統管理員']
    );

    // 插入預設銀行資訊
    db.run(
        `INSERT OR IGNORE INTO bank_info (bank_name, branch_name, account_name, account_number) VALUES (?, ?, ?, ?)`,
        ['元大銀行', '營業部', '廣大城', '1111-2222-3333']
    );
});

// JWT 驗證中間件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: '未提供授權令牌' });
    }
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '無效的授權令牌' });
        }
        req.user = user;
        next();
    });
};

// Cloudflare R2 配置（如果沒有設定環境變數，使用預設值）
const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ACCOUNT_ID ? 
        `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : 
        'https://fake.r2.cloudflarestorage.com',
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || 'dummy',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || 'dummy'
    }
});

// ... 後續的 API 路由保持不變 ...

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`伺服器正在監聽端口 ${PORT}`);
});