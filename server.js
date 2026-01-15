require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
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
  
  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: '無效的授權令牌' });
    }
    req.user = user;
    next();
  });
};

// Cloudflare R2 配置
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
  }
});

// API 路由

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
      process.env.JWT_SECRET || 'your-secret-key',
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
  const { username, password, name, phone, email, room_number, lease_start, lease_end } = req.body;
  
  // 檢查用戶名是否已存在
  db.get('SELECT id FROM users WHERE username = ?', [username], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: '資料庫錯誤' });
    }
    
    if (existingUser) {
      return res.status(400).json({ error: '用戶名已存在' });
    }
    
    // 加密密碼
    const passwordHash = bcrypt.hashSync(password, 10);
    
    // 插入新用戶
    db.run(
      `INSERT INTO users (username, password_hash, name, phone, email, room_number, lease_start, lease_end, role) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'tenant')`,
      [username, passwordHash, name, phone, email, room_number, lease_start, lease_end],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '註冊失敗' });
        }
        
        res.json({ message: '註冊成功', userId: this.lastID });
      }
    );
  });
});

// 3. 獲取銀行資訊
app.get('/api/bank-info', authenticateToken, (req, res) => {
  db.get('SELECT * FROM bank_info ORDER BY updated_at DESC LIMIT 1', (err, bankInfo) => {
    if (err) {
      return res.status(500).json({ error: '獲取銀行資訊失敗' });
    }
    
    if (!bankInfo) {
      return res.json({ message: '尚未設定銀行資訊' });
    }
    
    res.json(bankInfo);
  });
});

// 4. 更新銀行資訊 (僅管理員)
app.put('/api/bank-info', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '僅管理員可操作' });
  }
  
  const { bank_name, branch_name, account_name, account_number } = req.body;
  
  db.run(
    `INSERT INTO bank_info (bank_name, branch_name, account_name, account_number, updated_by) 
     VALUES (?, ?, ?, ?, ?)`,
    [bank_name, branch_name, account_name, account_number, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '更新銀行資訊失敗' });
      }
      
      res.json({ message: '銀行資訊更新成功', id: this.lastID });
    }
  );
});

// 5. 獲取所有租客 (管理員)
app.get('/api/tenants', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '僅管理員可操作' });
  }
  
  db.all('SELECT id, username, name, phone, email, room_number, lease_start, lease_end FROM users WHERE role = "tenant"', (err, tenants) => {
    if (err) {
      return res.status(500).json({ error: '獲取租客列表失敗' });
    }
    
    res.json(tenants);
  });
});

// 6. 上傳繳費記錄
app.post('/api/payments', authenticateToken, (req, res) => {
  const { payment_date, rent, water_fee, electricity_fee, previous_meter, current_meter, last_five_digits } = req.body;
  
  const total_amount = parseFloat(rent) + parseFloat(water_fee || 0) + parseFloat(electricity_fee || 0);
  
  db.run(
    `INSERT INTO payment_records (tenant_id, payment_date, rent, water_fee, electricity_fee, previous_meter, current_meter, total_amount, last_five_digits) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, payment_date, rent, water_fee || 0, electricity_fee || 0, previous_meter, current_meter, total_amount, last_five_digits],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '上傳繳費記錄失敗' });
      }
      
      res.json({ message: '繳費記錄上傳成功', id: this.lastID });
    }
  );
});

// 7. 獲取繳費記錄
app.get('/api/payments', authenticateToken, (req, res) => {
  if (req.user.role === 'admin') {
    // 管理員獲取所有記錄
    db.all(
      `SELECT p.*, u.name as tenant_name, u.room_number 
       FROM payment_records p 
       LEFT JOIN users u ON p.tenant_id = u.id 
       ORDER BY p.created_at DESC`,
      (err, payments) => {
        if (err) {
          return res.status(500).json({ error: '獲取繳費記錄失敗' });
        }
        res.json(payments);
      }
    );
  } else {
    // 租客獲取自己的記錄
    db.all(
      'SELECT * FROM payment_records WHERE tenant_id = ? ORDER BY created_at DESC',
      [req.user.id],
      (err, payments) => {
        if (err) {
          return res.status(500).json({ error: '獲取繳費記錄失敗' });
        }
        res.json(payments);
      }
    );
  }
});

// 8. 獲取圖片上傳簽名URL
app.post('/api/upload/sign-url', authenticateToken, async (req, res) => {
  const { filename, contentType } = req.body;
  
  const key = `${req.user.id}/${Date.now()}-${filename}`;
  
  try {
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME || 'guangda-rental',
      Key: key,
      ContentType: contentType
    });
    
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    const imageUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    
    // 保存到資料庫
    db.run(
      'INSERT INTO uploaded_images (tenant_id, image_url, filename) VALUES (?, ?, ?)',
      [req.user.id, imageUrl, filename],
      function(err) {
        if (err) {
          console.error('保存圖片記錄失敗:', err);
        }
      }
    );
    
    res.json({ signedUrl, imageUrl, key });
  } catch (error) {
    console.error('生成簽名URL失敗:', error);
    res.status(500).json({ error: '生成上傳連結失敗' });
  }
});

// 9. 獲取圖片列表
app.get('/api/images', authenticateToken, (req, res) => {
  if (req.user.role === 'admin') {
    const tenantId = req.query.tenantId;
    
    if (tenantId) {
      // 管理員查看特定租客圖片
      db.all(
        'SELECT * FROM uploaded_images WHERE tenant_id = ? ORDER BY upload_time DESC',
        [tenantId],
        (err, images) => {
          if (err) {
            return res.status(500).json({ error: '獲取圖片列表失敗' });
          }
          res.json(images);
        }
      );
    } else {
      // 管理員查看所有圖片
      db.all(
        `SELECT i.*, u.name as tenant_name, u.room_number 
         FROM uploaded_images i 
         LEFT JOIN users u ON i.tenant_id = u.id 
         ORDER BY i.upload_time DESC`,
        (err, images) => {
          if (err) {
            return res.status(500).json({ error: '獲取圖片列表失敗' });
          }
          res.json(images);
        }
      );
    }
  } else {
    // 租客查看自己的圖片
    db.all(
      'SELECT * FROM uploaded_images WHERE tenant_id = ? ORDER BY upload_time DESC',
      [req.user.id],
      (err, images) => {
        if (err) {
          return res.status(500).json({ error: '獲取圖片列表失敗' });
        }
        res.json(images);
      }
    );
  }
});

// 10. 獲取用戶個人資料
app.get('/api/profile', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, username, name, phone, email, room_number, lease_start, lease_end FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: '用戶不存在' });
      }
      res.json(user);
    }
  );
});

// 靜態檔案服務
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`伺服器運行在 http://localhost:${PORT}`);
  console.log(`管理員帳號: admin / admin123`);
});