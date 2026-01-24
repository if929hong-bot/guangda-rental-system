const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const AWS = require('aws-sdk');
const path = require('path');
const multer = require('multer'); // 新增 multer 處理檔案上傳
require('dotenv').config();

const app = express();

// 重要：Railway 會自動設置 PORT 環境變數
const PORT = process.env.PORT || 3000;

// 除錯資訊
console.log('========== 環境資訊 ==========');
console.log('PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('當前目錄:', __dirname);
console.log('==============================');

// 中介軟體
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // 新增：支援表單數據

// 配置 multer 用於本地檔案上傳
const storage = multer.memoryStorage(); // 使用記憶體儲存，可改為磁碟儲存
const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB 限制
        files: 5 // 最多5個檔案
    },
    fileFilter: (req, file, cb) => {
        // 允許的檔案類型
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('只允許上傳圖片檔案 (JPEG, JPG, PNG, GIF) 和 PDF'));
        }
    }
});

// 獲取項目根目錄路徑（server.js 在 backend/ 目錄中）
const projectRoot = path.join(__dirname, '..');

// ========== 靜態檔案服務設定 ==========
// 提供前端靜態檔案 - 確保路徑正確
app.use(express.static(path.join(projectRoot, 'frontend')));

// 提供 CSS 檔案（確保正確路徑）
app.use('/css', express.static(path.join(projectRoot, 'frontend', 'css')));

// 提供 JS 檔案（確保正確路徑）
app.use('/js', express.static(path.join(projectRoot, 'frontend', 'js')));

// 修正前端頁面路由（確保能正確訪問HTML檔案）
app.get('/', (req, res) => {
    res.sendFile(path.join(projectRoot, 'frontend', 'index.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(projectRoot, 'frontend', 'admin.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(projectRoot, 'frontend', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(projectRoot, 'frontend', 'register.html'));
});

app.get('/tenant', (req, res) => {
    res.sendFile(path.join(projectRoot, 'frontend', 'tenant.html'));
});

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
let s3 = null;
let CF_BUCKET_NAME = '';
let CF_PUBLIC_DOMAIN = '';

if (process.env.CF_ACCOUNT_ID && process.env.CF_ACCESS_KEY_ID) {
    s3 = new AWS.S3({
        endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        accessKeyId: process.env.CF_ACCESS_KEY_ID,
        secretAccessKey: process.env.CF_SECRET_ACCESS_KEY,
        signatureVersion: 'v4',
        region: 'auto'
    });
    
    CF_BUCKET_NAME = process.env.CF_BUCKET_NAME || 'guangda-rental-images';
    CF_PUBLIC_DOMAIN = process.env.CF_PUBLIC_DOMAIN || 'pub-xxx.r2.dev';
    console.log('Cloudflare R2 設定完成');
} else {
    console.log('Cloudflare R2 未設定，使用本地儲存');
}

// ========== 全域資料儲存 ==========
const fs = require('fs');
const DATA_FILE = path.join(__dirname, 'data.json');

// 初始化或加載資料
let sharedData = {
    payments: [],
    images: [],
    tenants: [],
    bankInfo: {
        bank_name: '元大銀行',
        branch_name: '營業部',
        account_name: '廣大城',
        account_number: '1111-2222-3333',
        updated_at: new Date().toISOString()
    }
};

// 初始化資料夾
const UPLOADS_DIR = path.join(projectRoot, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    console.log('上傳資料夾已建立:', UPLOADS_DIR);
}

// 嘗試從檔案加載資料
function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            sharedData = JSON.parse(data);
            console.log('資料已從檔案加載');
        } else {
            // 初始化測試資料
            sharedData.tenants.push({
                id: 2,
                username: 'tenant',
                password: '123456',
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
            console.log('測試資料已初始化');
        }
    } catch (error) {
        console.error('加載資料檔案失敗:', error);
    }
}

// 儲存資料到檔案
function saveData() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(sharedData, null, 2));
        console.log('資料已儲存到檔案');
    } catch (error) {
        console.error('儲存資料失敗:', error);
    }
}

// 初始化載入資料
loadData();

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

// 1. 健康檢查
app.get('/health', (req, res) => {
    console.log('根路徑健康檢查被調用');
    res.status(200).send('OK');
});

// 2. API 健康檢查
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: '系統運作正常',
        timestamp: new Date().toISOString(),
        dataCounts: {
            tenants: sharedData.tenants.length,
            payments: sharedData.payments.length,
            images: sharedData.images.length,
            bankInfo: 1
        }
    });
});

// ========== 使用者認證 API ==========

