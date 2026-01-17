// frontend/js/tenant.js - 修复版
// 移除 ES6 導入語法，改用全局對象
const api = window.api || {};

// DOM 元素
const DOM = {
    // 使用者資訊
    tenantName: document.getElementById('tenantName'),
    currentUsername: document.getElementById('currentUsername'),
    roomNumber: document.getElementById('roomNumber'),
    dashboardRoom: document.getElementById('dashboardRoom'),
    tenantFullName: document.getElementById('tenantFullName'),
    tenantPhone: document.getElementById('tenantPhone'),
    tenantEmail: document.getElementById('tenantEmail'),
    
    // 租約資訊
    leaseStart: document.getElementById('leaseStart'),
    leaseEnd: document.getElementById('leaseEnd'),
    monthlyRent: document.getElementById('monthlyRent'),
    nextPayment: document.getElementById('nextPayment'),
    
    // 銀行資訊
    bankName: document.getElementById('bankName'),
    branchName: document.getElementById('branchName'),
    accountName: document.getElementById('accountName'),
    accountNumber: document.getElementById('accountNumber'),
    lastUpdated: document.getElementById('lastUpdated'),
    
    // 繳費相關
    newPaymentBtn: document.getElementById('newPaymentBtn'),
    paymentModal: document.getElementById('paymentModal'),
    paymentForm: document.getElementById('paymentForm'),
    submitPaymentBtn: document.getElementById('submitPaymentBtn'),
    recentPayments: document.getElementById('recentPayments'),
    paymentTableBody: document.getElementById('paymentTableBody'),
    
    // 圖片上傳相關
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    selectFilesBtn: document.getElementById('selectFilesBtn'),
    uploadProgress: document.getElementById('uploadProgress'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    imagesGrid: document.getElementById('imagesGrid'),
    
    // 圖片預覽相關
    imagePreviewModal: document.getElementById('imagePreviewModal'),
    previewImage: document.getElementById('previewImage'),
    imagePreviewTitle: document.getElementById('imagePreviewTitle'),
    imageFileName: document.getElementById('imageFileName'),
    imageUploadDate: document.getElementById('imageUploadDate'),
    imageFileSize: document.getElementById('imageFileSize'),
    downloadImageBtn: document.getElementById('downloadImageBtn'),
    
    // 選單和區塊
    menuItems: document.querySelectorAll('.menu-item'),
    contentSections: document.querySelectorAll('.content-section'),
    
    // 其他
    closeModalBtns: document.querySelectorAll('.close-modal, .close-btn'),
    logoutBtn: document.querySelector('.logout-btn')
};

// 繳費表單計算相關元素
const paymentFormElements = {
    rentAmount: document.getElementById('rentAmount'),
    waterFee: document.getElementById('waterFee'),
    electricityRate: document.getElementById('electricityRate'),
    previousMeter: document.getElementById('previousMeter'),
    currentMeter: document.getElementById('currentMeter'),
    electricityUsage: document.getElementById('electricityUsage'),
    electricityFee: document.getElementById('electricityFee'),
    totalAmount: document.getElementById('totalAmount'),
    paymentDate: document.getElementById('paymentDate')
};

// 初始化
async function init() {
    if (!api.checkAuth()) return;
    
    // 檢查使用者角色
    const user = api.getUserInfo();
    if (user.role !== 'tenant') {
        alert('您不是租客，無法訪問此頁面');
        window.location.href = user.role === 'admin' ? 'admin.html' : 'index.html';
        return;
    }
    
    // 設定使用者資訊
    DOM.tenantName.textContent = user.name || user.username;
    DOM.currentUsername.textContent = user.username;
    DOM.roomNumber.textContent = user.room_number;
    DOM.dashboardRoom.textContent = user.room_number;
    DOM.tenantFullName.textContent = user.name || user.username;
    DOM.tenantPhone.textContent = user.phone || '未設定';
    DOM.tenantEmail.textContent = user.email || '未設定';
    
    // 設定租約資訊
    if (user.lease_start) {
        DOM.leaseStart.textContent = formatDate(user.lease_start);
    }
    if (user.lease_end) {
        DOM.leaseEnd.textContent = formatDate(user.lease_end);
    }
    if (user.rent_amount) {
        DOM.monthlyRent.textContent = `NT$ ${Number(user.rent_amount).toLocaleString()}`;
    }
    
    // 計算下期繳租日 (假設每月1號)
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    DOM.nextPayment.textContent = formatDate(nextMonth.toISOString().split('T')[0]);
    
    // 載入銀行資訊
    await loadBankInfo();
    
    // 載入繳費記錄
    await loadPaymentRecords();
    
    // 載入已上傳的圖片
    await loadUploadedImages();
    
    // 綁定事件
    bindEvents();
}

// 載入銀行資訊
async function loadBankInfo() {
    try {
        const data = await api.bankApi.getBankInfo();
        if (data.success && data.bankInfo) {
            const bank = data.bankInfo;
            DOM.bankName.textContent = bank.bank_name;
            DOM.branchName.textContent = bank.branch_name;
            DOM.accountName.textContent = bank.account_name;
            DOM.accountNumber.textContent = formatAccountNumber(bank.account_number);
            DOM.lastUpdated.textContent = formatDateTime(bank.updated_at);
        }
    } catch (error) {
        console.error('載入銀行資訊失敗:', error);
    }
}

// 載入繳費記錄
async function loadPaymentRecords() {
    try {
        const data = await api.paymentApi.getPayments();
        DOM.paymentTableBody.innerHTML = '';
        DOM.recentPayments.innerHTML = '';
        
        if (data.success && data.payments && data.payments.length > 0) {
            // 顯示最近的5筆記錄在儀表板
            const recent = data.payments.slice(0, 5);
            recent.forEach(payment => {
                DOM.recentPayments.appendChild(createPaymentCard(payment));
            });
            
            // 顯示所有記錄在繳費記錄頁面
            data.payments.forEach(payment => {
                DOM.paymentTableBody.appendChild(createPaymentRow(payment));
            });
        } else {
            DOM.recentPayments.innerHTML = '<p class="empty-state">暫無繳費記錄</p>';
            DOM.paymentTableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center" style="padding: 40px;">
                        <p class="empty-state">暫無繳費記錄</p>
                    </td>
                </tr>
            `;
        }
    } catch (error) {
        console.error('載入繳費記錄失敗:', error);
    }
}

// 建立繳費記錄卡片
function createPaymentCard(payment) {
    const div = document.createElement('div');
    div.className = 'payment-card';
    div.innerHTML = `
        <div class="payment-card-header">
            <span class="payment-date">${formatDate(payment.payment_date)}</span>
            <span class="payment-status ${payment.status}">${payment.status === 'confirmed' ? '已確認' : '待確認'}</span>
        </div>
        <div class="payment-card-body">
            <div class="payment-amount">NT$ ${Number(payment.total_amount).toLocaleString()}</div>
            <div class="payment-details">
                <span>房租: NT$ ${Number(payment.rent_amount).toLocaleString()}</span>
                <span>水費: NT$ ${Number(payment.water_fee || 0).toLocaleString()}</span>
                <span>電費: NT$ ${Number(payment.electricity_fee || 0).toLocaleString()}</span>
            </div>
        </div>
    `;
    return div;
}

// 建立繳費記錄表格列
function createPaymentRow(payment) {
    const usage = payment.current_meter - payment.previous_meter;
    const electricityFee = usage * payment.electricity_rate;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${formatDate(payment.payment_date)}</td>
        <td>NT$ ${Number(payment.rent_amount).toLocaleString()}</td>
        <td>NT$ ${Number(payment.water_fee || 0).toLocaleString()}</td>
        <td>${Number(payment.electricity_rate).toFixed(2)}</td>
        <td>${payment.previous_meter}</td>
        <td>${payment.current_meter}</td>
        <td>${usage}</td>
        <td>NT$ ${Number(payment.total_amount).toLocaleString()}</td>
        <td>${payment.account_last_five}</td>
        <td>
            <span class="status-badge ${payment.status}">
                ${payment.status === 'confirmed' ? '已確認' : '待確認'}
            </span>
        </td>
    `;
    return tr;
}

// 載入已上傳的圖片
async function loadUploadedImages() {
    try {
        const data = await api.imageApi.getImages();
        DOM.imagesGrid.innerHTML = '';
        
        if (data.success && data.images && data.images.length > 0) {
            data.images.forEach(image => {
                DOM.imagesGrid.appendChild(createImageThumbnail(image));
            });
        } else {
            DOM.imagesGrid.innerHTML = '<p class="empty-state">尚未上傳任何圖片</p>';
        }
    } catch (error) {
        console.error('載入圖片失敗:', error);
    }
}

// 建立圖片縮圖
function createImageThumbnail(image) {
    const div = document.createElement('div');
    div.className = 'image-item';
    div.innerHTML = `
        <img src="${image.image_url}" 
             alt="${image.file_name}" 
             class="image-thumbnail"
             data-image-id="${image.id}"
             data-image-url="${image.image_url}"
             data-file-name="${image.file_name}"
             data-upload-date="${image.uploaded_at}"
             data-file-size="${image.file_size}">
        <div class="image-info">
            <p class="image-name">${image.file_name}</p>
            <p class="image-date">${formatDate(image.uploaded_at)}</p>
        </div>
    `;
    return div;
}

// 綁定事件
function bindEvents() {
    // 選單切換
    DOM.menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // 移除所有 active 類別
            DOM.menuItems.forEach(i => i.classList.remove('active'));
            DOM.contentSections.forEach(section => section.classList.remove('active'));
            
            // 添加 active 類別
            item.classList.add('active');
            
            // 顯示對應的內容區塊
            const targetId = item.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });
    
    // 新增繳費記錄按鈕
    if (DOM.newPaymentBtn) {
        DOM.newPaymentBtn.addEventListener('click', () => {
            if (DOM.paymentModal) {
                DOM.paymentModal.classList.add('active');
            }
        });
    }
    
    // 繳費表單計算邏輯
    Object.values(paymentFormElements).forEach(element => {
        if (element && element.addEventListener) {
            element.addEventListener('input', calculateTotal);
        }
    });
    
    // 提交繳費記錄
    if (DOM.submitPaymentBtn) {
        DOM.submitPaymentBtn.addEventListener('click', submitPayment);
    }
    
    // 圖片上傳相關事件
    if (DOM.selectFilesBtn) {
        DOM.selectFilesBtn.addEventListener('click', () => {
            if (DOM.fileInput) {
                DOM.fileInput.click();
            }
        });
    }
    
    if (DOM.fileInput) {
        DOM.fileInput.addEventListener('change', handleFileSelect);
    }
    
    // 拖曳上傳
    if (DOM.dropZone) {
        DOM.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            DOM.dropZone.classList.add('drag-over');
        });
        
        DOM.dropZone.addEventListener('dragleave', () => {
            DOM.dropZone.classList.remove('drag-over');
        });
        
        DOM.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            DOM.dropZone.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            handleFiles(files);
        });
    }
    
    // 圖片點擊預覽
    if (DOM.imagesGrid) {
        DOM.imagesGrid.addEventListener('click', (e) => {
            const thumbnail = e.target.closest('.image-thumbnail');
            if (thumbnail) {
                showImagePreview(thumbnail);
            }
        });
    }
    
    // 關閉彈跳窗
    DOM.closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (DOM.paymentModal) DOM.paymentModal.classList.remove('active');
            if (DOM.imagePreviewModal) DOM.imagePreviewModal.classList.remove('active');
        });
    });
    
    // 點擊背景關閉彈跳窗
    [DOM.paymentModal, DOM.imagePreviewModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        }
    });
    
    // 登出
    if (DOM.logoutBtn) {
        DOM.logoutBtn.addEventListener('click', () => {
            if (confirm('確定要登出嗎？')) {
                api.userApi.logout();
                window.location.href = 'index.html';
            }
        });
    }
    
    // 設定預設繳費日期為今天
    if (paymentFormElements.paymentDate) {
        const today = new Date().toISOString().split('T')[0];
        paymentFormElements.paymentDate.value = today;
    }
    
    // 設定預設房租為使用者設定的租金
    const user = api.getUserInfo();
    if (user.rent_amount && paymentFormElements.rentAmount) {
        paymentFormElements.rentAmount.value = user.rent_amount;
        calculateTotal();
    }
}

