const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const AWS = require('aws-sdk');
const path = require('path'); // 新增 path 模組
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中介軟體
app.use(cors());
app.use(express.json());

// 提供前端靜態檔案 - 修改為指向 frontend 目錄
app.use(express.static(path.join(__dirname, '../frontend')));

// JWT 密鑰
const JWT_SECRET = process.env.JWT_SECRET || 'guangda-rental-secret-key';

// 建立資料庫連線池
let pool;
try {
    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'guangda_rental',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });
    console.log('資料庫連線池建立成功');
} catch (error) {
    console.error('資料庫連線失敗:', error);
}

// Cloudflare R2 設定
const s3 = new AWS.S3({
    endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    accessKeyId: process.env.CF_ACCESS_KEY_ID,
    secretAccessKey: process.env.CF_SECRET_ACCESS_KEY,
    signatureVersion: 'v4',
    region: 'auto'
});

const CF_BUCKET_NAME = process.env.CF_BUCKET_NAME || 'guangda-rental-images';
const CF_PUBLIC_DOMAIN = process.env.CF_PUBLIC_DOMAIN || 'pub-xxx.r2.dev';

// 驗證 Token 中介軟體
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ success: false, message: '需要登入' });
    }
    
    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({ success: false, message: '無效的 token' });
    }
}

// 檢查管理員權限
function checkAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ success: false, message: '需要管理員權限' });
    }
    next();
}

