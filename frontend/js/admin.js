// frontend/js/admin.js - 管理員後台
document.addEventListener('DOMContentLoaded', async function() {
    // 檢查是否登入
    if (!api.checkAuth()) {
        window.location.href = 'login.html';
        return;
    }

    // 取得使用者資訊
    const user = api.getUserInfo();
    if (!user || user.role !== 'admin') {
        window.location.href = 'login.html';
        return;
    }

    // 顯示管理員資訊
    document.getElementById('adminName').textContent = user.name || user.username;
    if (user.phone) {
        document.getElementById('adminPhone').textContent = `電話: ${user.phone}`;
    }

    // 初始化頁面
    initAdminPage();
    loadBankInfo();
    loadAllTenants();
    loadAllPayments();
    loadAllImages();
});

// 初始化管理員頁面
function initAdminPage() {
    // 確保標籤頁正確初始化
    const activeTabBtn = document.querySelector('.tab-btn.active');
    const activeTabContent = document.querySelector('.tab-content.active');
    
    if (!activeTabBtn || !activeTabContent) {
        // 如果沒有活動標籤，設定第一個為活動狀態
        const firstTabBtn = document.querySelector('.tab-btn');
        const firstTabContent = document.querySelector('.tab-content');
        
        if (firstTabBtn && firstTabContent) {
            firstTabBtn.classList.add('active');
            firstTabContent.classList.add('active');
        }
    }
}

// 切換標籤頁
function switchTab(tabName) {
    // 移除所有標籤頁的 active 類別
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 添加 active 類別到目標標籤頁
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabName)) {
            btn.classList.add('active');
        }
    });
    
    const tabContent = document.getElementById(tabName + 'Tab');
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    // 根據標籤頁載入資料
    switch(tabName) {
        case 'tenants':
            loadAllTenants();
            break;
        case 'payments':
            loadAllPayments();
            break;
        case 'images':
            loadAllImages();
            break;
        case 'bank':
            loadBankInfo();
            break;
    }
}

// 載入銀行資訊
async function loadBankInfo() {
    try {
        const response = await api.bankApi.getBankInfo();
        const bankInfo = response.bankInfo;
        
        if (!bankInfo) {
            showAlert('未找到銀行資訊', 'error');
            return;
        }
        
        // 填入表單
        document.getElementById('bankName').value = bankInfo.bank_name || '';
        document.getElementById('branchName').value = bankInfo.branch_name || '';
        document.getElementById('accountName').value = bankInfo.account_name || '';
        document.getElementById('accountNumber').value = bankInfo.account_number || '';
        
        // 顯示目前設定的資訊
        document.getElementById('currentBankName').textContent = bankInfo.bank_name || '未設定';
        document.getElementById('currentBranchName').textContent = bankInfo.branch_name || '未設定';
        document.getElementById('currentAccountName').textContent = bankInfo.account_name || '未設定';
        document.getElementById('currentAccountNumber').textContent = bankInfo.account_number || '未設定';
        document.getElementById('lastUpdated').textContent = bankInfo.updated_at ? 
            new Date(bankInfo.updated_at).toLocaleString('zh-TW') : '未更新';
        
        // 顯示資訊區塊
        document.getElementById('bankInfoDisplay').style.display = 'block';
        
        showAlert('銀行資訊載入成功', 'success');
    } catch (error) {
        console.error('載入銀行資訊失敗:', error);
        showAlert('無法載入銀行資訊: ' + (error.message || '請檢查網路連接'), 'error');
    }
}