// 計算總金額
function calculateTotal() {
    const rent = parseFloat(paymentFormElements.rentAmount?.value) || 0;
    const water = parseFloat(paymentFormElements.waterFee?.value) || 0;
    const rate = parseFloat(paymentFormElements.electricityRate?.value) || 0;
    const previous = parseInt(paymentFormElements.previousMeter?.value) || 0;
    const current = parseInt(paymentFormElements.currentMeter?.value) || 0;
    
    // 計算用電度數和電費
    const usage = current - previous;
    const electricityFee = usage * rate;
    
    // 更新表單
    if (paymentFormElements.electricityUsage) {
        paymentFormElements.electricityUsage.value = usage > 0 ? usage : 0;
    }
    if (paymentFormElements.electricityFee) {
        paymentFormElements.electricityFee.value = electricityFee > 0 ? electricityFee.toFixed(2) : 0;
    }
    
    // 計算總金額
    const total = rent + water + electricityFee;
    if (paymentFormElements.totalAmount) {
        paymentFormElements.totalAmount.value = total.toFixed(2);
    }
}

// 提交繳費記錄
async function submitPayment() {
    if (!DOM.paymentForm?.checkValidity()) {
        if (DOM.paymentForm) {
            DOM.paymentForm.reportValidity();
        }
        return;
    }
    
    const paymentData = {
        payment_date: paymentFormElements.paymentDate?.value || new Date().toISOString().split('T')[0],
        rent_amount: parseFloat(paymentFormElements.rentAmount?.value) || 0,
        water_fee: parseFloat(paymentFormElements.waterFee?.value) || 0,
        electricity_rate: parseFloat(paymentFormElements.electricityRate?.value) || 0,
        previous_meter: parseInt(paymentFormElements.previousMeter?.value) || 0,
        current_meter: parseInt(paymentFormElements.currentMeter?.value) || 0,
        total_amount: parseFloat(paymentFormElements.totalAmount?.value) || 0,
        account_last_five: document.getElementById('accountLastFive')?.value || ''
    };
    
    try {
        DOM.submitPaymentBtn.disabled = true;
        DOM.submitPaymentBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 提交中...';
        
        const data = await api.paymentApi.createPayment(paymentData);
        
        if (data.success) {
            alert('繳費記錄已提交，請等待管理員確認。');
            DOM.paymentModal.classList.remove('active');
            if (DOM.paymentForm) {
                DOM.paymentForm.reset();
            }
            
            // 重新載入繳費記錄
            await loadPaymentRecords();
        } else {
            alert('提交失敗：' + data.message);
        }
    } catch (error) {
        console.error('提交繳費記錄失敗:', error);
        alert('提交繳費記錄時發生錯誤');
    } finally {
        DOM.submitPaymentBtn.disabled = false;
        DOM.submitPaymentBtn.innerHTML = '提交繳費記錄';
    }
}

