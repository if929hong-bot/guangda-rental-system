require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// 修正：簡化 JWT_SECRET 處理
// ========================================
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

if (!process.env.JWT_SECRET) {
    console.log('========================================');
    console.log('⚠️  注意：使用自動生成的 JWT_SECRET');
    console.log('請在 Zeabur 中設定 JWT_SECRET 環境變數');
    console.log('========================================');
}
// ========================================

// 中間件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 初始化資料庫
const db = new sqlite3.Database('./database.db');

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

    // 插入預設管理員帳號（修改為你指定的兩組帳號）
    const password1 = bcrypt.hashSync('gdc0982098079', 10);
    const password2 = bcrypt.hashSync('gdc0975521219', 10);

    db.run(
        `INSERT OR IGNORE INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)`,
        ['0982098079', password1, 'admin', '管理員一']
    );

    db.run(
        `INSERT OR IGNORE INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)`,
        ['0975521219', password2, 'admin', '管理員二']
    );

    // 插入預設租客測試帳號
    const tenantPassword = bcrypt.hashSync('tenant123', 10);
    db.run(
        `INSERT OR IGNORE INTO users (username, password_hash, role, name, room_number) VALUES (?, ?, ?, ?, ?)`,
        ['tenant1', tenantPassword, 'tenant', '測試租客一', 'A101']
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
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: '無效的授權令牌' });
        }
        req.user = user;
        next();
    });
};

// R2 配置（修正錯誤處理）
let s3Client;
if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
    s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
        }
    });
    console.log('✅ R2 客戶端已初始化');
} else {
    console.log('⚠️  R2 環境變數未設定，圖片上傳功能將無法使用');
    s3Client = null;
}

// API 路由...

// 1. 登入
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: '帳號或密碼錯誤' });
        }
        
        if (!bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ error: '帳號或密碼錯誤' });
        }
        
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({ 
            token, 
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                room_number: user.room_number
            }
        });
    });
});

// 2. 註冊
app.post('/api/register', (req, res) => {
    const { username, password, name, phone, email, room_number } = req.body;
    
    // 檢查用戶名是否已存在
    db.get('SELECT id FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
            return res.status(500).json({ error: '資料庫錯誤' });
        }
        
        if (row) {
            return res.status(400).json({ error: '用戶名已存在' });
        }
        
        // 加密密碼
        const passwordHash = bcrypt.hashSync(password, 10);
        
        // 插入新用戶
        db.run(
            `INSERT INTO users (username, password_hash, role, name, phone, email, room_number) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [username, passwordHash, 'tenant', name, phone, email, room_number],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: '註冊失敗' });
                }
                
                res.json({ 
                    success: true, 
                    message: '註冊成功',
                    userId: this.lastID 
                });
            }
        );
    });
});

// 3. 獲取銀行資訊
app.get('/api/bank-info', (req, res) => {
    db.get('SELECT * FROM bank_info ORDER BY id DESC LIMIT 1', (err, row) => {
        if (err) {
            return res.status(500).json({ error: '資料庫錯誤' });
        }
        
        if (!row) {
            return res.status(404).json({ error: '未找到銀行資訊' });
        }
        
        res.json(row);
    });
});

// 4. 更新銀行資訊（僅管理員）
app.put('/api/bank-info', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '僅管理員可修改銀行資訊' });
    }
    
    const { bank_name, branch_name, account_name, account_number } = req.body;
    
    db.run(
        `UPDATE bank_info SET bank_name = ?, branch_name = ?, account_name = ?, account_number = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = (SELECT MAX(id) FROM bank_info)`,
        [bank_name, branch_name, account_name, account_number, req.user.id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '更新失敗' });
            }
            
            res.json({ success: true, message: '銀行資訊已更新' });
        }
    );
});

// 5. 獲取用戶資訊
app.get('/api/user-info', authenticateToken, (req, res) => {
    db.get('SELECT id, username, name, role, phone, email, room_number, lease_start, lease_end FROM users WHERE id = ?', [req.user.id], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: '用戶不存在' });
        }
        
        res.json(user);
    });
});

// 6. 獲取繳費記錄（租客只能看自己的，管理員可看全部）
app.get('/api/payments', authenticateToken, (req, res) => {
    let query = 'SELECT * FROM payment_records';
    let params = [];
    
    if (req.user.role === 'tenant') {
        query += ' WHERE tenant_id = ? ORDER BY payment_date DESC';
        params = [req.user.id];
    } else {
        query += ' ORDER BY payment_date DESC';
    }
    
    db.all(query, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: '資料庫錯誤' });
        }
        
        res.json(rows);
    });
});

// 7. 新增繳費記錄（管理員）
app.post('/api/payments', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '僅管理員可新增繳費記錄' });
    }
    
    const { tenant_id, payment_date, rent, water_fee, electricity_fee, previous_meter, current_meter, total_amount, last_five_digits } = req.body;
    
    db.run(
        `INSERT INTO payment_records (tenant_id, payment_date, rent, water_fee, electricity_fee, previous_meter, current_meter, total_amount, last_five_digits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tenant_id, payment_date, rent, water_fee, electricity_fee, previous_meter, current_meter, total_amount, last_five_digits],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '新增失敗' });
            }
            
            res.json({ 
                success: true, 
                message: '繳費記錄已新增',
                paymentId: this.lastID 
            });
        }
    );
});

