// frontend/js/admin.js - 修复版
// 管理員頁面 JavaScript
let currentUser = null;
let allTenants = [];
let allImages = [];

// 頁面載入時初始化
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadAdminInfo();
    loadBankInfo();
    loadTenants();
    loadAllImages();
});

// 檢查登入狀態
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token || user.role !== 'admin') {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = user;
}

// 載入管理員資訊
function loadAdminInfo() {
    if (currentUser) {
        const adminName = document.getElementById('adminName');
        const adminPhone = document.getElementById('adminPhone');
        
        if (adminName) {
            adminName.textContent = currentUser.name || currentUser.username;
        }
        if (adminPhone) {
            adminPhone.textContent = `電話：${currentUser.phone}`;
        }
    }
}

// 切換標籤頁
function switchTab(tabName) {
    // 移除所有標籤按鈕的 active 類
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 隱藏所有標籤內容
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 啟用當前標籤
    const activeBtn = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    const activeTab = document.getElementById(`${tabName}Tab`);
    if (activeTab) {
        activeTab.classList.add('active');
    }
}

// 顯示提示訊息
function showAlert(message, type = 'success') {
    const alertDiv = document.getElementById('alertMessage');
    if (alertDiv) {
        alertDiv.textContent = message;
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.display = 'block';
        
        setTimeout(() => {
            alertDiv.style.display = 'none';
        }, 5000);
    }
}

// 載入銀行資訊
function loadBankInfo() {
    fetch('/api/bank-info', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const bankInfo = data.bankInfo;
            
            // 填入表單
            const bankNameInput = document.getElementById('bankName');
            const branchNameInput = document.getElementById('branchName');
            const accountNameInput = document.getElementById('accountName');
            const accountNumberInput = document.getElementById('accountNumber');
            
            if (bankNameInput) bankNameInput.value = bankInfo.bank_name || '';
            if (branchNameInput) branchNameInput.value = bankInfo.branch_name || '';
            if (accountNameInput) accountNameInput.value = bankInfo.account_name || '';
            if (accountNumberInput) accountNumberInput.value = bankInfo.account_number || '';
            
            // 顯示當前資訊
            const currentBankName = document.getElementById('currentBankName');
            const currentBranchName = document.getElementById('currentBranchName');
            const currentAccountName = document.getElementById('currentAccountName');
            const currentAccountNumber = document.getElementById('currentAccountNumber');
            const lastUpdated = document.getElementById('lastUpdated');
            const bankInfoDisplay = document.getElementById('bankInfoDisplay');
            
            if (currentBankName) currentBankName.textContent = bankInfo.bank_name || '未設定';
            if (currentBranchName) currentBranchName.textContent = bankInfo.branch_name || '未設定';
            if (currentAccountName) currentAccountName.textContent = bankInfo.account_name || '未設定';
            if (currentAccountNumber) currentAccountNumber.textContent = bankInfo.account_number || '未設定';
            if (lastUpdated) lastUpdated.textContent = new Date(bankInfo.updated_at).toLocaleString('zh-TW');
            if (bankInfoDisplay) bankInfoDisplay.style.display = 'block';
        } else {
            showAlert('載入銀行資訊失敗', 'error');
        }
    })
    .catch(error => {
        console.error('載入銀行資訊錯誤:', error);
        showAlert('載入銀行資訊時發生錯誤', 'error');
    });
}