// 儲存銀行資訊
async function saveBankInfo() {
    const bankData = {
        bank_name: document.getElementById('bankName').value.trim(),
        branch_name: document.getElementById('branchName').value.trim(),
        account_name: document.getElementById('accountName').value.trim(),
        account_number: document.getElementById('accountNumber').value.trim()
    };
    
    // 驗證輸入
    if (!bankData.bank_name) {
        showAlert('請輸入銀行名稱', 'error');
        return;
    }
    
    if (!bankData.account_name) {
        showAlert('請輸入戶名', 'error');
        return;
    }
    
    if (!bankData.account_number) {
        showAlert('請輸入銀行帳號', 'error');
        return;
    }
    
    try {
        showAlert('儲存中...', 'info');
        
        const response = await api.bankApi.updateBankInfo(bankData);
        
        if (response.success) {
            showAlert('銀行資訊已成功更新', 'success');
            
            // 重新載入銀行資訊以更新顯示
            setTimeout(() => {
                loadBankInfo();
            }, 1500);
        } else {
            showAlert(response.message || '更新失敗', 'error');
        }
    } catch (error) {
        console.error('儲存銀行資訊失敗:', error);
        showAlert('儲存失敗: ' + (error.message || '請稍後再試'), 'error');
    }
}

// 載入所有租客
async function loadAllTenants() {
    const loadingEl = document.getElementById('tenantsLoading');
    const emptyEl = document.getElementById('tenantsEmpty');
    const tableBody = document.querySelector('#tenantsTable tbody');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="9" class="loading">載入中...</td></tr>';
    
    try {
        const response = await api.adminApi.getAllTenants();
        const tenants = response.tenants || [];
        
        if (loadingEl) loadingEl.style.display = 'none';
        
        if (tenants.length === 0) {
            if (tableBody) tableBody.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }
        
        // 更新表格
        updateTenantsTable(tenants);
        
        // 更新繳費記錄頁面的租客篩選器
        updateTenantFilter(tenants);
    } catch (error) {
        console.error('載入租客列表失敗:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="9" class="error">載入失敗，請刷新頁面</td></tr>';
        showAlert('無法載入租客列表', 'error');
    }
}

// 更新租客表格
function updateTenantsTable(tenants) {
    const tableBody = document.querySelector('#tenantsTable tbody');
    
    if (!tableBody) return;
    
    let html = '';
    
    tenants.forEach(tenant => {
        html += `
            <tr>
                <td>${escapeHtml(tenant.name || tenant.username)}</td>
                <td>${escapeHtml(tenant.room_number || '--')}</td>
                <td>${escapeHtml(tenant.phone || '--')}</td>
                <td>${escapeHtml(tenant.email || '--')}</td>
                <td>${formatDate(tenant.lease_start)} - ${formatDate(tenant.lease_end)}</td>
                <td>NT$ ${tenant.rent_amount ? parseFloat(tenant.rent_amount).toLocaleString() : '0'}</td>
                <td>${formatDate(tenant.created_at, true)}</td>
                <td>
                    <div class="action-btns">
                        <button class="action-btn action-btn-delete" onclick="deleteTenant(${tenant.id}, '${escapeHtml(tenant.name || tenant.username)}')">
                            <i class="fas fa-trash"></i> 刪除
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// 更新租客篩選器
function updateTenantFilter(tenants) {
    const tenantFilter = document.getElementById('tenantFilter');
    if (!tenantFilter) return;
    
    // 保存當前選擇的值
    const currentValue = tenantFilter.value;
    
    // 清空選項（保留「全部租客」選項）
    while (tenantFilter.options.length > 1) {
        tenantFilter.remove(1);
    }
    
    // 添加租客選項
    tenants.forEach(tenant => {
        const option = document.createElement('option');
        option.value = tenant.id;
        option.textContent = `${tenant.name || tenant.username} (${tenant.room_number || '--'})`;
        tenantFilter.appendChild(option);
    });
    
    // 恢復之前選擇的值
    if (currentValue && currentValue !== 'all') {
        tenantFilter.value = currentValue;
    }
}

// 載入所有繳費記錄
async function loadAllPayments() {
    const loadingEl = document.getElementById('paymentsLoading');
    const emptyEl = document.getElementById('paymentsEmpty');
    const tableBody = document.querySelector('#paymentsTable tbody');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="13" class="loading">載入中...</td></tr>';
    
    try {
        // 使用 adminApi.getAllPayments() 來取得所有繳費記錄
        const response = await api.adminApi.getAllPayments();
        const payments = response.payments || [];
        
        if (loadingEl) loadingEl.style.display = 'none';
        
        if (payments.length === 0) {
            if (tableBody) tableBody.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            updatePaymentStats(payments);
            return;
        }
        
        // 取得篩選條件
        const statusFilter = document.getElementById('statusFilter').value;
        const tenantFilter = document.getElementById('tenantFilter').value;
        
        // 篩選繳費記錄
        let filteredPayments = payments;
        
        if (statusFilter !== 'all') {
            filteredPayments = filteredPayments.filter(payment => payment.status === statusFilter);
        }
        
        if (tenantFilter !== 'all') {
            filteredPayments = filteredPayments.filter(payment => payment.user_id == tenantFilter);
        }
        
        // 更新表格
        updatePaymentsTable(filteredPayments);
        
        // 更新統計資訊
        updatePaymentStats(payments);
        
    } catch (error) {
        console.error('載入繳費記錄失敗:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="13" class="error">載入失敗，請刷新頁面</td></tr>';
        showAlert('無法載入繳費記錄: ' + (error.message || '請檢查網路連接'), 'error');
    }
}

// 更新繳費記錄表格
function updatePaymentsTable(payments) {
    const tableBody = document.querySelector('#paymentsTable tbody');
    
    if (!tableBody) return;
    
    if (payments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="13" class="empty-state">暫無繳費記錄</td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    // 取得租客資訊（為了顯示租客名稱）
    const tenants = [];
    try {
        // 嘗試從本地儲存或先前載入的資料取得租客資訊
        const tenantsResponse = localStorage.getItem('adminTenants');
        if (tenantsResponse) {
            const parsed = JSON.parse(tenantsResponse);
            tenants.push(...(parsed.tenants || []));
        }
    } catch (e) {
        console.error('取得租客資訊失敗:', e);
    }
    
    payments.forEach(payment => {
        const electricityUsage = payment.current_meter - payment.previous_meter;
        const electricityFee = electricityUsage * payment.electricity_rate;
        
        // 尋找對應的租客資訊
        const tenant = tenants.find(t => t.id == payment.user_id) || {};
        
        html += `
            <tr>
                <td>${escapeHtml(tenant.name || tenant.username || payment.username || '租客')}</td>
                <td>${escapeHtml(tenant.room_number || '--')}</td>
                <td>${formatDate(payment.payment_date || payment.created_at)}</td>
                <td>NT$ ${parseFloat(payment.rent_amount).toLocaleString()}</td>
                <td>${payment.water_fee ? `NT$ ${parseFloat(payment.water_fee).toLocaleString()}` : '0'}</td>
                <td>${parseFloat(payment.electricity_rate).toLocaleString()}</td>
                <td>${payment.previous_meter.toLocaleString()}</td>
                <td>${payment.current_meter.toLocaleString()}</td>
                <td>${electricityUsage.toLocaleString()}</td>
                <td>NT$ ${parseFloat(payment.total_amount).toLocaleString()}</td>
                <td>${payment.account_last_five || 'N/A'}</td>
                <td>
                    <span class="status-badge status-${payment.status}">
                        ${payment.status === 'confirmed' ? '已確認' : '待確認'}
                    </span>
                </td>
                <td>
                    <div class="action-btns">
                        ${payment.status !== 'confirmed' ? `
                            <button class="action-btn action-btn-confirm" onclick="confirmPayment(${payment.id})">
                                <i class="fas fa-check"></i> 確認
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// 更新繳費統計資訊
function updatePaymentStats(payments) {
    if (!payments || payments.length === 0) {
        document.getElementById('totalPayments').textContent = '0';
        document.getElementById('pendingPayments').textContent = '0';
        document.getElementById('confirmedPayments').textContent = '0';
        document.getElementById('totalAmount').textContent = 'NT$ 0';
        return;
    }
    
    const totalPayments = payments.length;
    const pendingPayments = payments.filter(p => p.status === 'pending').length;
    const confirmedPayments = payments.filter(p => p.status === 'confirmed').length;
    const totalAmount = payments.reduce((sum, payment) => sum + parseFloat(payment.total_amount || 0), 0);
    
    document.getElementById('totalPayments').textContent = totalPayments.toLocaleString();
    document.getElementById('pendingPayments').textContent = pendingPayments.toLocaleString();
    document.getElementById('confirmedPayments').textContent = confirmedPayments.toLocaleString();
    document.getElementById('totalAmount').textContent = `NT$ ${totalAmount.toLocaleString()}`;
}

// 確認繳費記錄
async function confirmPayment(paymentId) {
    try {
        showAlert('確認中...', 'info');
        
        const response = await api.paymentApi.updatePaymentStatus(paymentId, 'confirmed');
        
        if (response.success) {
            showAlert('繳費記錄已確認', 'success');
            
            // 重新載入繳費記錄
            setTimeout(() => {
                loadAllPayments();
            }, 1000);
        } else {
            showAlert(response.message || '確認失敗', 'error');
        }
    } catch (error) {
        console.error('確認繳費記錄失敗:', error);
        showAlert('確認失敗: ' + (error.message || '請稍後再試'), 'error');
    }
}

// 刪除租客
async function deleteTenant(tenantId, tenantName) {
    // 確認對話框
    if (!confirm(`確定要刪除租客 "${tenantName}" 嗎？\n\n此操作將會：\n1. 刪除租客帳號\n2. 刪除該租客的繳費記錄\n3. 刪除該租客上傳的圖片\n\n此操作無法復原！`)) {
        return;
    }
    
    try {
        showAlert('刪除中...', 'info');
        
        const response = await api.adminApi.deleteTenant(tenantId);
        
        if (response.success) {
            showAlert(`已成功刪除租客 "${tenantName}"`, 'success');
            
            // 重新載入租客列表
            setTimeout(() => {
                loadAllTenants();
                loadAllPayments(); // 重新載入繳費記錄，因為可能刪除了相關記錄
            }, 1000);
        } else {
            showAlert(response.message || '刪除失敗', 'error');
        }
    } catch (error) {
        console.error('刪除租客失敗:', error);
        showAlert('刪除失敗: ' + (error.message || '請稍後再試'), 'error');
    }
}

// 載入所有圖片
async function loadAllImages() {
    const loadingEl = document.getElementById('imagesLoading');
    const emptyEl = document.getElementById('imagesEmpty');
    const imagesGrid = document.getElementById('imagesGrid');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (imagesGrid) imagesGrid.innerHTML = '<div class="loading">載入中...</div>';
    
    try {
        const response = await api.adminApi.getAllImages();
        const images = response.images || [];
        
        if (loadingEl) loadingEl.style.display = 'none';
        
        if (images.length === 0) {
            if (imagesGrid) imagesGrid.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }
        
        // 更新圖片網格
        updateImagesGrid(images);
    } catch (error) {
        console.error('載入圖片失敗:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (imagesGrid) imagesGrid.innerHTML = '<div class="error">載入失敗，請刷新頁面</div>';
        showAlert('無法載入圖片列表', 'error');
    }
}

// 更新圖片網格
function updateImagesGrid(images) {
    const imagesGrid = document.getElementById('imagesGrid');
    
    if (!imagesGrid) return;
    
    let html = '';
    
    images.forEach(image => {
        const fileSizeMB = image.file_size ? (image.file_size / (1024 * 1024)).toFixed(2) : '0.00';
        const uploadDate = formatDate(image.uploaded_at, true);
        
        html += `
            <div class="image-card">
                <img src="${escapeHtml(image.image_url)}" alt="${escapeHtml(image.file_name)}" 
                     class="image-preview" 
                     onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"150\"><rect width=\"200\" height=\"150\" fill=\"%23f0f0f0\"/></svg>'">
                <div class="image-info">
                    <h4 title="${escapeHtml(image.file_name)}">${truncateFileName(escapeHtml(image.file_name))}</h4>
                    <p><i class="fas fa-user"></i> ${escapeHtml(image.tenant_name || image.tenant_id)}</p>
                    <p><i class="fas fa-calendar"></i> ${uploadDate}</p>
                    <p><i class="fas fa-weight"></i> ${fileSizeMB} MB</p>
                    <button class="action-btn action-btn-view" onclick="previewImage('${escapeHtml(image.image_url)}', '${escapeHtml(image.file_name)}')">
                        <i class="fas fa-search"></i> 查看
                    </button>
                    <button class="action-btn action-btn-download" onclick="downloadImage('${escapeHtml(image.image_url)}', '${escapeHtml(image.file_name)}')">
                        <i class="fas fa-download"></i> 下載
                    </button>
                </div>
            </div>
        `;
    });
    
    imagesGrid.innerHTML = html;
}

// 顯示提示訊息
function showAlert(message, type = 'info') {
    const alertEl = document.getElementById('alertMessage');
    if (!alertEl) return;
    
    alertEl.textContent = message;
    alertEl.className = `alert alert-${type}`;
    alertEl.style.display = 'block';
    
    // 自動隱藏
    setTimeout(() => {
        alertEl.style.display = 'none';
    }, 5000);
}

// 登出
function logout() {
    api.userApi.logout();
    window.location.href = 'login.html';
}

// 格式化日期
function formatDate(dateString, includeTime = false) {
    if (!dateString) return '--';
    
    try {
        const date = new Date(dateString);
        
        if (isNaN(date.getTime())) {
            return '日期格式錯誤';
        }
        
        if (includeTime) {
            return date.toLocaleString('zh-TW', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch (error) {
        return '日期錯誤';
    }
}

// 截斷檔案名稱
function truncateFileName(fileName, maxLength = 20) {
    if (!fileName || fileName.length <= maxLength) return fileName || '未命名';
    
    const extension = fileName.substring(fileName.lastIndexOf('.'));
    const nameWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.'));
    
    if (nameWithoutExtension.length <= maxLength - 3) return fileName;
    
    return nameWithoutExtension.substring(0, maxLength - 3) + '...' + extension;
}

// 跳脫 HTML 字元
function escapeHtml(text) {
    if (!text) return '';
    
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    
    return text.toString().replace(/[&<>"']/g, function(m) { 
        return map[m]; 
    });
}

// 預覽圖片
function previewImage(imageUrl, fileName) {
    // 建立彈跳窗
    const modalHtml = `
        <div class="modal active" id="imagePreviewModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>圖片預覽</h3>
                    <button class="modal-close" onclick="closeModal('imagePreviewModal')">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="text-align: center;">
                        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(fileName)}" 
                             style="max-width: 100%; max-height: 60vh; border-radius: 8px;"
                             onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"400\" height=\"300\"><rect width=\"400\" height=\"300\" fill=\"%23f0f0f0\"/></svg>'">
                        <p style="margin-top: 15px; color: #666;">${escapeHtml(fileName)}</p>
                        <div style="margin-top: 20px;">
                            <button class="btn btn-primary" onclick="downloadImage('${escapeHtml(imageUrl)}', '${escapeHtml(fileName)}')">
                                <i class="fas fa-download"></i> 下載圖片
                            </button>
                            <button class="btn btn-secondary" onclick="closeModal('imagePreviewModal')" style="margin-left: 10px;">
                                關閉
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 移除現有的彈跳窗
    const existingModal = document.getElementById('imagePreviewModal');
    if (existingModal) existingModal.remove();
    
    // 添加新的彈跳窗
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// 下載圖片
function downloadImage(imageUrl, fileName) {
    try {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = fileName || 'image.jpg';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showAlert('開始下載圖片', 'success');
    } catch (error) {
        console.error('下載圖片失敗:', error);
        showAlert('下載失敗，請手動保存圖片', 'error');
    }
}

// 關閉彈跳窗
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.remove();
}

// 全域函數
window.switchTab = switchTab;
window.logout = logout;
window.loadBankInfo = loadBankInfo;
window.saveBankInfo = saveBankInfo;
window.previewImage = previewImage;
window.downloadImage = downloadImage;
window.confirmPayment = confirmPayment;
window.deleteTenant = deleteTenant;
window.loadAllPayments = loadAllPayments;
window.closeModal = closeModal;