// 8. 更新繳費狀態（管理員）
app.put('/api/payments/:id/status', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '僅管理員可修改狀態' });
    }
    
    const { status } = req.body;
    const paymentId = req.params.id;
    
    db.run(
        `UPDATE payment_records SET status = ? WHERE id = ?`,
        [status, paymentId],
        function(err) {
            if (err) {
                return res.status(500).json({ error: '更新失敗' });
            }
            
            res.json({ success: true, message: '狀態已更新' });
        }
    );
});

// 9. 獲取所有租客（管理員用）
app.get('/api/tenants', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: '僅管理員可查看所有租客' });
    }
    
    db.all('SELECT id, username, name, phone, email, room_number, lease_start, lease_end FROM users WHERE role = "tenant" ORDER BY room_number', (err, rows) => {
        if (err) {
            return res.status(500).json({ error: '資料庫錯誤' });
        }
        
        res.json(rows);
    });
});

// 10. 生成圖片上傳網址
app.post('/api/upload-url', authenticateToken, (req, res) => {
    if (!s3Client) {
        return res.status(503).json({ error: '圖片上傳功能未啟用' });
    }
    
    const { filename, contentType } = req.body;
    const key = `uploads/${Date.now()}-${filename}`;
    
    const command = new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
    });
    
    getSignedUrl(s3Client, command, { expiresIn: 3600 })
        .then(url => {
            // 記錄到資料庫
            db.run(
                `INSERT INTO uploaded_images (tenant_id, image_url, filename) VALUES (?, ?, ?)`,
                [req.user.id, `https://${process.env.R2_PUBLIC_URL}/${key}`, filename],
                function(err) {
                    if (err) {
                        console.error('圖片記錄失敗:', err);
                    }
                }
            );
            
            res.json({ url, key });
        })
        .catch(err => {
            console.error('生成上傳網址失敗:', err);
            res.status(500).json({ error: '生成上傳網址失敗' });
        });
});

// 11. 健康檢查
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        database: 'connected',
        mode: process.env.NODE_ENV || 'development'
    });
});

// SPA 路由處理 - 所有非 API 請求都回傳 index.html
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log('========================================');
    console.log('🚀 伺服器啟動成功！');
    console.log(`📡 監聽連接埠: ${PORT}`);
    console.log(`🔗 訪問網址: http://localhost:${PORT}`);
    console.log(`🔐 JWT_SECRET: ${process.env.JWT_SECRET ? '已設定' : '未設定（使用自動生成）'}`);
    console.log(`💾 資料庫: SQLite 檔案模式 (database.db)`);
    console.log(`👤 已建立管理員帳號：0982098079 / 0975521219`);
    console.log(`👤 已建立租客帳號：tenant1 / tenant123`);
    console.log(`💰 預設銀行：元大銀行 營業部 1111-2222-3333`);
    console.log('========================================');
});