// 處理檔案選擇
function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
}

// 處理檔案上傳
async function handleFiles(files) {
    if (!files || files.length === 0) return;
    
    // 檢查檔案大小和類型
    for (const file of files) {
        if (!file.type.startsWith('image/')) {
            alert(`檔案 ${file.name} 不是圖片格式`);
            continue;
        }
        
        if (file.size > 10 * 1024 * 1024) { // 10MB
            alert(`檔案 ${file.name} 超過 10MB 大小限制`);
            continue;
        }
        
        await uploadFile(file);
    }
    
    // 清空 input
    if (DOM.fileInput) {
        DOM.fileInput.value = '';
    }
}

// 上傳檔案到 Cloudflare R2
async function uploadFile(file) {
    try {
        // 顯示上傳進度
        if (DOM.uploadProgress) {
            DOM.uploadProgress.style.display = 'block';
        }
        if (DOM.progressFill) {
            DOM.progressFill.style.width = '0%';
        }
        if (DOM.progressText) {
            DOM.progressText.textContent = `準備上傳 ${file.name}...`;
        }
        
        // 取得上傳 URL
        const urlData = await api.imageApi.getUploadUrl();
        if (!urlData.success || !urlData.uploadUrl) {
            throw new Error('無法取得上傳 URL');
        }
        
        // 使用 fetch 上傳檔案到 Cloudflare R2
        const response = await fetch(urlData.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: {
                'Content-Type': file.type
            }
        });
        
        if (!response.ok) {
            throw new Error(`上傳失敗: ${response.statusText}`);
        }
        
        // 取得圖片 URL
        const imageUrl = urlData.publicUrl || response.url;
        
        // 在資料庫中記錄圖片資訊
        const saveData = await api.imageApi.saveImageInfo({
            image_url: imageUrl,
            file_name: file.name,
            file_size: file.size
        });
        
        if (saveData.success) {
            if (DOM.progressFill) {
                DOM.progressFill.style.width = '100%';
            }
            if (DOM.progressText) {
                DOM.progressText.textContent = `${file.name} 上傳成功！`;
            }
            
            // 重新載入圖片列表
            setTimeout(() => {
                loadUploadedImages();
                if (DOM.uploadProgress) {
                    DOM.uploadProgress.style.display = 'none';
                }
            }, 1000);
        } else {
            throw new Error('儲存圖片資訊失敗');
        }
        
    } catch (error) {
        console.error('上傳失敗:', error);
        if (DOM.progressText) {
            DOM.progressText.textContent = `${file.name} 上傳失敗: ${error.message}`;
        }
        if (DOM.progressFill) {
            DOM.progressFill.style.background = 'var(--danger)';
        }
        
        setTimeout(() => {
            if (DOM.uploadProgress) {
                DOM.uploadProgress.style.display = 'none';
            }
            if (DOM.progressFill) {
                DOM.progressFill.style.background = '';
            }
        }, 3000);
    }
}

