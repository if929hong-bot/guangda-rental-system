// frontend/js/admin.js - 管理員後台（分頁版本）
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Admin page loaded');
    
    // 檢查是否登入
    if (!api.checkAuth()) {
        console.log('Not authenticated, redirecting to login');
        window.location.href = 'login.html';
        return;
    }

    // 取得使用者資訊
    const user = api.getUserInfo();
    console.log('User info:', user);
    
    if (!user || user.role !== 'admin') {
        console.log('Not admin user, redirecting to login');
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
    
    // 載入租客選項（這個必須最先載入，因為篩選器需要它）
    await loadTenantOptions();
    
    // 載入銀行資訊
    loadBankInfo();
    
    // 根據當前活動的標籤頁載入資料
    const activeTabContent = document.querySelector('.tab-content.active');
    if (activeTabContent) {
        const tabId = activeTabContent.id;
        if (tabId === 'paymentsTab') {
            loadPaymentsWithPagination(1);
        } else if (tabId === 'imagesTab') {
            loadImagesWithPagination(1);
        } else if (tabId === 'tenantsTab') {
            loadAllTenants();
        }
    }
});

// 初始化管理員頁面
function initAdminPage() {
    console.log('Initializing admin page');
    
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
    
    // 初始化分頁事件監聽
    initPagination();
}

// 初始化分頁事件監聽
function initPagination() {
    console.log('Initializing pagination listeners');
    
    // 繳費記錄搜索
    const paymentSearchBtn = document.getElementById('paymentSearchBtn');
    if (paymentSearchBtn) {
        paymentSearchBtn.addEventListener('click', () => loadPaymentsWithPagination(1));
    }
    
    const paymentSearchInput = document.getElementById('paymentSearch');
    if (paymentSearchInput) {
        paymentSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loadPaymentsWithPagination(1);
            }
        });
    }
    
    // 圖片搜索
    const imageSearchBtn = document.getElementById('imageSearchBtn');
    if (imageSearchBtn) {
        imageSearchBtn.addEventListener('click', () => loadImagesWithPagination(1));
    }
    
    const imageSearchInput = document.getElementById('imageSearch');
    if (imageSearchInput) {
        imageSearchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                loadImagesWithPagination(1);
            }
        });
    }
    
    // 篩選器變更事件 - 修復：確保事件監聽器正確綁定
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        console.log('Status filter found, adding event listener');
        // 移除舊的事件監聽器（如果有）
        statusFilter.removeEventListener('change', handleStatusFilterChange);
        // 添加新的事件監聽器
        statusFilter.addEventListener('change', handleStatusFilterChange);
    }
    
    const tenantFilter = document.getElementById('tenantFilter');
    if (tenantFilter) {
        console.log('Tenant filter found, adding event listener');
        // 移除舊的事件監聽器（如果有）
        tenantFilter.removeEventListener('change', handleTenantFilterChange);
        // 添加新的事件監聽器
        tenantFilter.addEventListener('change', handleTenantFilterChange);
    }
    
    const imageTenantFilter = document.getElementById('imageTenantFilter');
    if (imageTenantFilter) {
        console.log('Image tenant filter found, adding event listener');
        // 移除舊的事件監聽器（如果有）
        imageTenantFilter.removeEventListener('change', handleImageTenantFilterChange);
        // 添加新的事件監聽器
        imageTenantFilter.addEventListener('change', handleImageTenantFilterChange);
    }
    
    // 重新輸入按鈕
    const resetPaymentBtn = document.getElementById('resetPaymentBtn');
    if (resetPaymentBtn) {
        resetPaymentBtn.addEventListener('click', resetPaymentFilters);
    }
    
    const resetImageBtn = document.getElementById('resetImageBtn');
    if (resetImageBtn) {
        resetImageBtn.addEventListener('click', resetImageFilters);
    }
}

// 篩選器變更處理函數
function handleStatusFilterChange() {
    console.log('Status filter changed');
    loadPaymentsWithPagination(1);
}

function handleTenantFilterChange() {
    console.log('Tenant filter changed, value:', document.getElementById('tenantFilter').value);
    loadPaymentsWithPagination(1);
}

function handleImageTenantFilterChange() {
    console.log('Image tenant filter changed');
    loadImagesWithPagination(1);
}

