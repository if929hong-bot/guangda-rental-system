// frontend/js/tenant.js
document.addEventListener('DOMContentLoaded', async function() {
    // 檢查是否登入
    if (!api.checkAuth()) {
        window.location.href = 'login.html';
        return;
    }

    // 取得使用者資訊
    const user = api.getUserInfo();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // 初始化頁面
    initPage(user);
    loadTenantData();
    loadRecentPayments();
    loadBankInfo();
    loadImages();
    setupEventListeners();
    setupFormCalculations();
});

// 初始化頁面顯示
function initPage(user) {
    // 顯示使用者名稱
    document.getElementById('tenantName').textContent = user.name || user.username;
    document.getElementById('currentUsername').textContent = user.username;
    document.getElementById('tenantFullName').textContent = user.name || user.username;
    
    // 顯示房號
    if (user.room_number) {
        document.getElementById('roomNumber').textContent = user.room_number;
        document.getElementById('dashboardRoom').textContent = user.room_number;
    }
    
    // 顯示聯絡資訊
    if (user.phone) {
        document.getElementById('tenantPhone').textContent = user.phone;
    }
    if (user.email) {
        document.getElementById('tenantEmail').textContent = user.email;
    }
    
    // 顯示租約資訊
    if (user.lease_start) {
        document.getElementById('leaseStart').textContent = formatDate(user.lease_start);
    }
    if (user.lease_end) {
        document.getElementById('leaseEnd').textContent = formatDate(user.lease_end);
    }
    if (user.rent_amount) {
        document.getElementById('monthlyRent').textContent = `NT$ ${parseFloat(user.rent_amount).toLocaleString()}`;
    }
    
    // 計算下期繳租日期（假設每月第一天）
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    document.getElementById('nextPayment').textContent = formatDate(nextMonth);
}

// 載入租客資料
async function loadTenantData() {
    try {
        // 如果有需要，可以從伺服器重新取得最新資料
        // const response = await api.userApi.getProfile();
    } catch (error) {
        console.error('載入租客資料失敗:', error);
    }
}

// 載入最近繳費記錄
async function loadRecentPayments() {
    try {
        const response = await api.paymentApi.getPayments();
        const payments = response.payments || [];
        
        // 更新儀表板上的最近繳費記錄
        updateRecentPayments(payments.slice(0, 5));
        
        // 更新繳費記錄頁面的完整表格
        updatePaymentTable(payments);
    } catch (error) {
        console.error('載入繳費記錄失敗:', error);
        showNotification('無法載入繳費記錄', 'error');
    }
}

// 更新最近繳費記錄顯示
function updateRecentPayments(payments) {
    const recentPaymentsElement = document.getElementById('recentPayments');
    
    if (payments.length === 0) {
        recentPaymentsElement.innerHTML = '<p class="empty-state">暫無繳費記錄</p>';
        return;
    }
    
    let html = '<div class="recent-payments-list">';
    
    payments.forEach(payment => {
        html += `
            <div class="recent-payment-item">
                <div class="payment-date">${formatDate(payment.payment_date || payment.created_at)}</div>
                <div class="payment-amount">NT$ ${parseFloat(payment.total_amount).toLocaleString()}</div>
                <div class="payment-status ${payment.status}">${payment.status === 'confirmed' ? '✓ 已確認' : '⏳ 待確認'}</div>
            </div>
        `;
    });
    
    html += '</div>';
    recentPaymentsElement.innerHTML = html;
}

