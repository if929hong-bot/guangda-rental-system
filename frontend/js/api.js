// API 基礎設定
const api = {
    // API 基礎 URL
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
    
    // 繳費記錄 API
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
    
    // 管理員 API
    adminApi: {
        async getAllTenants() {
            return await api.request('/api/admin/tenants');
        },
        
        // 新增：刪除租客
        async deleteTenant(tenantId) {
            return await api.request(`/api/admin/tenants/${tenantId}`, {
                method: 'DELETE'
            });
        },
        
        // 新增：取得租客繳費記錄
        async getTenantPayments(tenantId) {
            return await api.request(`/api/admin/tenants/${tenantId}/payments`, {
                method: 'GET'
            });
        },
        
        async getAllPayments() {
            return await api.request('/api/payments'); // 管理員會收到所有繳費記錄
        },
        
        async getAllImages() {
            return await api.request('/api/images'); // 管理員會收到所有圖片
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
        // 分頁取得繳費記錄
        async getPayments(params = {}) {
            try {
                const token = this.getToken();
                if (!token) throw new Error('請先登入');
                
                const queryParams = new URLSearchParams({
                    page: params.page || 1,
                    limit: params.limit || 10,
                    ...params
                });
                
                const response = await fetch(`/api/admin/payments/paginated?${queryParams}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                return await response.json();
            } catch (error) {
                console.error('取得繳費記錄錯誤:', error);
                throw error;
            }
        },
        
        // 分頁取得圖片
        async getImages(params = {}) {
            try {
                const token = this.getToken();
                if (!token) throw new Error('請先登入');
                
                const queryParams = new URLSearchParams({
                    page: params.page || 1,
                    limit: params.limit || 12,
                    ...params
                });
                
                const response = await fetch(`/api/admin/images/paginated?${queryParams}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                return await response.json();
            } catch (error) {
                console.error('取得圖片列表錯誤:', error);
                throw error;
            }
        },
        
        // 獲取租客選項（用於篩選）
        async getTenantOptions() {
            try {
                const token = this.getToken();
                if (!token) throw new Error('請先登入');
                
                const response = await fetch('/api/admin/tenant-options', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                return await response.json();
            } catch (error) {
                console.error('獲取租客選項錯誤:', error);
                throw error;
            }
        },
        
        // 更新繳費記錄狀態
        async updatePaymentStatus(paymentId, status) {
            try {
                const token = this.getToken();
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
                
                return await response.json();
            } catch (error) {
                console.error('更新繳費記錄狀態錯誤:', error);
                throw error;
            }
        }
    }
};

// 使 api 物件在全局可用
window.api = api;