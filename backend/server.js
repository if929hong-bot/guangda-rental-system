const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const AWS = require('aws-sdk');
const path = require('path');
require('dotenv').config();

const app = express();

// 重要：Railway 会自动设置 PORT 环境变量
const PORT = process.env.PORT || 3000;

// 调试信息
console.log('========== 环境信息 ==========');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('当前目录:', __dirname);
console.log('==============================');

// 中介軟體
app.use(cors());
app.use(express.json());

// 获取项目根目录路径（server.js 在 backend/ 目录中）
const projectRoot = path.join(__dirname, '..');

// 提供前端靜態檔案
app.use(express.static(path.join(projectRoot, 'frontend')));

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

// ========== 全局数据存储 ==========
// 为了数据持久化，我们将数据存储在文件中
const fs = require('fs');
const DATA_FILE = path.join(__dirname, 'data.json');

// 初始化或加载数据
let sharedData = {
    payments: [],      // 所有缴费记录
    images: [],        // 所有图片
    tenants: [],       // 所有租客
    bankInfo: {        // 银行信息
        bank_name: '元大銀行',
        branch_name: '營業部',
        account_name: '廣大城',
        account_number: '1111-2222-3333',
        updated_at: new Date().toISOString()
    }
};

// 尝试从文件加载数据
try {
    if (fs.existsSync(DATA_FILE)) {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        sharedData = JSON.parse(data);
        console.log('数据已从文件加载');
    } else {
        // 初始化测试数据
        sharedData.tenants.push({
            id: 2,
            username: 'tenant',
            name: '測試租客',
            email: 'tenant@example.com',
            phone: '0911111111',
            room_number: '101',
            lease_start: '2024-01-01',
            lease_end: '2024-12-31',
            rent_amount: '15000',
            role: 'tenant',
            created_at: new Date().toISOString()
        });
        saveData();
        console.log('测试数据已初始化');
    }
} catch (error) {
    console.error('加载数据文件失败:', error);
}

// 保存数据到文件
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(sharedData, null, 2));
        console.log('数据已保存到文件');
    } catch (error) {
        console.error('保存数据失败:', error);
    }
}

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

// ========== API 路由 ==========

// 1. 健康检查
app.get('/health', (req, res) => {
    console.log('根路径健康检查被调用');
    res.status(200).send('OK');
});