// 3. 登入 API
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
                
                // 不返回密碼
                const { password: _, ...userWithoutPassword } = tenant;
                
                return res.json({
                    success: true,
                    token,
                    user: userWithoutPassword
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

// 4. 註冊 API
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
        
        // 檢查使用者名稱是否已存在
        if (sharedData.tenants.some(t => t.username === username)) {
            return res.status(400).json({
                success: false,
                message: '使用者名稱已存在'
            });
        }
        
        // 創建新使用者
        const newUser = {
            id: Date.now(),
            username,
            password,
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
                role: newUser.role,
                name: newUser.name
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

// 5. 取得銀行資訊（租客和管理員都能用）
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

// 6. 更新銀行資訊（僅管理員）
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

// 7. 取得繳費記錄
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
        
        // 按日期排序，最新的在前
        userPayments.sort((a, b) => new Date(b.payment_date || b.created_at) - new Date(a.payment_date || a.created_at));
        
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

// 8. 新增繳費記錄
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
        
        // 計算用電度數和電費
        const electricity_usage = current_meter - previous_meter;
        const electricity_fee = electricity_usage * electricity_rate;
        const calculated_total = parseFloat(rent_amount) + parseFloat(water_fee || 0) + electricity_fee;
        
        const newPayment = {
            id: sharedData.payments.length + 1,
            tenant_id: req.user.id,
            tenant_name: req.user.name || req.user.username,
            payment_date,
            rent_amount: parseFloat(rent_amount),
            water_fee: parseFloat(water_fee || 0),
            electricity_rate: parseFloat(electricity_rate),
            electricity_usage: electricity_usage,
            electricity_fee: electricity_fee,
            previous_meter: parseInt(previous_meter),
            current_meter: parseInt(current_meter),
            total_amount: parseFloat(total_amount || calculated_total),
            account_last_five,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
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

// 8.1 更新繳費記錄狀態（管理員確認）
app.put('/api/payments/:id', authenticateToken, checkAdmin, async (req, res) => {
    try {
        const paymentId = parseInt(req.params.id);
        const { status } = req.body;
        
        const paymentIndex = sharedData.payments.findIndex(p => p.id === paymentId);
        
        if (paymentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '繳費記錄不存在'
            });
        }
        
        // 更新狀態
        sharedData.payments[paymentIndex].status = status;
        sharedData.payments[paymentIndex].updated_at = new Date().toISOString();
        saveData();
        
        res.json({
            success: true,
            message: '繳費記錄狀態已更新',
            payment: sharedData.payments[paymentIndex]
        });
    } catch (error) {
        console.error('更新繳費記錄錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// ========== 圖片上傳 API ==========

// 9. 取得圖片列表
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
        
        // 按上傳時間排序，最新的在前
        userImages.sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at));
        
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

// 10. 本地圖片上傳（無需 Cloudflare R2）
app.post('/api/images/upload', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '請選擇要上傳的圖片'
            });
        }
        
        const file = req.file;
        const tenantId = req.user.id;
        const tenantName = req.user.name || req.user.username;
        
        // 建立租客專屬資料夾
        const tenantUploadDir = path.join(UPLOADS_DIR, String(tenantId));
        if (!fs.existsSync(tenantUploadDir)) {
            fs.mkdirSync(tenantUploadDir, { recursive: true });
        }
        
        // 產生唯一的檔案名稱
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 10);
        const fileExt = path.extname(file.originalname);
        const fileName = `${timestamp}-${randomStr}${fileExt}`;
        const filePath = path.join(tenantUploadDir, fileName);
        
        // 儲存檔案
        fs.writeFileSync(filePath, file.buffer);
        
        // 產生公開 URL
        const publicUrl = `/uploads/${tenantId}/${fileName}`;
        
        // 建立圖片資訊
        const imageInfo = {
            id: sharedData.images.length + 1,
            tenant_id: tenantId,
            tenant_name: tenantName,
            image_url: publicUrl,
            file_name: file.originalname,
            file_size: file.size,
            file_type: file.mimetype,
            uploaded_at: new Date().toISOString()
        };
        
        // 儲存到共享資料
        sharedData.images.push(imageInfo);
        saveData();
        
        // 建立公開訪問路徑
        app.use('/uploads', express.static(UPLOADS_DIR));
        
        res.json({
            success: true,
            message: '圖片上傳成功',
            image: imageInfo
        });
    } catch (error) {
        console.error('圖片上傳錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '圖片上傳失敗: ' + error.message 
        });
    }
});

