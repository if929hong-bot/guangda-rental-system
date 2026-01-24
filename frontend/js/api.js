// API 基礎設定
const api = {
    // API 基礎 URL - 使用當前網址，兼容 Railway 部署
    baseUrl: window.location.origin,
    
    // 取得 token
    getToken() {
        return localStorage.getItem('token');
    },
    
    // 儲存 token
    setToken(token) {
        localStorage.setItem('token', token);
    },
    
    // 移除 token
    removeToken() {
        localStorage.removeItem('token');
    },
    
    // 取得使用者資訊
    getUserInfo() {
        const userJson = localStorage.getItem('user');
        return userJson ? JSON.parse(userJson) : null;
    },
    
    // 儲存使用者資訊
    setUserInfo(user) {
        localStorage.setItem('user', JSON.stringify(user));
    },
    
    // 移除使用者資訊
    removeUserInfo() {
        localStorage.removeItem('user');
    },
    
    // 檢查是否已登入
    checkAuth() {
        return !!this.getToken();
    },
    
    // 通用請求函數
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const token = this.getToken();
        
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            console.log(`API Request: ${url}`, options);
            const response = await fetch(url, {
                ...options,
                headers
            });
            
            // 處理非 JSON 響應
            const contentType = response.headers.get('content-type');
            let data;
            
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                throw new Error(`非JSON響應: ${text.substring(0, 100)}`);
            }
            
            console.log(`API Response (${response.status}):`, data);
            
            if (!response.ok) {
                // 如果 token 過期或無效，導向登入頁面
                if (response.status === 401 || response.status === 403) {
                    this.removeToken();
                    this.removeUserInfo();
                    window.location.href = 'login.html';
                }
                
                throw new Error(data.message || `HTTP ${response.status}`);
            }
            
            return data;
        } catch (error) {
            console.error('API 請求失敗:', error);
            throw error;
        }
    },
    
    // 使用者 API
    userApi: {
        async login(username, password, role) {
            const response = await api.request('/api/login', {
                method: 'POST',
                body: JSON.stringify({ username, password, role })
            });
            
            if (response.success && response.token) {
                api.setToken(response.token);
                api.setUserInfo(response.user);
            }
            
            return response;
        },
        
        async register(userData) {
            return await api.request('/api/register', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
        },
        
        logout() {
            api.removeToken();
            api.removeUserInfo();
        }
    },
    
    // 銀行資訊 API
    bankApi: {
        async getBankInfo() {
            return await api.request('/api/bank-info');
        },
        
        async updateBankInfo(bankData) {
            return await api.request('/api/bank-info', {
                method: 'PUT',
                body: JSON.stringify(bankData)
            });
        }
    },
    
    // 繳費記錄 API（租客使用）
    paymentApi: {
        async getPayments() {
            return await api.request('/api/payments');
        },
        
        async createPayment(paymentData) {
            return await api.request('/api/payments', {
                method: 'POST',
                body: JSON.stringify(paymentData)
            });
        },
        
        async updatePaymentStatus(paymentId, status) {
            return await api.request(`/api/payments/${paymentId}`, {
                method: 'PUT',
                body: JSON.stringify({ status })
            });
        }
    },
    
    // 圖片 API
    imageApi: {
        async getImages() {
            return await api.request('/api/images');
        },
        
        async uploadImage(formData) {
            const token = api.getToken();
            const response = await fetch(`${api.baseUrl}/api/images/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            return await response.json();
        },
        
        async deleteImage(imageId) {
            return await api.request(`/api/images/${imageId}`, {
                method: 'DELETE'
            });
        }
    },
    
    // 管理員 API（舊版）
    adminApi: {
        async getAllTenants() {
            return await api.request('/api/admin/tenants');
        },
        
        async deleteTenant(tenantId) {
            return await api.request(`/api/admin/tenants/${tenantId}`, {
                method: 'DELETE'
            });
        },
        
        async getTenantPayments(tenantId) {
            return await api.request(`/api/admin/tenants/${tenantId}/payments`, {
                method: 'GET'
            });
        },
        
        async getAllPayments() {
            return await api.request('/api/payments');
        },
        
        async getAllImages() {
            return await api.request('/api/images');
        },
        
        async getDashboard() {
            return await api.request('/api/admin/dashboard');
        }
    },
    
    // 個人資料 API
    profileApi: {
        async getProfile() {
            return await api.request('/api/profile');
        }
    },
    
    // ========== 管理員分頁 API ==========
    adminPaginatedApi: {
        // 分頁取得繳費記錄（支援篩選）
        async getPayments(params = {}) {
            try {
                console.log('API: 取得分頁繳費記錄，參數:', params);
                
                const token = api.getToken();
                if (!token) {
                    console.error('API: 無有效的 token');
                    throw new Error('請先登入');
                }
                
                // 構建查詢參數
                const queryParams = new URLSearchParams();
                
                // 必要參數
                queryParams.append('page', params.page || 1);
                queryParams.append('limit', params.limit || 10);
                
                // 可選篩選參數
                if (params.status && params.status !== 'all') {
                    queryParams.append('status', params.status);
                }
                
                if (params.tenant_id && params.tenant_id !== 'all') {
                    queryParams.append('tenant_id', params.tenant_id);
                }
                
                if (params.search && params.search.trim()) {
                    queryParams.append('search', params.search.trim());
                }
                
                const url = `/api/admin/payments/paginated?${queryParams}`;
                console.log('API: 請求 URL:', url);
                
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    credentials: 'include'
                });
                
                console.log('API: 響應狀態:', response.status, response.statusText);
                
                if (!response.ok) {
                    let errorMessage = `HTTP 錯誤! 狀態: ${response.status}`;
                    
                    if (response.status === 401 || response.status === 403) {
                        errorMessage = '登入已過期，請重新登入';
                        api.removeToken();
                        api.removeUserInfo();
                        window.location.href = 'login.html';
                    }
                    
                    throw new Error(errorMessage);
                }
                
                const data = await response.json();
                console.log('API: 繳費記錄數據:', data);
                
                // 確保響應格式正確
                if (!data) {
                    throw new Error('伺服器返回空數據');
                }
                
                return data;
            } catch (error) {
                console.error('API: 取得繳費記錄錯誤:', error);
                
                // 返回一個結構化的錯誤響應
                return {
                    success: false,
                    message: error.message || '無法取得繳費記錄',
                    data: [],
                    pagination: {
                        current_page: 1,
                        total_pages: 1,
                        total_items: 0
                    },
                    statistics: {
                        total_payments: 0,
                        pending_payments: 0,
                        confirmed_payments: 0,
                        total_amount: 0
                    }
                };
            }
        },
        
        // 分頁取得圖片
        async getImages(params = {}) {
            try {
                console.log('API: 取得分頁圖片，參數:', params);
                
                const token = api.getToken();
                if (!token) throw new Error('請先登入');
                
                const queryParams = new URLSearchParams();
                queryParams.append('page', params.page || 1);
                queryParams.append('limit', params.limit || 12);
                
                if (params.tenant_id && params.tenant_id !== 'all') {
                    queryParams.append('tenant_id', params.tenant_id);
                }
                
                if (params.search && params.search.trim()) {
                    queryParams.append('search', params.search.trim());
                }
                
                const url = `/api/admin/images/paginated?${queryParams}`;
                
                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('API: 圖片數據:', data);
                
                return data;
            } catch (error) {
                console.error('API: 取得圖片列表錯誤:', error);
                
                return {
                    success: false,
                    message: error.message || '無法取得圖片列表',
                    data: [],
                    pagination: {
                        current_page: 1,
                        total_pages: 1,
                        total_items: 0
                    }
                };
            }
        },
        
        // 獲取租客選項（用於篩選）
        async getTenantOptions() {
            try {
                console.log('API: 獲取租客選項');
                
                const token = api.getToken();
                if (!token) throw new Error('請先登入');
                
                const response = await fetch('/api/admin/tenant-options', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('API: 租客選項數據:', data);
                
                return data;
            } catch (error) {
                console.error('API: 獲取租客選項錯誤:', error);
                
                return {
                    success: false,
                    message: error.message || '無法取得租客選項',
                    data: []
                };
            }
        },
        
        // 更新繳費記錄狀態
        async updatePaymentStatus(paymentId, status) {
            try {
                console.log(`API: 更新繳費記錄狀態，ID: ${paymentId}, 狀態: ${status}`);
                
                const token = api.getToken();
                if (!token) throw new Error('請先登入');
                
                const response = await fetch(`/api/admin/payments/${paymentId}/status`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('API: 更新狀態響應:', data);
                
                return data;
            } catch (error) {
                console.error('API: 更新繳費記錄狀態錯誤:', error);
                
                return {
                    success: false,
                    message: error.message || '無法更新繳費記錄狀態'
                };
            }
        }
    }
};

// 使 api 物件在全局可用
window.api = api;

// 測試 API 連接
console.log('API 模組已載入');
console.log('Base URL:', api.baseUrl);
console.log('當前路徑:', window.location.pathname);
console.log('Token 是否存在:', !!api.getToken());