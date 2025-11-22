/* ===============================================
// CẤU HÌNH GITHUB
// =============================================== */
const GITHUB_CONFIG = {
    OWNER: 'huynt89',
    REPO: 'Book',
    FILE_PATH: 'comic_data.js',
    API_URL: (owner, repo, path) => `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    TOKEN_FILE_PATH: 'token', 
};

// ===============================================
// BIẾN TOÀN CỤC & INIT
// ===============================================
let currentComicData = [];
let currentSha = '';
let isEditMode = false;
let currentToken = ''; // Biến lưu Token đã xác nhận
const LOG = document.getElementById('log');

document.addEventListener('DOMContentLoaded', initAdminApp);

function initAdminApp() {
    // Chỉ lắng nghe sự kiện nhập và nút xác nhận Token
    document.getElementById('githubToken').addEventListener('input', handleTokenInput);
    document.getElementById('confirmTokenBtn').addEventListener('click', confirmTokenAndLoadData);
    
    // Các listeners khác sẽ được kích hoạt sau khi Token thành công
    
    appendLog('Ứng dụng đã sẵn sàng. Vui lòng nhập Token và bấm Xác nhận.');
}

// ... (Các hàm appendLog, getHeaders, formatComicData giữ nguyên) ...

// ===============================================
// HÀM TẢI TOKEN VÀ XÁC NHẬN
// ===============================================

async function fetchTokenFile(key) {
    // Logic tải Token từ file 'token' (giữ nguyên)
    try {
        const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, GITHUB_CONFIG.TOKEN_FILE_PATH);
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error("Không thể tải file 'token'.");
        }
        
        const fileContent = await response.json();
        const contentBase64 = fileContent.content.replace(/\n/g, '');
        const content = atob(contentBase64);
        
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith(key + '=')) {
                return trimmedLine.substring(key.length + 1).trim();
            }
        }
        return null;
    } catch (error) {
        appendLog(`Lỗi khi tải hoặc phân tích file token: ${error.message}`, true);
        return null;
    }
}

async function handleTokenInput(e) {
    const input = e.target.value.toLowerCase();
    
    if (input === 'huynt' || input === 'phongnt') {
        appendLog(`Đang tìm kiếm Token cho "${input}" trong file "token"...`);
        e.target.value = 'Đang tải...'; 
        
        const tokenValue = await fetchTokenFile(input);
        
        if (tokenValue) {
            e.target.value = tokenValue;
            appendLog(`Token cho "${input}" đã được tải thành công. Vui lòng bấm Xác nhận Token.`);
        } else {
            e.target.value = '';
            appendLog(`Không tìm thấy Token cho "${input}".`, true);
        }
    }
}


/**
 * Hàm chính: Xác nhận Token và Tải dữ liệu
 */
async function confirmTokenAndLoadData() {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) {
        appendLog('Vui lòng nhập Token trước khi xác nhận.', true);
        return;
    }
    
    // Đặt nút vào trạng thái loading
    const confirmBtn = document.getElementById('confirmTokenBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Đang xác nhận...';
    
    appendLog('Đang kiểm tra quyền truy cập GitHub...');

    // 1. KIỂM TRA TOKEN BẰNG CÁCH TẢI THÔNG TIN REPO
    const repoApiUrl = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}`;

    try {
        const response = await fetch(repoApiUrl, {
            headers: getHeaders(token)
        });

        if (!response.ok) {
            throw new Error(`Token không hợp lệ hoặc không có quyền truy cập. Status: ${response.status}`);
        }

        // 2. TOKEN HỢP LỆ, LƯU TOKEN VÀ TẢI DỮ LIỆU
        currentToken = token;
        appendLog('✅ Xác nhận Token thành công! Đang tải dữ liệu truyện...');
        
        // Bắt đầu tải danh sách truyện và hiển thị giao diện
        await loadComicDataAndPopulateList(); 
        
        document.getElementById('managementBar').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'block';
        
        // Kích hoạt các listeners còn lại
        setupMainListeners();

    } catch (error) {
        currentToken = '';
        appendLog(`❌ Lỗi Xác nhận Token: ${error.message}`, true);
        document.getElementById('githubToken').value = '';
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '🔒 Xác nhận Token';
    }
}

/**
 * Kích hoạt các nút sau khi Token đã được xác nhận
 */
function setupMainListeners() {
    document.getElementById('comicSelector').addEventListener('change', handleComicSelect);
    document.getElementById('addNewBtn').addEventListener('click', clearForm);
    document.getElementById('saveComicBtn').addEventListener('click', updateComicData);
    document.getElementById('uploadCoverBtn').addEventListener('click', uploadCoverImage);
    document.getElementById('uploadChapterBtn').addEventListener('click', uploadChapterImages);
}


// ===============================================
// LOGIC TẢI DỮ LIỆU (ĐÃ SỬA ĐỂ DÙNG currentToken)
// ===============================================

async function loadComicDataAndPopulateList() {
    const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, GITHUB_CONFIG.FILE_PATH);
    const selector = document.getElementById('comicSelector');
    selector.innerHTML = '<option value="">-- Đang tải danh sách --</option>';

    // Dùng currentToken để đảm bảo quyền truy cập vào file
    try {
        const response = await fetch(apiUrl, { 
            headers: getHeaders(currentToken) 
        });

        if (!response.ok) {
            // Đây là lỗi khiến List Box không tải được trước đó. 
            // Nó cần Token để truy cập API ngay cả với file công khai.
            throw new Error(`Không thể tải file comic_data.js. Status: ${response.status}`);
        }
        
        const fileContent = await response.json();
        currentSha = fileContent.sha; 
        
        const contentBase64 = fileContent.content.replace(/\n/g, '');
        const content = atob(contentBase64);
        
        const match = content.match(/const COMIC_DATA_JSON = (\[[\s\S]*?\]);/);
        if (!match) {
            throw new Error("Không tìm thấy mảng COMIC_DATA_JSON.");
        }
        
        eval(`currentComicData = ${match[1]}`); 
        currentComicData.sort((a, b) => a.title.localeCompare(b.title));

        selector.innerHTML = '<option value="">-- Chọn Truyện --</option>';
        currentComicData.forEach((comic, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = comic.title;
            selector.appendChild(opt);
        });

        appendLog(`Đã tải và hiển thị ${currentComicData.length} truyện trong List Box.`);

    } catch (error) {
        selector.innerHTML = '<option value="">-- Lỗi tải truyện --</option>';
        appendLog(`Lỗi tải dữ liệu truyện: ${error.message}. Vui lòng kiểm tra lại Token và quyền repo.`, true);
    }
}

// ... (Các hàm handleComicSelect, clearForm, updateComicData, uploadCoverImage, uploadChapterImages cần được cập nhật để sử dụng currentToken thay vì đọc từ input) ...

// **Cập nhật ngắn cho các hàm lưu/upload:**
// Thay thế dòng `const token = document.getElementById('githubToken').value.trim();`
// bằng `const token = currentToken;` ở đầu mỗi hàm (updateComicData, uploadCoverImage, uploadChapterImages).