// 10.1 多檔案上傳
app.post('/api/images/upload-multiple', authenticateToken, upload.array('images', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: '請選擇要上傳的圖片'
            });
        }
        
        const files = req.files;
        const tenantId = req.user.id;
        const tenantName = req.user.name || req.user.username;
        const uploadedImages = [];
        
        // 建立租客專屬資料夾
        const tenantUploadDir = path.join(UPLOADS_DIR, String(tenantId));
        if (!fs.existsSync(tenantUploadDir)) {
            fs.mkdirSync(tenantUploadDir, { recursive: true });
        }
        
        for (const file of files) {
            // 產生唯一的檔案名稱
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 10);
            const fileExt = path.extname(file.originalname);
            const fileName = `${timestamp}-${randomStr}${fileExt}`;
            const filePath = path.join(tenantUploadDir, fileName);
            
            // 儲存檔案
            fs.writeFileSync(filePath, file.buffer);
            
            // 產生公開 URL
            const publicUrl = `/uploads/${tenantId}/${fileName}`;
            
            // 建立圖片資訊
            const imageInfo = {
                id: sharedData.images.length + 1,
                tenant_id: tenantId,
                tenant_name: tenantName,
                image_url: publicUrl,
                file_name: file.originalname,
                file_size: file.size,
                file_type: file.mimetype,
                uploaded_at: new Date().toISOString()
            };
            
            // 儲存到共享資料
            sharedData.images.push(imageInfo);
            uploadedImages.push(imageInfo);
        }
        
        saveData();
        
        // 建立公開訪問路徑
        app.use('/uploads', express.static(UPLOADS_DIR));
        
        res.json({
            success: true,
            message: `成功上傳 ${uploadedImages.length} 張圖片`,
            images: uploadedImages
        });
    } catch (error) {
        console.error('多檔案上傳錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '圖片上傳失敗: ' + error.message 
        });
    }
});

// 11. 儲存圖片資訊（用於 Cloudflare R2 上傳後）
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