// 2. 首页路由
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>廣大城租客管理系統</title>
            <meta charset="UTF-8">
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                h1 { color: #2c3e50; }
                .status { color: green; font-weight: bold; }
                .links { margin-top: 30px; }
                .links a { display: inline-block; margin: 10px; padding: 10px 20px; 
                           background: #3498db; color: white; text-decoration: none; 
                           border-radius: 5px; }
                .links a:hover { background: #2980b9; }
            </style>
        </head>
        <body>
            <h1>廣大城租客管理系統</h1>
            <p class="status">✅ 伺服器運行正常</p>
            <p>時間：${new Date().toLocaleString('zh-TW')}</p>
            <div class="links">
                <a href="/login.html">租客登入</a>
                <a href="/admin.html">管理員登入</a>
                <a href="/register.html">註冊帳號</a>
                <a href="/api/health">系統狀態</a>
            </div>
        </body>
        </html>
    `);
});

// 3. 前端页面路由
app.get('/login', (req, res) => {
    res.sendFile(path.join(projectRoot, 'frontend', 'login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(projectRoot, 'frontend', 'admin.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(projectRoot, 'frontend', 'register.html'));
});

app.get('/tenant', (req, res) => {
    res.sendFile(path.join(projectRoot, 'frontend', 'tenant.html'));
});

// ========== 用户认证 API ==========

// 4. 登入 API
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
        
        // 租客帳號驗證
        if (role === 'tenant') {
            // 先檢查測試帳號
            if (username === 'tenant' && password === '123456') {
                const tenant = sharedData.tenants.find(t => t.username === 'tenant');
                if (tenant) {
                    const token = jwt.sign(
                        { 
                            id: tenant.id, 
                            username: tenant.username, 
                            role: 'tenant',
                            name: tenant.name
                        },
                        JWT_SECRET,
                        { expiresIn: '24h' }
                    );
                    
                    return res.json({
                        success: true,
                        token,
                        user: tenant
                    });
                }
            }
            
            // 檢查註冊的帳號
            const tenant = sharedData.tenants.find(t => 
                t.username === username && t.password === password
            );
            
            if (tenant) {
                const token = jwt.sign(
                    { 
                        id: tenant.id, 
                        username: tenant.username, 
                        role: 'tenant',
                        name: tenant.name
                    },
                    JWT_SECRET,
                    { expiresIn: '24h' }
                );
                
                return res.json({
                    success: true,
                    token,
                    user: tenant
                });
            }
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

// 5. 註冊 API
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
        
        // 檢查用戶名是否已存在
        if (sharedData.tenants.some(t => t.username === username)) {
            return res.status(400).json({
                success: false,
                message: '用戶名已存在'
            });
        }
        
        // 創建新用戶
        const newUser = {
            id: Date.now(),
            username,
            password, // 注意：實際應用中應該加密儲存
            name,
            room_number,
            email,
            phone,
            lease_start,
            lease_end,
            rent_amount,
            role: 'tenant',
            created_at: new Date().toISOString()
        };
        
        // 添加到租客列表
        sharedData.tenants.push(newUser);
        saveData();
        
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
        
        // 不返回密碼
        const { password: _, ...userWithoutPassword } = newUser;
        
        res.json({
            success: true,
            message: '註冊成功',
            token,
            user: userWithoutPassword
        });
    } catch (error) {
        console.error('註冊錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// ========== 銀行資訊 API ==========

// 6. 取得銀行資訊（租客和管理員都能用）
app.get('/api/bank-info', authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            bankInfo: sharedData.bankInfo
        });
    } catch (error) {
        console.error('取得銀行資訊錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// 7. 更新銀行資訊（僅管理員）
app.put('/api/bank-info', authenticateToken, checkAdmin, async (req, res) => {
    try {
        const { bank_name, branch_name, account_name, account_number } = req.body;
        
        // 更新銀行資訊
        sharedData.bankInfo = {
            bank_name,
            branch_name,
            account_name,
            account_number,
            updated_at: new Date().toISOString()
        };
        saveData();
        
        res.json({
            success: true,
            message: '銀行資訊已更新',
            bankInfo: sharedData.bankInfo
        });
    } catch (error) {
        console.error('更新銀行資訊錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// ========== 繳費記錄 API ==========

// 8. 取得繳費記錄
app.get('/api/payments', authenticateToken, async (req, res) => {
    try {
        let userPayments;
        
        // 管理員可以查看所有繳費記錄
        if (req.user.role === 'admin') {
            userPayments = sharedData.payments;
        } else {
            // 租客只能看到自己的繳費記錄
            userPayments = sharedData.payments.filter(p => p.tenant_id === req.user.id);
        }
        
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

// 9. 新增繳費記錄
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
            id: sharedData.payments.length + 1,
            tenant_id: req.user.id,
            tenant_name: req.user.name || req.user.username,
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
        
        sharedData.payments.push(newPayment);
        saveData();
        
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

// ========== 圖片上傳 API ==========

// 10. 取得圖片列表
app.get('/api/images', authenticateToken, async (req, res) => {
    try {
        let userImages;
        
        // 管理員可以查看所有圖片
        if (req.user.role === 'admin') {
            userImages = sharedData.images;
        } else {
            // 租客只能看到自己的圖片
            userImages = sharedData.images.filter(img => img.tenant_id === req.user.id);
        }
        
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

// 11. 取得上傳簽章 URL
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

// 12. 儲存圖片資訊
app.post('/api/images/save', authenticateToken, async (req, res) => {
    try {
        const { image_url, file_name, file_size } = req.body;
        
        const newImage = {
            id: sharedData.images.length + 1,
            tenant_id: req.user.id,
            tenant_name: req.user.name || req.user.username,
            image_url,
            file_name,
            file_size,
            uploaded_at: new Date().toISOString()
        };
        
        sharedData.images.push(newImage);
        saveData();
        
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

// ========== 管理員 API ==========

// 13. 取得所有租客
app.get('/api/admin/tenants', authenticateToken, checkAdmin, async (req, res) => {
    try {
        // 移除密碼字段
        const tenantsWithoutPassword = sharedData.tenants.map(tenant => {
            const { password, ...tenantWithoutPassword } = tenant;
            return tenantWithoutPassword;
        });
        
        res.json({
            success: true,
            tenants: tenantsWithoutPassword
        });
    } catch (error) {
        console.error('取得租客列表錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// 14. API健康檢查
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: '系統運作正常',
        timestamp: new Date().toISOString(),
        dataCounts: {
            tenants: sharedData.tenants.length,
            payments: sharedData.payments.length,
            images: sharedData.images.length
        }
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
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`廣大城租客管理系統`);
    console.log(`伺服器運行在端口: ${PORT}`);
    console.log(`绑定到: 0.0.0.0`);
    console.log(`外部访问: https://guangda-rental-system-production.up.railway.app`);
    console.log(`=========================================`);
});