// 1. 首頁路由 - 修改為指向 frontend 目錄的 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// 2. 登入 API
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        
        // 管理員帳號驗證
        if (role === 'admin') {
            const admins = [
                { username: '0975521219', password: 'gdc0975521219', name: '管理員A' },
                { username: '0982098079', password: 'gdc0982098079', name: '管理員B' }
            ];
            
            const admin = admins.find(a => a.username === username && a.password === password);
            
            if (admin) {
                const token = jwt.sign(
                    { 
                        id: admin.username, 
                        username: admin.username, 
                        role: 'admin',
                        name: admin.name
                    },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                return res.json({
                    success: true,
                    token,
                    user: {
                        id: admin.username,
                        username: admin.username,
                        name: admin.name,
                        email: `${admin.username}@guangda.com`,
                        phone: admin.username,
                        role: 'admin'
                    }
                });
            }
        }
        
        // 租客測試帳號
        if (username === 'tenant' && password === '123456' && role === 'tenant') {
            const token = jwt.sign(
                { id: 2, username: 'tenant', role: 'tenant' },
                JWT_SECRET,
                { expiresIn: '24h' }
            );
            
            return res.json({
                success: true,
                token,
                user: {
                    id: 2,
                    username: 'tenant',
                    name: '測試租客',
                    email: 'tenant@example.com',
                    phone: '0911111111',
                    role: 'tenant',
                    room_number: '101',
                    lease_start: '2024-01-01',
                    lease_end: '2024-12-31',
                    rent_amount: '15000'
                }
            });
        }
        
        res.status(401).json({ 
            success: false, 
            message: '使用者名稱或密碼錯誤' 
        });
    } catch (error) {
        console.error('登入錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// 3. 註冊 API
app.post('/api/register', async (req, res) => {
    try {
        const { 
            username, 
            password, 
            name, 
            room_number, 
            email, 
            phone, 
            lease_start, 
            lease_end, 
            rent_amount 
        } = req.body;
        
        // 簡單的註冊邏輯
        const newUser = {
            id: Date.now(),
            username,
            name,
            room_number,
            email,
            phone,
            lease_start,
            lease_end,
            rent_amount,
            role: 'tenant'
        };
        
        // 產生 token
        const token = jwt.sign(
            { 
                id: newUser.id, 
                username: newUser.username, 
                role: newUser.role 
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        res.json({
            success: true,
            message: '註冊成功',
            token,
            user: newUser
        });
    } catch (error) {
        console.error('註冊錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// 4. 銀行資訊 API
app.get('/api/bank-info', authenticateToken, async (req, res) => {
    try {
        // 模擬銀行資訊
        res.json({
            success: true,
            bankInfo: {
                bank_name: '元大銀行',
                branch_name: '營業部',
                account_name: '廣大城',
                account_number: '1111-2222-3333',
                updated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('取得銀行資訊錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

app.put('/api/bank-info', authenticateToken, checkAdmin, async (req, res) => {
    try {
        const { bank_name, branch_name, account_name, account_number } = req.body;
        
        res.json({
            success: true,
            message: '銀行資訊已更新',
            bankInfo: {
                bank_name,
                branch_name,
                account_name,
                account_number,
                updated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('更新銀行資訊錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// 5. 繳費記錄 API
const payments = []; // 暫時用陣列儲存

app.get('/api/payments', authenticateToken, async (req, res) => {
    try {
        // 只回傳當前使用者的繳費記錄
        const userPayments = payments.filter(p => p.tenant_id === req.user.id);
        
        res.json({
            success: true,
            payments: userPayments
        });
    } catch (error) {
        console.error('取得繳費記錄錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

app.post('/api/payments', authenticateToken, async (req, res) => {
    try {
        const {
            payment_date,
            rent_amount,
            water_fee,
            electricity_rate,
            previous_meter,
            current_meter,
            total_amount,
            account_last_five
        } = req.body;
        
        const newPayment = {
            id: payments.length + 1,
            tenant_id: req.user.id,
            payment_date,
            rent_amount,
            water_fee: water_fee || 0,
            electricity_rate,
            previous_meter,
            current_meter,
            total_amount,
            account_last_five,
            status: 'pending',
            created_at: new Date().toISOString()
        };
        
        payments.push(newPayment);
        
        res.json({
            success: true,
            message: '繳費記錄已提交',
            payment: newPayment
        });
    } catch (error) {
        console.error('新增繳費記錄錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// 6. 圖片上傳相關 API
const images = []; // 暫時用陣列儲存

app.get('/api/images', authenticateToken, async (req, res) => {
    try {
        const userImages = images.filter(img => img.tenant_id === req.user.id);
        
        res.json({
            success: true,
            images: userImages
        });
    } catch (error) {
        console.error('取得圖片列表錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// 取得上傳簽章 URL
app.post('/api/images/upload-url', authenticateToken, async (req, res) => {
    try {
        if (!process.env.CF_ACCOUNT_ID) {
            return res.status(500).json({
                success: false,
                message: 'Cloudflare R2 未設定'
            });
        }
        
        const fileName = `uploads/${req.user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const params = {
            Bucket: CF_BUCKET_NAME,
            Key: fileName,
            Expires: 300,
            ContentType: 'image/*'
        };
        
        const uploadUrl = s3.getSignedUrl('putObject', params);
        const publicUrl = `https://${CF_PUBLIC_DOMAIN}/${fileName}`;
        
        res.json({
            success: true,
            uploadUrl,
            publicUrl,
            fileName
        });
    } catch (error) {
        console.error('取得上傳 URL 錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// 儲存圖片資訊
app.post('/api/images/save', authenticateToken, async (req, res) => {
    try {
        const { image_url, file_name, file_size } = req.body;
        
        const newImage = {
            id: images.length + 1,
            tenant_id: req.user.id,
            image_url,
            file_name,
            file_size,
            uploaded_at: new Date().toISOString()
        };
        
        images.push(newImage);
        
        res.json({
            success: true,
            message: '圖片資訊已儲存',
            image: newImage
        });
    } catch (error) {
        console.error('儲存圖片資訊錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// 7. 管理員 API
// 取得所有租客
app.get('/api/admin/tenants', authenticateToken, checkAdmin, async (req, res) => {
    try {
        // 模擬租客資料
        const tenants = [
            {
                id: 2,
                username: 'tenant',
                name: '測試租客',
                email: 'tenant@example.com',
                phone: '0911111111',
                room_number: '101',
                lease_start: '2024-01-01',
                lease_end: '2024-12-31',
                rent_amount: '15000',
                created_at: new Date().toISOString()
            }
        ];
        
        res.json({
            success: true,
            tenants
        });
    } catch (error) {
        console.error('取得租客列表錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// 8. 健康檢查
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: '系統運作正常',
        timestamp: new Date().toISOString()
    });
});

// 處理 404
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        message: '找不到頁面' 
    });
});

// 啟動伺服器
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`廣大城租客管理系統`);
    console.log(`伺服器運行在 http://localhost:${PORT}`);
    console.log(`=========================================`);
});