// 12. 刪除圖片
app.delete('/api/images/:id', authenticateToken, async (req, res) => {
    try {
        const imageId = parseInt(req.params.id);
        const imageIndex = sharedData.images.findIndex(img => img.id === imageId);
        
        if (imageIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '圖片不存在'
            });
        }
        
        const image = sharedData.images[imageIndex];
        
        // 檢查權限：管理員可以刪除任何圖片，租客只能刪除自己的圖片
        if (req.user.role !== 'admin' && image.tenant_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: '無權刪除此圖片'
            });
        }
        
        // 如果是本地儲存的圖片，刪除檔案
        if (image.image_url.startsWith('/uploads/')) {
            try {
                const filePath = path.join(projectRoot, image.image_url);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log('已刪除圖片檔案:', filePath);
                }
            } catch (fileError) {
                console.warn('刪除圖片檔案時出錯:', fileError);
            }
        }
        
        // 從陣列中移除
        sharedData.images.splice(imageIndex, 1);
        saveData();
        
        res.json({
            success: true,
            message: '圖片已刪除'
        });
    } catch (error) {
        console.error('刪除圖片錯誤:', error);
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

// 13.1 刪除租客
app.delete('/api/admin/tenants/:id', authenticateToken, checkAdmin, async (req, res) => {
    try {
        const tenantId = parseInt(req.params.id);
        
        // 尋找租客索引
        const tenantIndex = sharedData.tenants.findIndex(t => t.id === tenantId);
        
        if (tenantIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '租客不存在'
            });
        }
        
        const tenant = sharedData.tenants[tenantIndex];
        const tenantName = tenant.name || tenant.username;
        
        // 獲取租客的圖片
        const tenantImages = sharedData.images.filter(img => img.tenant_id === tenantId);
        
        // 獲取租客的繳費記錄
        const tenantPayments = sharedData.payments.filter(p => p.tenant_id === tenantId);
        
        // 刪除租客上傳的圖片檔案
        for (const image of tenantImages) {
            if (image.image_url.startsWith('/uploads/')) {
                try {
                    const filePath = path.join(projectRoot, image.image_url);
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log('已刪除租客圖片檔案:', filePath);
                    }
                } catch (fileError) {
                    console.warn('刪除租客圖片檔案時出錯:', fileError);
                }
            }
        }
        
        // 刪除租客的圖片記錄
        sharedData.images = sharedData.images.filter(img => img.tenant_id !== tenantId);
        
        // 刪除租客的繳費記錄
        sharedData.payments = sharedData.payments.filter(p => p.tenant_id !== tenantId);
        
        // 刪除租客資料
        sharedData.tenants.splice(tenantIndex, 1);
        
        // 儲存資料
        saveData();
        
        console.log(`已刪除租客 "${tenantName}"，ID: ${tenantId}`);
        console.log(`同時刪除了 ${tenantImages.length} 張圖片和 ${tenantPayments.length} 筆繳費記錄`);
        
        res.json({
            success: true,
            message: `已成功刪除租客 "${tenantName}"`,
            deleted: {
                tenant: tenantName,
                images: tenantImages.length,
                payments: tenantPayments.length
            }
        });
    } catch (error) {
        console.error('刪除租客錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// 14. 取得管理員儀表板資料
app.get('/api/admin/dashboard', authenticateToken, checkAdmin, async (req, res) => {
    try {
        const totalTenants = sharedData.tenants.length;
        const totalPayments = sharedData.payments.length;
        const pendingPayments = sharedData.payments.filter(p => p.status === 'pending').length;
        const totalImages = sharedData.images.length;
        
        // 最近10筆繳費記錄
        const recentPayments = [...sharedData.payments]
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 10);
        
        // 最近10張圖片
        const recentImages = [...sharedData.images]
            .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
            .slice(0, 10);
        
        res.json({
            success: true,
            dashboard: {
                totalTenants,
                totalPayments,
                pendingPayments,
                totalImages,
                recentPayments,
                recentImages
            }
        });
    } catch (error) {
        console.error('取得管理員儀表板錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// 15. 取得租客個人資料
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const tenant = sharedData.tenants.find(t => t.id === req.user.id);
        
        if (!tenant) {
            return res.status(404).json({
                success: false,
                message: '租客資料不存在'
            });
        }
        
        // 移除密碼字段
        const { password, ...tenantWithoutPassword } = tenant;
        
        res.json({
            success: true,
            user: tenantWithoutPassword
        });
    } catch (error) {
        console.error('取得個人資料錯誤:', error);
        res.status(500).json({ 
            success: false, 
            message: '伺服器錯誤' 
        });
    }
});

// ========== 分頁 API ==========

// 16. 分頁取得繳費記錄
app.get('/api/admin/payments/paginated', authenticateToken, checkAdmin, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status = 'all',
            tenant_id = 'all',
            search = '',
            sort_by = 'created_at',
            sort_order = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        
        // 複製原始數據進行操作
        let payments = [...sharedData.payments];
        
        // 應用篩選條件
        if (status !== 'all') {
            payments = payments.filter(p => p.status === status);
        }
        
        if (tenant_id !== 'all') {
            payments = payments.filter(p => p.tenant_id == tenant_id);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            payments = payments.filter(p => 
                (p.tenant_name && p.tenant_name.toLowerCase().includes(searchLower)) ||
                (p.account_last_five && p.account_last_five.includes(search))
            );
        }
        
        // 計算總數
        const total = payments.length;
        
        // 排序
        payments.sort((a, b) => {
            const aValue = a[sort_by] || a.created_at;
            const bValue = b[sort_by] || b.created_at;
            
            if (sort_order === 'DESC') {
                return new Date(bValue) - new Date(aValue);
            } else {
                return new Date(aValue) - new Date(bValue);
            }
        });
        
        // 分頁
        const paginatedPayments = payments.slice(offset, offset + parseInt(limit));
        
        // 統計資訊
        const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);
        const pendingPayments = payments.filter(p => p.status === 'pending').length;
        const confirmedPayments = payments.filter(p => p.status === 'confirmed').length;
        
        // 為每個繳費記錄添加租客的房間號碼（如果有租客資訊）
        const paymentsWithRoom = paginatedPayments.map(payment => {
            const tenant = sharedData.tenants.find(t => t.id === payment.tenant_id);
            return {
                ...payment,
                room_number: tenant ? tenant.room_number : '--'
            };
        });
        
        res.json({
            success: true,
            data: paymentsWithRoom,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_pages: Math.ceil(total / limit),
                total_records: total
            },
            statistics: {
                total_payments: total,
                pending_payments: pendingPayments,
                confirmed_payments: confirmedPayments,
                total_amount: totalAmount
            }
        });
    } catch (error) {
        console.error('分頁取得繳費記錄錯誤:', error);
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        });
    }
});