// 顯示圖片預覽
function showImagePreview(thumbnail) {
    const imageUrl = thumbnail.getAttribute('data-image-url');
    const fileName = thumbnail.getAttribute('data-file-name');
    const uploadDate = thumbnail.getAttribute('data-upload-date');
    const fileSize = thumbnail.getAttribute('data-file-size');
    
    if (DOM.previewImage) DOM.previewImage.src = imageUrl;
    if (DOM.imagePreviewTitle) DOM.imagePreviewTitle.textContent = fileName;
    if (DOM.imageFileName) DOM.imageFileName.textContent = `檔案名稱: ${fileName}`;
    if (DOM.imageUploadDate) DOM.imageUploadDate.textContent = `上傳時間: ${formatDateTime(uploadDate)}`;
    if (DOM.imageFileSize) DOM.imageFileSize.textContent = `檔案大小: ${formatFileSize(fileSize)}`;
    if (DOM.downloadImageBtn) {
        DOM.downloadImageBtn.href = imageUrl;
        DOM.downloadImageBtn.download = fileName;
    }
    
    if (DOM.imagePreviewModal) {
        DOM.imagePreviewModal.classList.add('active');
    }
}

// 工具函數
function formatDate(dateString) {
    if (!dateString) return '--';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '--';
    const date = new Date(dateTimeString);
    return date.toLocaleString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatAccountNumber(account) {
    if (!account) return '--';
    // 每4位加一個分隔符
    return account.replace(/(\d{4})(?=\d)/g, '$1-');
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// 頁面載入時初始化
document.addEventListener('DOMContentLoaded', init);