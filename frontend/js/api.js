// API 基礎設定 - 如果是開發環境使用本地，上線使用 Railway 網址
const API_BASE_URL = window.location.origin; // 自動偵測當前網域

// 從 localStorage 取得 token
function getToken() {
    return localStorage.getItem('token');
}

// 檢查是否登入
function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// 取得使用者資訊
function getUserInfo() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

// 通用 API 請求函數
async function apiRequest(endpoint, method = 'GET', data = null) {
    const url = `${API_BASE_URL}/api${endpoint}`;
    const token = getToken();
    
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const options = {
        method,
        headers,
    };
    
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        options.body = JSON.stringify(data);
    }
    
    try {
        const response = await fetch(url, options);
        
        if (response.status === 401) {
            // Token 失效，跳轉到登入頁面
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'index.html';
            throw new Error('請重新登入');
        }
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.message || '請求失敗');
        }
        
        return result;
    } catch (error) {
        console.error('API 請求錯誤:', error);
        throw error;
    }
}

// 使用者相關 API
export const userApi = {
    // 登入
    login: (username, password, role) => 
        apiRequest('/login', 'POST', { username, password, role }),
    
    // 註冊
    register: (userData) => 
        apiRequest('/register', 'POST', userData),
    
    // 取得使用者資料
    getProfile: () => 
        apiRequest('/profile'),
    
    // 登出
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
};

// 銀行資訊相關 API
export const bankApi = {
    // 取得銀行資訊 (租客用)
    getBankInfo: () => 
        apiRequest('/bank-info'),
    
    // 更新銀行資訊 (管理員用)
    updateBankInfo: (bankData) => 
        apiRequest('/bank-info', 'PUT', bankData)
};

// 繳費記錄相關 API
export const paymentApi = {
    // 取得租客的繳費記錄
    getPayments: () => 
        apiRequest('/payments'),
    
    // 新增繳費記錄
    createPayment: (paymentData) => 
        apiRequest('/payments', 'POST', paymentData)
};

// 圖片相關 API
export const imageApi = {
    // 取得圖片列表
    getImages: () => 
        apiRequest('/images'),
    
    // 取得 Cloudflare R2 上傳 URL
    getUploadUrl: () => 
        apiRequest('/images/upload-url', 'POST'),
    
    // 儲存圖片資訊
    saveImageInfo: (imageData) => 
        apiRequest('/images/save', 'POST', imageData)
};

// 管理員相關 API
export const adminApi = {
    // 取得所有租客資料
    getAllTenants: () => 
        apiRequest('/admin/tenants')
};

// 匯出所有 API
export default {
    userApi,
    bankApi,
    paymentApi,
    imageApi,
    adminApi,
    checkAuth,
    getUserInfo,
    getToken
};