// 17. 分頁取得圖片
app.get('/api/admin/images/paginated', authenticateToken, checkAdmin, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 12,
            tenant_id = 'all',
            search = '',
            sort_by = 'uploaded_at',
            sort_order = 'DESC'
        } = req.query;

        const offset = (page - 1) * limit;
        
        // 複製原始數據進行操作
        let images = [...sharedData.images];
        
        // 應用篩選條件
        if (tenant_id !== 'all') {
            images = images.filter(i => i.tenant_id == tenant_id);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            images = images.filter(i => 
                (i.tenant_name && i.tenant_name.toLowerCase().includes(searchLower)) ||
                (i.file_name && i.file_name.toLowerCase().includes(searchLower))
            );
        }
        
        // 計算總數
        const total = images.length;
        
        // 排序
        images.sort((a, b) => {
            const aValue = a[sort_by] || a.uploaded_at;
            const bValue = b[sort_by] || b.uploaded_at;
            
            if (sort_order === 'DESC') {
                return new Date(bValue) - new Date(aValue);
            } else {
                return new Date(aValue) - new Date(bValue);
            }
        });
        
        // 分頁
        const paginatedImages = images.slice(offset, offset + parseInt(limit));
        
        // 為每個圖片添加租客的房間號碼（如果有租客資訊）
        const imagesWithRoom = paginatedImages.map(image => {
            const tenant = sharedData.tenants.find(t => t.id === image.tenant_id);
            return {
                ...image,
                room_number: tenant ? tenant.room_number : '--'
            };
        });
        
        res.json({
            success: true,
            data: imagesWithRoom,
            pagination: {
                current_page: parseInt(page),
                per_page: parseInt(limit),
                total_pages: Math.ceil(total / limit),
                total_records: total
            }
        });
    } catch (error) {
        console.error('分頁取得圖片錯誤:', error);
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        });
    }
});

// 18. 取得租客選項（用於篩選下拉選單）
app.get('/api/admin/tenant-options', authenticateToken, checkAdmin, async (req, res) => {
    try {
        const tenants = sharedData.tenants.map(tenant => {
            const { password, ...tenantWithoutPassword } = tenant;
            return tenantWithoutPassword;
        });
        
        res.json({
            success: true,
            data: tenants
        });
    } catch (error) {
        console.error('取得租客選項錯誤:', error);
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        });
    }
});

// 19. 更新繳費記錄狀態（分頁版本）
app.put('/api/admin/payments/:id/status', authenticateToken, checkAdmin, async (req, res) => {
    try {
        const paymentId = parseInt(req.params.id);
        const { status } = req.body;

        if (!['pending', 'confirmed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: '狀態值無效'
            });
        }

        const paymentIndex = sharedData.payments.findIndex(p => p.id === paymentId);
        
        if (paymentIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '繳費記錄不存在'
            });
        }
        
        // 更新狀態
        sharedData.payments[paymentIndex].status = status;
        sharedData.payments[paymentIndex].updated_at = new Date().toISOString();
        saveData();
        
        res.json({
            success: true,
            message: '繳費記錄狀態已更新'
        });
    } catch (error) {
        console.error('更新繳費記錄狀態錯誤:', error);
        res.status(500).json({
            success: false,
            message: '伺服器錯誤'
        });
    }
});

// 建立公開訪問路徑（確保每次啟動都設定）
app.use('/uploads', express.static(UPLOADS_DIR));

// 處理 404
app.use((req, res) => {
    // 如果是 API 請求，返回 JSON
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ 
            success: false, 
            message: 'API 端點不存在' 
        });
    }
    
    // 否則返回 404 頁面
    res.status(404).sendFile(path.join(projectRoot, 'frontend', '404.html'), (err) => {
        if (err) {
            res.status(404).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>404 - 頁面不存在</title>
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
                        h1 { color: #666; }
                        a { color: #3498db; text-decoration: none; }
                    </style>
                </head>
                <body>
                    <h1>404 - 頁面不存在</h1>
                    <p>抱歉，您要訪問的頁面不存在。</p>
                    <p><a href="/">返回首頁</a></p>
                </body>
                </html>
            `);
        }
    });
});

// 錯誤處理中介軟體
app.use((err, req, res, next) => {
    console.error('伺服器錯誤:', err);
    
    // 如果是檔案上傳錯誤
    if (err instanceof multer.MulterError) {
        return res.status(400).json({
            success: false,
            message: `檔案上傳錯誤: ${err.message}`
        });
    }
    
    // 其他錯誤
    res.status(500).json({
        success: false,
        message: '伺服器內部錯誤: ' + (err.message || '未知錯誤')
    });
});

// 啟動伺服器
app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(`廣大城租客管理系統`);
    console.log(`伺服器運行在端口: ${PORT}`);
    console.log(`綁定到: 0.0.0.0`);
    console.log(`上傳目錄: ${UPLOADS_DIR}`);
    console.log(`專案根目錄: ${projectRoot}`);
    console.log(`前端目錄: ${path.join(projectRoot, 'frontend')}`);
    console.log(`=========================================`);
});