// 切換標籤頁
function switchTab(tabName) {
    console.log('Switching to tab:', tabName);
    
    // 移除所有標籤頁的 active 類別
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 添加 active 類別到目標標籤頁
    const targetTabBtn = document.querySelector(`[onclick="switchTab('${tabName}')"]`);
    if (targetTabBtn) {
        targetTabBtn.classList.add('active');
    }
    
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
            loadPaymentsWithPagination(1);
            break;
        case 'images':
            loadImagesWithPagination(1);
            break;
        case 'bank':
            loadBankInfo();
            break;
    }
}

// 載入租客選項
async function loadTenantOptions() {
    try {
        console.log('Loading tenant options');
        const response = await api.adminPaginatedApi.getTenantOptions();
        
        if (response.success && response.data) {
            console.log('Tenant options loaded:', response.data.length);
            
            // 更新繳費記錄頁面的租客篩選器
            const tenantFilter = document.getElementById('tenantFilter');
            if (tenantFilter) {
                // 保存當前選中的值
                const currentValue = tenantFilter.value;
                tenantFilter.innerHTML = '<option value="all">全部租客</option>';
                
                response.data.forEach(tenant => {
                    const option = document.createElement('option');
                    option.value = tenant.id;
                    option.textContent = `${tenant.name || tenant.username} (${tenant.room_number || '--'})`;
                    tenantFilter.appendChild(option);
                });
                
                // 恢復之前選中的值（如果還存在）
                if (currentValue && currentValue !== 'all') {
                    tenantFilter.value = currentValue;
                }
                
                console.log('Tenant filter updated with', response.data.length, 'options');
            }
            
            // 更新圖片頁面的租客篩選器
            const imageTenantFilter = document.getElementById('imageTenantFilter');
            if (imageTenantFilter) {
                // 保存當前選中的值
                const currentValue = imageTenantFilter.value;
                imageTenantFilter.innerHTML = '<option value="all">全部租客</option>';
                
                response.data.forEach(tenant => {
                    const option = document.createElement('option');
                    option.value = tenant.id;
                    option.textContent = `${tenant.name || tenant.username} (${tenant.room_number || '--'})`;
                    imageTenantFilter.appendChild(option);
                });
                
                // 恢復之前選中的值（如果還存在）
                if (currentValue && currentValue !== 'all') {
                    imageTenantFilter.value = currentValue;
                }
            }
            
            showAlert('租客選項載入完成', 'success');
        } else {
            console.error('Failed to load tenant options:', response);
            showAlert('載入租客選項失敗', 'error');
        }
    } catch (error) {
        console.error('載入租客選項失敗:', error);
        showAlert('無法載入租客選項: ' + (error.message || '請檢查網路連接'), 'error');
    }
}

// 繳費記錄分頁相關變數
let currentPaymentPage = 1;
const paymentsPerPage = 10;
let totalPaymentPages = 1;