// 儲存銀行資訊
function saveBankInfo() {
    const bankNameInput = document.getElementById('bankName');
    const branchNameInput = document.getElementById('branchName');
    const accountNameInput = document.getElementById('accountName');
    const accountNumberInput = document.getElementById('accountNumber');
    
    if (!bankNameInput || !branchNameInput || !accountNameInput || !accountNumberInput) {
        showAlert('表單元素未找到', 'error');
        return;
    }
    
    const bankInfo = {
        bank_name: bankNameInput.value,
        branch_name: branchNameInput.value,
        account_name: accountNameInput.value,
        account_number: accountNumberInput.value
    };
    
    // 簡單驗證
    if (!bankInfo.bank_name || !bankInfo.branch_name || !bankInfo.account_name || !bankInfo.account_number) {
        showAlert('請填寫所有銀行資訊欄位', 'error');
        return;
    }
    
    fetch('/api/bank-info', {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(bankInfo)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showAlert('銀行資訊已成功更新');
            loadBankInfo(); // 重新載入顯示最新的資訊
        } else {
            showAlert(data.message || '更新銀行資訊失敗', 'error');
        }
    })
    .catch(error => {
        console.error('儲存銀行資訊錯誤:', error);
        showAlert('儲存銀行資訊時發生錯誤', 'error');
    });
}

// 載入所有租客
function loadTenants() {
    const loading = document.getElementById('tenantsLoading');
    const empty = document.getElementById('tenantsEmpty');
    const tableBody = document.querySelector('#tenantsTable tbody');
    
    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
    if (tableBody) tableBody.innerHTML = '';
    
    fetch('/api/admin/tenants', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (loading) loading.style.display = 'none';
        
        if (data.success && data.tenants && data.tenants.length > 0) {
            allTenants = data.tenants;
            
            // 動態生成表格行
            data.tenants.forEach(tenant => {
                const row = document.createElement('tr');
                
                row.innerHTML = `
                    <td>${tenant.name || '未提供'}</td>
                    <td>${tenant.room_number || '未分配'}</td>
                    <td>${tenant.phone || '未提供'}</td>
                    <td>${tenant.email || '未提供'}</td>
                    <td>${tenant.lease_start || '未設定'} ~ ${tenant.lease_end || '未設定'}</td>
                    <td>NT$ ${parseInt(tenant.rent_amount || 0).toLocaleString('zh-TW')}</td>
                    <td>${new Date(tenant.created_at).toLocaleDateString('zh-TW')}</td>
                    <td>
                        <button class="action-btn action-btn-view" onclick="viewTenantDetails('${tenant.id}')">
                            <i class="fas fa-eye"></i> 查看詳情
                        </button>
                    </td>
                `;
                
                if (tableBody) {
                    tableBody.appendChild(row);
                }
            });
        } else {
            if (empty) empty.style.display = 'block';
        }
    })
    .catch(error => {
        console.error('載入租客資料錯誤:', error);
        if (loading) loading.style.display = 'none';
        showAlert('載入租客資料時發生錯誤', 'error');
    });
}