// 更新繳費記錄表格
function updatePaymentTable(payments) {
    const tableBody = document.getElementById('paymentTableBody');
    
    if (payments.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-table">暫無繳費記錄</td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    
    payments.forEach(payment => {
        const electricityUsage = payment.current_meter - payment.previous_meter;
        const electricityFee = electricityUsage * payment.electricity_rate;
        
        html += `
            <tr>
                <td>${formatDate(payment.payment_date || payment.created_at)}</td>
                <td>NT$ ${parseFloat(payment.rent_amount).toLocaleString()}</td>
                <td>${payment.water_fee ? `NT$ ${parseFloat(payment.water_fee).toLocaleString()}` : '0'}</td>
                <td>${parseFloat(payment.electricity_rate).toLocaleString()}</td>
                <td>${payment.previous_meter.toLocaleString()}</td>
                <td>${payment.current_meter.toLocaleString()}</td>
                <td>${electricityUsage.toLocaleString()}</td>
                <td>NT$ ${parseFloat(payment.total_amount).toLocaleString()}</td>
                <td>${payment.account_last_five || 'N/A'}</td>
                <td><span class="status-badge ${payment.status}">${payment.status === 'confirmed' ? '已確認' : '待確認'}</span></td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = html;
}

// 載入銀行資訊
async function loadBankInfo() {
    try {
        const response = await api.bankApi.getBankInfo();
        const bankInfo = response.bankInfo;
        
        document.getElementById('bankName').textContent = bankInfo.bank_name || '--';
        document.getElementById('branchName').textContent = bankInfo.branch_name || '--';
        document.getElementById('accountName').textContent = bankInfo.account_name || '--';
        document.getElementById('accountNumber').textContent = bankInfo.account_number || '--';
        
        if (bankInfo.updated_at) {
            document.getElementById('lastUpdated').textContent = formatDate(bankInfo.updated_at);
        }
    } catch (error) {
        console.error('載入銀行資訊失敗:', error);
        showNotification('無法載入銀行資訊', 'error');
    }
}

// 載入已上傳的圖片
async function loadImages() {
    try {
        const response = await api.imageApi.getImages();
        const images = response.images || [];
        
        updateImagesGrid(images);
    } catch (error) {
        console.error('載入圖片失敗:', error);
        showNotification('無法載入圖片列表', 'error');
    }
}

// 更新圖片網格顯示
function updateImagesGrid(images) {
    const imagesGrid = document.getElementById('imagesGrid');
    
    if (images.length === 0) {
        imagesGrid.innerHTML = '<p class="empty-state">尚未上傳任何圖片</p>';
        return;
    }
    
    let html = '';
    
    images.forEach(image => {
        const fileSizeMB = (image.file_size / (1024 * 1024)).toFixed(2);
        const uploadDate = formatDate(image.uploaded_at, true);
        
        html += `
            <div class="image-card">
                <div class="image-preview" onclick="previewImage('${image.image_url}', '${image.file_name}')">
                    <img src="${image.image_url}" alt="${image.file_name}" 
                         onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"150\" viewBox=\"0 0 200 150\"><rect width=\"200\" height=\"150\" fill=\"%23f0f0f0\"/></svg>'" 
                         loading="lazy">
                    <div class="image-overlay">
                        <i class="fas fa-search-plus"></i>
                    </div>
                </div>
                <div class="image-info">
                    <p class="image-name" title="${image.file_name}">${truncateFileName(image.file_name)}</p>
                    <p class="image-meta">${uploadDate} • ${fileSizeMB} MB</p>
                </div>
            </div>
        `;
    });
    
    imagesGrid.innerHTML = html;
}

// 設定事件監聽器
function setupEventListeners() {
    // 側邊欄導航
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // 移除所有 active 類別
            menuItems.forEach(i => i.classList.remove('active'));
            
            // 添加 active 類別到點擊的項目
            this.classList.add('active');
            
            // 隱藏所有內容區塊
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            
            // 顯示對應的內容區塊
            const targetId = this.getAttribute('href').substring(1);
            document.getElementById(targetId).classList.add('active');
        });
    });
    
    // 新增繳費記錄按鈕
    document.getElementById('newPaymentBtn').addEventListener('click', function() {
        showPaymentModal();
    });
    
    // 登出按鈕
    document.querySelector('.logout-btn').addEventListener('click', function() {
        api.userApi.logout();
        window.location.href = 'index.html';
    });
    
    // 檔案選擇按鈕
    document.getElementById('selectFilesBtn').addEventListener('click', function() {
        document.getElementById('fileInput').click();
    });
    
    // 檔案選擇事件
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', async function(e) {
        if (this.files.length > 0) {
            await uploadImages(this.files);
        }
    });
    
    // 拖放上傳
    const dropZone = document.getElementById('dropZone');
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', async function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
        
        if (e.dataTransfer.files.length > 0) {
            await uploadImages(e.dataTransfer.files);
        }
    });
    
    // 彈跳窗關閉按鈕
    const closeButtons = document.querySelectorAll('.close-modal, .close-btn');
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modal = this.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // 點擊彈跳窗外部關閉
    window.addEventListener('click', function(e) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
    
    // 提交繳費記錄
    document.getElementById('submitPaymentBtn').addEventListener('click', async function() {
        await submitPaymentForm();
    });
    
    // 按下 Enter 提交繳費記錄
    const paymentForm = document.getElementById('paymentForm');
    if (paymentForm) {
        paymentForm.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                document.getElementById('submitPaymentBtn').click();
            }
        });
    }
}

// 設定表單自動計算
function setupFormCalculations() {
    const form = document.getElementById('paymentForm');
    
    if (!form) return;
    
    // 監聽電表數字變化
    const previousMeter = form.querySelector('#previousMeter');
    const currentMeter = form.querySelector('#currentMeter');
    const electricityRate = form.querySelector('#electricityRate');
    const rentAmount = form.querySelector('#rentAmount');
    const waterFee = form.querySelector('#waterFee');
    
    const calculateFields = [previousMeter, currentMeter, electricityRate, rentAmount, waterFee];
    
    calculateFields.forEach(field => {
        field.addEventListener('input', calculatePayment);
    });
}

// 計算繳費金額
function calculatePayment() {
    const form = document.getElementById('paymentForm');
    
    if (!form) return;
    
    try {
        // 取得輸入值
        const previousMeter = parseFloat(form.querySelector('#previousMeter').value) || 0;
        const currentMeter = parseFloat(form.querySelector('#currentMeter').value) || 0;
        const electricityRate = parseFloat(form.querySelector('#electricityRate').value) || 0;
        const rentAmount = parseFloat(form.querySelector('#rentAmount').value) || 0;
        const waterFee = parseFloat(form.querySelector('#waterFee').value) || 0;
        
        // 計算用電度數
        const electricityUsage = Math.max(0, currentMeter - previousMeter);
        form.querySelector('#electricityUsage').value = electricityUsage;
        
        // 計算電費
        const electricityFee = electricityUsage * electricityRate;
        form.querySelector('#electricityFee').value = electricityFee.toFixed(2);
        
        // 計算總金額
        const totalAmount = rentAmount + waterFee + electricityFee;
        form.querySelector('#totalAmount').value = totalAmount.toFixed(2);
    } catch (error) {
        console.error('計算錯誤:', error);
    }
}

// 顯示繳費記錄彈跳窗
function showPaymentModal() {
    const modal = document.getElementById('paymentModal');
    
    // 設定預設日期為今天
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('paymentDate').value = today;
    
    // 重設表單
    const form = document.getElementById('paymentForm');
    form.reset();
    
    // 設定預設值
    document.getElementById('electricityRate').value = '5.5';
    document.getElementById('waterFee').value = '0';
    
    // 觸發計算
    calculatePayment();
    
    // 顯示彈跳窗
    modal.style.display = 'block';
}

// 提交繳費記錄表單
async function submitPaymentForm() {
    const form = document.getElementById('paymentForm');
    
    // 驗證表單
    if (!form.checkValidity()) {
        showNotification('請填寫所有必填欄位', 'error');
        return;
    }
    
    // 取得表單數據
    const formData = {
        payment_date: form.querySelector('#paymentDate').value,
        rent_amount: form.querySelector('#rentAmount').value,
        water_fee: form.querySelector('#waterFee').value || 0,
        electricity_rate: form.querySelector('#electricityRate').value,
        previous_meter: form.querySelector('#previousMeter').value,
        current_meter: form.querySelector('#currentMeter').value,
        total_amount: form.querySelector('#totalAmount').value,
        account_last_five: form.querySelector('#accountLastFive').value
    };
    
    // 驗證電表數字
    if (parseFloat(formData.previous_meter) >= parseFloat(formData.current_meter)) {
        showNotification('本期電表度數必須大於上期電表度數', 'error');
        return;
    }
    
    // 驗證帳號後五碼
    if (!/^\d{5}$/.test(formData.account_last_five)) {
        showNotification('請輸入正確的帳號後五碼（5位數字）', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submitPaymentBtn');
    const originalText = submitBtn.innerHTML;
    
    try {
        // 禁用按鈕並顯示載入中
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';
        
        // 提交數據
        const response = await api.paymentApi.createPayment(formData);
        
        if (response.success) {
            // 關閉彈跳窗
            document.getElementById('paymentModal').style.display = 'none';
            
            // 顯示成功訊息
            showNotification('繳費記錄已成功提交', 'success');
            
            // 重新載入繳費記錄
            loadRecentPayments();
            
            // 重設表單
            form.reset();
        } else {
            showNotification(response.message || '提交失敗', 'error');
        }
    } catch (error) {
        console.error('提交繳費記錄失敗:', error);
        showNotification('提交失敗：' + error.message, 'error');
    } finally {
        // 恢復按鈕狀態
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// 上傳圖片
async function uploadImages(files) {
    const maxFiles = 5;
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    
    // 檢查檔案數量
    if (files.length > maxFiles) {
        showNotification(`最多只能上傳 ${maxFiles} 個檔案`, 'error');
        return;
    }
    
    // 檢查檔案大小和類型
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (file.size > maxFileSize) {
            showNotification(`檔案 ${file.name} 超過 10MB 大小限制`, 'error');
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            showNotification(`檔案 ${file.name} 不是圖片格式`, 'error');
            return;
        }
    }
    
    // 顯示上傳進度條
    const progressElement = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressElement.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = '準備上傳...';
    
    const selectFilesBtn = document.getElementById('selectFilesBtn');
    selectFilesBtn.disabled = true;
    
    try {
        // 建立 FormData
        const formData = new FormData();
        
        // 新增檔案到 FormData
        for (let i = 0; i < files.length; i++) {
            formData.append('images', files[i]);
        }
        
        // 取得 token
        const token = api.getToken();
        
        // 發送上傳請求
        const response = await fetch(`${window.location.origin}/api/images/upload-multiple`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        // 更新進度條（模擬進度）
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += 10;
            if (progress > 90) {
                clearInterval(progressInterval);
            }
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `上傳中... ${progress}%`;
        }, 200);
        
        const result = await response.json();
        
        clearInterval(progressInterval);
        
        if (result.success) {
            // 完成進度條
            progressFill.style.width = '100%';
            progressText.textContent = '上傳完成！';
            
            showNotification(`成功上傳 ${result.images.length} 張圖片`, 'success');
            
            // 延遲後重新載入圖片
            setTimeout(() => {
                loadImages();
                progressElement.style.display = 'none';
                selectFilesBtn.disabled = false;
                
                // 清空檔案輸入
                document.getElementById('fileInput').value = '';
            }, 1000);
        } else {
            progressText.textContent = '上傳失敗';
            showNotification(result.message || '上傳失敗', 'error');
            selectFilesBtn.disabled = false;
            
            setTimeout(() => {
                progressElement.style.display = 'none';
            }, 2000);
        }
    } catch (error) {
        console.error('上傳圖片失敗:', error);
        progressText.textContent = '上傳失敗';
        showNotification('上傳失敗：' + error.message, 'error');
        selectFilesBtn.disabled = false;
        
        setTimeout(() => {
            progressElement.style.display = 'none';
        }, 2000);
    }
}

// 預覽圖片（全域函數）
window.previewImage = function(imageUrl, fileName) {
    const modal = document.getElementById('imagePreviewModal');
    const previewImage = document.getElementById('previewImage');
    const imagePreviewTitle = document.getElementById('imagePreviewTitle');
    const imageFileName = document.getElementById('imageFileName');
    const downloadImageBtn = document.getElementById('downloadImageBtn');
    
    // 設定圖片
    previewImage.src = imageUrl;
    
    // 設定標題
    imagePreviewTitle.textContent = '圖片預覽';
    imageFileName.textContent = `檔名：${fileName}`;
    
    // 設定下載連結
    downloadImageBtn.href = imageUrl;
    downloadImageBtn.download = fileName;
    
    // 顯示彈跳窗
    modal.style.display = 'block';
};

// 顯示通知
function showNotification(message, type = 'info') {
    // 移除現有的通知
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // 建立通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
        <button class="notification-close">&times;</button>
    `;
    
    // 添加到頁面
    document.body.appendChild(notification);
    
    // 顯示通知
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // 自動移除通知
    const autoRemoveTimeout = setTimeout(() => {
        closeNotification(notification);
    }, 5000);
    
    // 關閉按鈕事件
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        clearTimeout(autoRemoveTimeout);
        closeNotification(notification);
    });
}

function closeNotification(notification) {
    notification.classList.remove('show');
    setTimeout(() => {
        notification.remove();
    }, 300);
}

// 格式化日期
function formatDate(dateString, includeTime = false) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
        return '無效日期';
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
}

// 截斷檔案名稱
function truncateFileName(fileName, maxLength = 20) {
    if (fileName.length <= maxLength) return fileName;
    
    const extension = fileName.substring(fileName.lastIndexOf('.'));
    const nameWithoutExtension = fileName.substring(0, fileName.lastIndexOf('.'));
    
    if (nameWithoutExtension.length <= maxLength - 3) return fileName;
    
    return nameWithoutExtension.substring(0, maxLength - 3) + '...' + extension;
}

// 全域日期格式化函數
window.formatDate = formatDate;
window.truncateFileName = truncateFileName;