// 載入繳費記錄（分頁）
async function loadPaymentsWithPagination(page = 1) {
    console.log('Loading payments page:', page);
    
    const loadingEl = document.getElementById('paymentsLoading');
    const emptyEl = document.getElementById('paymentsEmpty');
    const tableBody = document.querySelector('#paymentsTable tbody');
    const paginationEl = document.getElementById('paymentPagination');
    
    // 顯示載入狀態
    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (paginationEl) paginationEl.style.display = 'none';
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="13" class="loading">載入中...</td></tr>';
    
    try {
        // 獲取篩選條件
        const statusFilter = document.getElementById('statusFilter')?.value || 'all';
        const tenantFilter = document.getElementById('tenantFilter')?.value || 'all';
        const searchInput = document.getElementById('paymentSearch')?.value || '';
        
        console.log('Payment filters:', { 
            page, 
            statusFilter, 
            tenantFilter, 
            searchInput 
        });
        
        // 呼叫分頁 API
        const response = await api.adminPaginatedApi.getPayments({
            page: page,
            limit: paymentsPerPage,
            status: statusFilter,
            tenant_id: tenantFilter,
            search: searchInput
        });
        
        console.log('Payments API response:', response);
        
        // 隱藏載中指示器
        if (loadingEl) loadingEl.style.display = 'none';
        
        if (!response.success) {
            console.error('API returned error:', response.message);
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="13" class="error">載入失敗: ' + (response.message || 'API錯誤') + '</td></tr>';
            if (emptyEl) emptyEl.style.display = 'none';
            updatePaymentStats({});
            return;
        }
        
        if (!response.data || response.data.length === 0) {
            console.log('No payment data found for current filters');
            if (tableBody) tableBody.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            updatePaymentStats(response.statistics || {});
            return;
        }
        
        console.log('Found', response.data.length, 'payment records');
        
        // 更新表格
        updatePaymentsTable(response.data);
        
        // 更新統計資訊
        updatePaymentStats(response.statistics || {});
        
        // 更新分頁控制
        currentPaymentPage = response.pagination.current_page;
        totalPaymentPages = response.pagination.total_pages;
        
        if (paginationEl && totalPaymentPages > 1) {
            renderPagination('paymentPagination', currentPaymentPage, totalPaymentPages, 'changePaymentPage');
            paginationEl.style.display = 'block';
        } else if (paginationEl) {
            paginationEl.style.display = 'none';
        }
        
        // 顯示成功訊息（僅在第一次載入時）
        if (page === 1) {
            showAlert(`已載入 ${response.data.length} 筆繳費記錄`, 'success');
        }
        
    } catch (error) {
        console.error('載入繳費記錄失敗:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="13" class="error">載入失敗，請刷新頁面</td></tr>';
        showAlert('無法載入繳費記錄: ' + (error.message || '請檢查網路連接'), 'error');
    }
}

// 更改繳費記錄頁面
function changePaymentPage(page) {
    console.log('Changing to payment page:', page);
    if (page < 1 || page > totalPaymentPages) return;
    loadPaymentsWithPagination(page);
}

// 圖片分頁相關變數
let currentImagePage = 1;
const imagesPerPage = 12;
let totalImagePages = 1;

// 載入圖片（分頁）
async function loadImagesWithPagination(page = 1) {
    console.log('Loading images page:', page);
    
    const loadingEl = document.getElementById('imagesLoading');
    const emptyEl = document.getElementById('imagesEmpty');
    const imagesGrid = document.getElementById('imagesGrid');
    const paginationEl = document.getElementById('imagePagination');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (paginationEl) paginationEl.style.display = 'none';
    if (imagesGrid) imagesGrid.innerHTML = '<div class="loading">載入中...</div>';
    
    try {
        // 獲取篩選條件
        const tenantFilter = document.getElementById('imageTenantFilter')?.value || 'all';
        const searchInput = document.getElementById('imageSearch')?.value || '';
        
        console.log('Image filters:', { tenantFilter, searchInput });
        
        // 呼叫分頁 API
        const response = await api.adminPaginatedApi.getImages({
            page: page,
            limit: imagesPerPage,
            tenant_id: tenantFilter,
            search: searchInput
        });
        
        console.log('Images API response:', response);
        
        if (loadingEl) loadingEl.style.display = 'none';
        
        if (!response.success || !response.data || response.data.length === 0) {
            console.log('No image data found');
            if (imagesGrid) imagesGrid.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }
        
        // 更新圖片網格
        updateImagesGrid(response.data);
        
        // 更新分頁控制
        currentImagePage = response.pagination.current_page;
        totalImagePages = response.pagination.total_pages;
        
        if (paginationEl && totalImagePages > 1) {
            renderPagination('imagePagination', currentImagePage, totalImagePages, 'changeImagePage');
            paginationEl.style.display = 'block';
        }
        
    } catch (error) {
        console.error('載入圖片失敗:', error);
        if (loadingEl) loadingEl.style.display = 'none';
        if (imagesGrid) imagesGrid.innerHTML = '<div class="error">載入失敗，請刷新頁面</div>';
        showAlert('無法載入圖片列表', 'error');
    }
}

// 更改圖片頁面
function changeImagePage(page) {
    console.log('Changing to image page:', page);
    if (page < 1 || page > totalImagePages) return;
    loadImagesWithPagination(page);
}

// 渲染分頁控制
function renderPagination(elementId, currentPage, totalPages, callbackFunction) {
    const paginationEl = document.getElementById(elementId);
    if (!paginationEl) return;
    
    let html = '';
    
    // 上一頁按鈕
    if (currentPage > 1) {
        html += `<button class="page-btn" onclick="${callbackFunction}(${currentPage - 1})">
                    <i class="fas fa-chevron-left"></i> 上一頁
                </button>`;
    }
    
    // 頁碼按鈕
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        html += `<button class="page-btn" onclick="${callbackFunction}(1)">1</button>`;
        if (startPage > 2) {
            html += '<span class="page-dots">...</span>';
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        if (i === currentPage) {
            html += `<span class="page-btn active">${i}</span>`;
        } else {
            html += `<button class="page-btn" onclick="${callbackFunction}(${i})">${i}</button>`;
        }
    }
    
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += '<span class="page-dots">...</span>';
        }
        html += `<button class="page-btn" onclick="${callbackFunction}(${totalPages})">${totalPages}</button>`;
    }
    
    // 下一頁按鈕
    if (currentPage < totalPages) {
        html += `<button class="page-btn" onclick="${callbackFunction}(${currentPage + 1})">
                    下一頁 <i class="fas fa-chevron-right"></i>
                </button>`;
    }
    
    // 顯示頁數資訊
    html += `<div class="page-info">第 ${currentPage} 頁，共 ${totalPages} 頁</div>`;
    
    paginationEl.innerHTML = html;
}