// 查看租客詳情
function viewTenantDetails(tenantId) {
    const tenant = allTenants.find(t => t.id == tenantId);
    
    if (!tenant) {
        showAlert('找不到租客資料', 'error');
        return;
    }
    
    const modal = document.getElementById('tenantModal');
    const detailsDiv = document.getElementById('tenantDetails');
    
    if (!modal || !detailsDiv) {
        showAlert('無法打開租客詳情', 'error');
        return;
    }
    
    // 構建詳情HTML
    detailsDiv.innerHTML = `
        <div class="detail-item">
            <div class="detail-label">基本資訊</div>
            <div class="detail-value">
                <p><strong>姓名：</strong> ${tenant.name || '未提供'}</p>
                <p><strong>帳號：</strong> ${tenant.username || '未提供'}</p>
                <p><strong>電話：</strong> ${tenant.phone || '未提供'}</p>
                <p><strong>Email：</strong> ${tenant.email || '未提供'}</p>
            </div>
        </div>
        
        <div class="detail-item">
            <div class="detail-label">租賃資訊</div>
            <div class="detail-value">
                <p><strong>房號：</strong> ${tenant.room_number || '未分配'}</p>
                <p><strong>月租金：</strong> NT$ ${parseInt(tenant.rent_amount || 0).toLocaleString('zh-TW')}</p>
                <p><strong>租約期間：</strong> ${tenant.lease_start || '未設定'} 至 ${tenant.lease_end || '未設定'}</p>
                <p><strong>租約天數：</strong> ${calculateLeaseDays(tenant.lease_start, tenant.lease_end)} 天</p>
            </div>
        </div>
        
        <div class="detail-item">
            <div class="detail-label">系統資訊</div>
            <div class="detail-value">
                <p><strong>註冊時間：</strong> ${new Date(tenant.created_at).toLocaleString('zh-TW')}</p>
                <p><strong>最後登入：</strong> ${new Date().toLocaleDateString('zh-TW')}</p>
                <p><strong>帳號狀態：</strong> <span class="status-badge status-active">正常</span></p>
            </div>
        </div>
        
        <div class="detail-item">
            <div class="detail-label">聯絡備註</div>
            <div class="detail-value">
                <textarea class="form-control" rows="3" placeholder="可在此記錄與租客的聯絡備註..."></textarea>
                <button class="btn btn-secondary" style="margin-top: 10px;">儲存備註</button>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
}

// 計算租約天數
function calculateLeaseDays(startDate, endDate) {
    if (!startDate || !endDate) return '未設定';
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

// 載入所有圖片
function loadAllImages() {
    const loading = document.getElementById('imagesLoading');
    const empty = document.getElementById('imagesEmpty');
    const grid = document.getElementById('imagesGrid');
    
    if (loading) loading.style.display = 'block';
    if (empty) empty.style.display = 'none';
    if (grid) grid.innerHTML = '';
    
    fetch('/api/images', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (loading) loading.style.display = 'none';
        
        if (data.success && data.images && data.images.length > 0) {
            allImages = data.images;
            
            // 動態生成圖片卡片
            data.images.forEach(image => {
                const tenant = allTenants.find(t => t.id == image.tenant_id);
                const tenantName = tenant ? tenant.name : '未知租客';
                
                const card = document.createElement('div');
                card.className = 'image-card';
                
                card.innerHTML = `
                    <img src="${image.image_url}" alt="${image.file_name}" class="image-preview" 
                         onerror="this.src='https://via.placeholder.com/200x150?text=圖片載入失敗'">
                    <div class="image-info">
                        <h4>${image.file_name}</h4>
                        <p><strong>上傳者：</strong> ${tenantName}</p>
                        <p><strong>檔案大小：</strong> ${formatFileSize(image.file_size)}</p>
                        <p><strong>上傳時間：</strong> ${new Date(image.uploaded_at).toLocaleString('zh-TW')}</p>
                        <div class="action-btns" style="margin-top: 10px;">
                            <button class="action-btn action-btn-view" onclick="previewImage('${image.image_url}')">
                                <i class="fas fa-search"></i> 預覽
                            </button>
                            <button class="action-btn action-btn-download" onclick="downloadImage('${image.image_url}', '${image.file_name}')">
                                <i class="fas fa-download"></i> 下載
                            </button>
                        </div>
                    </div>
                `;
                
                if (grid) {
                    grid.appendChild(card);
                }
            });
        } else {
            if (empty) empty.style.display = 'block';
        }
    })
    .catch(error => {
        console.error('載入圖片錯誤:', error);
        if (loading) loading.style.display = 'none';
        showAlert('載入圖片時發生錯誤', 'error');
    });
}

// 格式化檔案大小
function formatFileSize(bytes) {
    if (!bytes) return '未知大小';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Byte';
    
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
}

// 預覽圖片
function previewImage(imageUrl) {
    window.open(imageUrl, '_blank');
}

// 下載圖片
function downloadImage(imageUrl, fileName) {
    fetch(imageUrl)
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || 'image.jpg';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showAlert('圖片下載開始');
        })
        .catch(error => {
            console.error('下載圖片錯誤:', error);
            showAlert('下載圖片時發生錯誤', 'error');
        });
}

// 關閉模態框
function closeModal() {
    const modal = document.getElementById('tenantModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// 登出
function logout() {
    if (confirm('確定要登出嗎？')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }
}