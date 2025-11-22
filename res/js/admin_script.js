/* ===============================================
// CẤU HÌNH GITHUB (THÊM TOKEN FILE)
// =============================================== */
const GITHUB_CONFIG = {
    OWNER: 'huynt89',
    REPO: 'Book',
    FILE_PATH: 'comic_data.js',
    API_URL: (owner, repo, path) => `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    TOKEN_FILE_PATH: 'token', // Tên file chứa token
};

// ===============================================
// BIẾN TOÀN CỤC & INIT (GIỮ NGUYÊN)
// ===============================================
let currentComicData = [];
let currentSha = '';
let isEditMode = false;
const LOG = document.getElementById('log');

document.addEventListener('DOMContentLoaded', initAdminApp);

function initAdminApp() {
    loadComicDataAndPopulateList();
    document.getElementById('githubToken').addEventListener('input', handleTokenInput);
    document.getElementById('comicSelector').addEventListener('change', handleComicSelect);
    document.getElementById('addNewBtn').addEventListener('click', clearForm);
    document.getElementById('saveComicBtn').addEventListener('click', updateComicData);
    document.getElementById('uploadCoverBtn').addEventListener('click', uploadCoverImage);
    document.getElementById('uploadChapterBtn').addEventListener('click', uploadChapterImages);
    
    appendLog('Ứng dụng đã sẵn sàng. Vui lòng nhập Token.');
}

// ... (Các hàm appendLog, getHeaders, formatComicData giữ nguyên) ...

// ===============================================
// LOGIC TOKEN MỚI
// ===============================================

/**
 * Hàm mới: Tải file token và trích xuất token cho key (huynt/phongnt)
 */
async function fetchTokenFile(key) {
    try {
        const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, GITHUB_CONFIG.TOKEN_FILE_PATH);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error("Không thể tải file 'token'. Kiểm tra tên file.");
        }
        
        const fileContent = await response.json();
        const contentBase64 = fileContent.content.replace(/\n/g, '');
        const content = atob(contentBase64); // Giải mã Base64
        
        // Phân tích nội dung file: VD: huynt=ghp_xyz
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmedLine = line.trim();
            // Kiểm tra xem dòng có bắt đầu bằng key và dấu "=" không
            if (trimmedLine.startsWith(key + '=')) {
                return trimmedLine.substring(key.length + 1).trim();
            }
        }
        
        return null; // Không tìm thấy key
    } catch (error) {
        appendLog(`Lỗi khi tải hoặc phân tích file token: ${error.message}`, true);
        return null;
    }
}

/**
 * Xử lý nhập Token: Tự động điền khi gõ 'huynt' hoặc 'phongnt'
 */
async function handleTokenInput(e) {
    const input = e.target.value.toLowerCase();
    
    // Chỉ xử lý khi nhập chính xác 'huynt' hoặc 'phongnt'
    if (input === 'huynt' || input === 'phongnt') {
        appendLog(`Đang tìm kiếm Token cho "${input}" trong file "token"...`);
        
        // Reset input để tránh hiển thị tên người dùng nếu quá trình tải thất bại
        e.target.value = 'Đang tải...'; 
        
        const tokenValue = await fetchTokenFile(input);
        
        if (tokenValue) {
            e.target.value = tokenValue; // Điền Token
            appendLog(`Token cho "${input}" đã được tải thành công.`);
        } else {
            e.target.value = ''; // Xóa input nếu thất bại
            appendLog(`Không tìm thấy Token cho "${input}" trong file "token". Vui lòng kiểm tra file.`, true);
        }
    }
}

// ... (Các hàm loadComicDataAndPopulateList, handleComicSelect, clearForm, updateComicData, uploadCoverImage, uploadChapterImages giữ nguyên logic như bản trước) ...