// 載入銀行資訊
async function loadBankInfo() {
    try {
        console.log('Loading bank info');
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
    console.log('Loading all tenants');
    
    const loadingEl = document.getElementById('tenantsLoading');
    const emptyEl = document.getElementById('tenantsEmpty');
    const tableBody = document.querySelector('#tenantsTable tbody');
    
    if (loadingEl) loadingEl.style.display = 'block';
    if (emptyEl) emptyEl.style.display = 'none';
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="9" class="loading">載入中...</td></tr>';
    
    try {
        const response = await api.adminApi.getAllTenants();
        const tenants = response.tenants || [];
        
        console.log('Tenants loaded:', tenants.length);
        
        if (loadingEl) loadingEl.style.display = 'none';
        
        if (tenants.length === 0) {
            if (tableBody) tableBody.innerHTML = '';
            if (emptyEl) emptyEl.style.display = 'block';
            return;
        }
        
        // 更新表格
        updateTenantsTable(tenants);
        
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

// 更新繳費記錄表格
function updatePaymentsTable(payments) {
    const tableBody = document.querySelector('#paymentsTable tbody');
    
    if (!tableBody) return;
    
    let html = '';
    
    console.log('Rendering', payments.length, 'payment records');
    
    payments.forEach(payment => {
        // 計算用電量和電費
        const previousMeter = parseFloat(payment.previous_meter) || 0;
        const currentMeter = parseFloat(payment.current_meter) || 0;
        const electricityRate = parseFloat(payment.electricity_rate) || 0;
        const electricityUsage = currentMeter - previousMeter;
        const electricityFee = electricityUsage * electricityRate;
        
        // 計算總金額（如果沒有總金額，就計算）
        const rentAmount = parseFloat(payment.rent_amount) || 0;
        const waterFee = parseFloat(payment.water_fee) || 0;
        const totalAmount = payment.total_amount ? parseFloat(payment.total_amount) : (rentAmount + waterFee + electricityFee);
        
        html += `
            <tr>
                <td>${escapeHtml(payment.tenant_name || '租客')}</td>
                <td>${escapeHtml(payment.room_number || '--')}</td>
                <td>${formatDate(payment.payment_date || payment.created_at)}</td>
                <td>NT$ ${rentAmount.toLocaleString()}</td>
                <td>${waterFee > 0 ? `NT$ ${waterFee.toLocaleString()}` : '0'}</td>
                <td>${electricityRate.toLocaleString()}</td>
                <td>${previousMeter.toLocaleString()}</td>
                <td>${currentMeter.toLocaleString()}</td>
                <td>${electricityUsage.toLocaleString()}</td>
                <td>NT$ ${totalAmount.toLocaleString()}</td>
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
function updatePaymentStats(stats) {
    if (!stats) {
        stats = {};
    }
    
    console.log('Updating payment stats:', stats);
    
    document.getElementById('totalPayments').textContent = stats.total_payments?.toLocaleString() || '0';
    document.getElementById('pendingPayments').textContent = stats.pending_payments?.toLocaleString() || '0';
    document.getElementById('confirmedPayments').textContent = stats.confirmed_payments?.toLocaleString() || '0';
    document.getElementById('totalAmount').textContent = `NT$ ${parseFloat(stats.total_amount || 0).toLocaleString()}`;
}

// 確認繳費記錄
async function confirmPayment(paymentId) {
    try {
        showAlert('確認中...', 'info');
        
        const response = await api.adminPaginatedApi.updatePaymentStatus(paymentId, 'confirmed');
        
        if (response.success) {
            showAlert('繳費記錄已確認', 'success');
            
            // 重新載入繳費記錄
            setTimeout(() => {
                loadPaymentsWithPagination(currentPaymentPage);
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
            
            // 重新載入租客列表和選項
            setTimeout(() => {
                loadAllTenants();
                loadTenantOptions(); // 重新載入租客選項
                // 重新載入繳費記錄和圖片（如果它們是活動的）
                const activeTabContent = document.querySelector('.tab-content.active');
                if (activeTabContent) {
                    const tabId = activeTabContent.id;
                    if (tabId === 'paymentsTab') {
                        loadPaymentsWithPagination(1);
                    } else if (tabId === 'imagesTab') {
                        loadImagesWithPagination(1);
                    }
                }
            }, 1000);
        } else {
            showAlert(response.message || '刪除失敗', 'error');
        }
    } catch (error) {
        console.error('刪除租客失敗:', error);
        showAlert('刪除失敗: ' + (error.message || '請稍後再試'), 'error');
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
                     onerror="this.onerror=null; this.src='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"150\"><rect width=\"200\" height=\"150\" fill=\"%23f0f0f0\"/></svg>'"
                     onclick="previewImage('${escapeHtml(image.image_url)}', '${escapeHtml(image.file_name)}', '${escapeHtml(image.tenant_name || '未知')}', '${uploadDate}', '${fileSizeMB} MB')">
                <div class="image-info">
                    <h4 title="${escapeHtml(image.file_name)}">${truncateFileName(escapeHtml(image.file_name))}</h4>
                    <p><i class="fas fa-user"></i> ${escapeHtml(image.tenant_name || image.tenant_id)}</p>
                    <p><i class="fas fa-calendar"></i> ${uploadDate}</p>
                    <p><i class="fas fa-weight"></i> ${fileSizeMB} MB</p>
                    <div class="image-actions">
                        <button class="action-btn action-btn-view" onclick="previewImage('${escapeHtml(image.image_url)}', '${escapeHtml(image.file_name)}', '${escapeHtml(image.tenant_name || '未知')}', '${uploadDate}', '${fileSizeMB} MB')">
                            <i class="fas fa-search"></i> 查看
                        </button>
                        <button class="action-btn action-btn-download" onclick="downloadImage('${escapeHtml(image.image_url)}', '${escapeHtml(image.file_name)}')">
                            <i class="fas fa-download"></i> 下載
                        </button>
                    </div>
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
function previewImage(imageUrl, fileName, tenantName, uploadDate, fileSize) {
    const modal = document.getElementById('imagePreviewModal');
    const previewImage = document.getElementById('previewImage');
    const previewImageInfo = document.getElementById('previewImageInfo');
    
    previewImage.src = imageUrl;
    previewImageInfo.innerHTML = `
        <div><strong>檔案名稱：</strong>${fileName || '未命名'}</div>
        <div><strong>上傳者：</strong>${tenantName || '未知租客'}</div>
        <div><strong>上傳時間：</strong>${uploadDate || '未知時間'}</div>
        <div><strong>檔案大小：</strong>${fileSize || '未知大小'}</div>
    `;
    
    modal.classList.add('active');
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
    if (modal) {
        modal.classList.remove('active');
    }
}

// 重置繳費記錄篩選器
function resetPaymentFilters() {
    console.log('Resetting payment filters');
    document.getElementById('statusFilter').value = 'all';
    document.getElementById('tenantFilter').value = 'all';
    document.getElementById('paymentSearch').value = '';
    loadPaymentsWithPagination(1);
}

// 重置圖片篩選器
function resetImageFilters() {
    console.log('Resetting image filters');
    document.getElementById('imageTenantFilter').value = 'all';
    document.getElementById('imageSearch').value = '';
    loadImagesWithPagination(1);
}

// 下載預覽的圖片
function downloadPreviewImage() {
    const previewImage = document.getElementById('previewImage');
    const imageUrl = previewImage.src;
    const fileName = imageUrl.substring(imageUrl.lastIndexOf('/') + 1) || 'image.jpg';
    downloadImage(imageUrl, fileName);
}

// 確保所有函數都在全域作用域中
window.switchTab = switchTab;
window.logout = logout;
window.loadBankInfo = loadBankInfo;
window.saveBankInfo = saveBankInfo;
window.previewImage = previewImage;
window.downloadImage = downloadImage;
window.confirmPayment = confirmPayment;
window.deleteTenant = deleteTenant;
window.loadPaymentsWithPagination = loadPaymentsWithPagination;
window.changePaymentPage = changePaymentPage;
window.changeImagePage = changeImagePage;
window.closeModal = closeModal;
window.resetPaymentFilters = resetPaymentFilters;
window.resetImageFilters = resetImageFilters;
window.downloadPreviewImage = downloadPreviewImage;
window.loadAllTenants = loadAllTenants;
window.loadImagesWithPagination = loadImagesWithPagination;
// 新增篩選器處理函數到全域
window.handleStatusFilterChange = handleStatusFilterChange;
window.handleTenantFilterChange = handleTenantFilterChange;
window.handleImageTenantFilterChange = handleImageTenantFilterChange;