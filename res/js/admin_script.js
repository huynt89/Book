/* ===============================================
// CẤU HÌNH GITHUB
// =============================================== */
const GITHUB_CONFIG = {
    // ⚠️ ĐIỀN CHÍNH XÁC THÔNG TIN REPO CỦA BẠN ⚠️
    OWNER: 'huynt89',
    REPO: 'Book',
    FILE_PATH: 'comic_data.js',
    API_URL: (owner, repo, path) => `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    TOKEN_FILE_PATH: 'token', 
};

// ===============================================
// BIẾN TOÀN CỤC & KHỞI TẠO (INIT)
// ===============================================
let currentComicData = []; 
let currentSha = '';       
let isEditMode = false;    
const LOG = document.getElementById('log');

document.addEventListener('DOMContentLoaded', initAdminApp);

function initAdminApp() {
    // 1. Tải danh sách truyện ngay lập tức (không cần xác nhận Token)
    loadComicDataAndPopulateList();
    
    // 2. Kích hoạt tất cả listeners
    setupMainListeners();
    document.getElementById('githubToken').addEventListener('input', handleTokenInput);

    appendLog('Ứng dụng đã sẵn sàng. Dữ liệu truyện đang được tải. Vui lòng nhập Token khi muốn Lưu/Upload.');
    
    // Khởi tạo trạng thái giao diện
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('managementBar').style.display = 'flex';
}

function setupMainListeners() {
    document.getElementById('comicSelector').addEventListener('change', handleComicSelect);
    document.getElementById('addNewBtn').addEventListener('click', clearForm);
    document.getElementById('saveComicBtn').addEventListener('click', updateComicData);
    document.getElementById('uploadCoverBtn').addEventListener('click', uploadCoverImage);
    document.getElementById('uploadChapterBtn').addEventListener('click', uploadChapterImages);
}

// ===============================================
// CÁC HÀM HỖ TRỢ CHUNG
// ===============================================

function appendLog(message, isError = false) {
    const timestamp = new Date().toLocaleTimeString('vi-VN');
    const prefix = isError ? '❌ LỖI: ' : '✅ ';
    LOG.textContent = `[${timestamp}] ${prefix}${message}\n` + LOG.textContent;
}

function getHeaders(token) {
    return {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    };
}

function formatComicData(comicArray) {
    // Hàm này không còn cần thiết trong JS vì việc định dạng đã chuyển sang GitHub Actions
    // Nhưng ta giữ lại để đảm bảo logic sắp xếp dữ liệu local trước khi commit temp_data.json
    comicArray.sort((a, b) => a.title.localeCompare(b.title)); 
    
    // Trả về JSON thuần để Actions có thể xử lý
    return JSON.stringify(comicArray, null, 4);
}

// ===============================================
// LOGIC TOKEN VÀ TẢI DỮ LIỆU
// ===============================================

async function fetchTokenFile(key) {
    // Lấy Token từ file public
    try {
        const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, GITHUB_CONFIG.TOKEN_FILE_PATH);
        const response = await fetch(apiUrl);
        // ... (Logic giải mã và trích xuất Token) ...
        if (!response.ok) { throw new Error("Không thể tải file 'token'."); }
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
        appendLog(`Lỗi khi tải file token: ${error.message}`, true);
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
            appendLog(`Token cho "${input}" đã được tải thành công.`, false);
        } else {
            e.target.value = '';
            appendLog(`Không tìm thấy Token cho "${input}".`, true);
        }
    }
}

async function loadComicDataAndPopulateList() {
    // Tải file comic_data.js qua đường dẫn công khai (không cần Token/Headers)
    const fileUrl = `${window.location.origin}/${GITHUB_CONFIG.FILE_PATH}`;
    const selector = document.getElementById('comicSelector');
    selector.innerHTML = '<option value="">-- Đang tải danh sách --</option>';

    try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error(`Không thể tải file comic_data.js qua đường dẫn công khai. Status: ${response.status}`);
        }
        
        const content = await response.text();
        
        // Trích xuất nội dung JSON từ chuỗi JS
        const match = content.match(/const COMIC_DATA_JSON = (\[[\s\S]*?\]);/);
        if (!match) {
            throw new Error("Không tìm thấy mảng COMIC_DATA_JSON trong file.");
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

        appendLog(`Đã tải và hiển thị ${currentComicData.length} truyện trong List Box.`, false);

    } catch (error) {
        selector.innerHTML = '<option value="">-- Lỗi tải truyện --</option>';
        appendLog(`Lỗi tải dữ liệu truyện: ${error.message}. Kiểm tra Console (F12) để biết chi tiết.`, true);
    }
}

function handleComicSelect(e) {
    const index = e.target.value;
    if (index === "") { clearForm(); return; }
    
    const comic = currentComicData[parseInt(index)];
    
    isEditMode = true;
    document.getElementById('comicTitle').value = comic.title;
    document.getElementById('comicFolder').value = comic.folder;
    document.getElementById('comicDescription').value = comic.description;
    document.getElementById('comicCover').value = comic.cover;
    appendLog(`Đã tải thông tin truyện "${comic.title}" vào form (CHỈNH SỬA).`);
}

function clearForm() {
    isEditMode = false;
    document.getElementById('comicSelector').value = "";
    document.getElementById('comicTitle').value = "";
    document.getElementById('comicFolder').value = "";
    document.getElementById('comicDescription').value = "";
    document.getElementById('comicCover').value = "";
    document.getElementById('chapterInput').value = "";
    appendLog('Đã xóa form, sẵn sàng cho truyện mới (THÊM MỚI).');
}

// ===============================================
// LOGIC COMMIT (TẠO FILE TẠM)
// ===============================================

async function updateComicData() {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) {
        appendLog('Vui lòng nhập Token có quyền `repo` để thực hiện COMMIT TẠM.', true);
        return;
    }
    
    // ... (Logic thu thập form và cập nhật mảng currentComicData giữ nguyên) ...
    const title = document.getElementById('comicTitle').value.trim();
    const folder = document.getElementById('comicFolder').value.trim();
    const description = document.getElementById('comicDescription').value.trim();
    const cover = document.getElementById('comicCover').value.trim();

    if (!title || !folder || !description || !cover) {
        appendLog('Vui lòng điền đầy đủ thông tin truyện.', true);
        return;
    }

    const newComic = {
        title,
        folder,
        upload_date: isEditMode ? currentComicData.find(c => c.folder === folder)?.upload_date || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        description,
        cover
    };

    const isExistingIndex = currentComicData.findIndex(c => c.folder === folder);
    
    if (isEditMode && isExistingIndex !== -1) {
        currentComicData[isExistingIndex] = newComic;
        appendLog(`Đã cập nhật thông tin truyện "${title}".`);
    } else if (isExistingIndex === -1) {
        currentComicData.push(newComic);
        appendLog(`Đã thêm truyện mới "${title}".`);
        clearForm();
    } else {
        appendLog(`Folder "${folder}" đã tồn tại. Vui lòng chọn truyện đó để chỉnh sửa.`, true);
        return;
    }

    // 2. CHUẨN BỊ COMMIT VÀO FILE TẠM THỜI (temp_data.json)
    const fileContent = formatComicData(currentComicData); // Dữ liệu JSON thuần
    const newContentBase64 = btoa(unescape(encodeURIComponent(fileContent)));

    const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'temp_data.json');
    
    try {
        // Lấy SHA của file temp_data.json nếu nó tồn tại
        let sha = null;
        try {
            const getResponse = await fetch(apiUrl, { headers: getHeaders(token) });
            if (getResponse.ok) {
                const existingFile = await getResponse.json();
                sha = existingFile.sha;
            }
        } catch (e) { /* file chưa tồn tại */ }

        const commitData = {
            message: `chore: Tạo file temp_data.json để kích hoạt Action (${title})`,
            content: newContentBase64,
            sha: sha
        };
        
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: getHeaders(token),
            body: JSON.stringify(commitData)
        });

        if (!response.ok) { throw new Error(`Đẩy file tạm thời thất bại. Status: ${response.status}`); }
        
        appendLog(`\n🎉 Đã tạo/cập nhật file temp_data.json thành công!`, false);
        appendLog(`Vui lòng chờ 10-20 giây để GitHub Actions tự động cập nhật comic_data.js.`, false);
        
    } catch (error) {
        appendLog(`Lỗi API khi CẬP NHẬT FILE TẠM THỜI: ${error.message}`, true);
    }
}

// ===============================================
// LOGIC UPLOAD FILE (Giữ nguyên)
// ===============================================

async function uploadFileToGithub(token, fullFilePath, base64Content, commitMessage) {
    const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, fullFilePath);
    
    const commitData = {
        message: commitMessage,
        content: base64Content,
    };
    
    const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: getHeaders(token),
        body: JSON.stringify(commitData)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Status ${response.status}: ${errorText}`);
    }
    
    return response.json();
}

async function uploadCoverImage() {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) { appendLog('Vui lòng nhập Token để upload ảnh.', true); return; }

    const coverFileName = document.getElementById('comicCover').value.trim();
    const fileInput = document.getElementById('coverFileInput');
    
    if (!coverFileName) { appendLog('Vui lòng điền Tên File Ảnh Bìa.', true); return; }
    if (fileInput.files.length === 0) { appendLog('Vui lòng chọn một file ảnh bìa.', true); return; }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function() {
        const base64Content = reader.result.split(',')[1];
        const fullFilePath = `cover/${coverFileName}`; 
        
        appendLog(`Đang tải lên Ảnh Bìa: ${coverFileName}...`);

        try {
            await uploadFileToGithub(token, fullFilePath, base64Content, `feat: Upload ảnh bìa: ${coverFileName}`);
            appendLog(`Tải lên Ảnh Bìa thành công vào: ${fullFilePath}`, false);
        } catch (error) {
            appendLog(`Lỗi tải lên Ảnh Bìa: ${error.message}`, true);
        }
    };

    reader.readAsDataURL(file);
}

async function uploadChapterImages() {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) { appendLog('Vui lòng nhập Token để upload ảnh.', true); return; }

    const comicFolder = document.getElementById('comicFolder').value.trim();
    const chapterName = document.getElementById('chapterInput').value.trim();
    const fileInput = document.getElementById('chapterFileInput');

    if (!comicFolder) { appendLog('Vui lòng điền Tên Thư Mục (Folder) truyện.', true); return; }
    if (!chapterName) { appendLog('Vui lòng điền Tên Chapter Mới.', true); return; }
    if (fileInput.files.length === 0) { appendLog('Vui lòng chọn ít nhất một file ảnh chapter.', true); return; }

    const files = Array.from(fileInput.files).sort((a, b) => a.name.localeCompare(b.name));
    let successCount = 0;
    let failCount = 0;
    
    appendLog(`Bắt đầu tải lên ${files.length} ảnh vào thư mục: Comic/${comicFolder}/${chapterName}/...`);

    for (const file of files) {
        const reader = new FileReader();
        const fullFilePath = `Comic/${comicFolder}/${chapterName}/${file.name}`;

        const uploadPromise = new Promise((resolve) => {
            reader.onload = async function() {
                const base64Content = reader.result.split(',')[1];
                
                try {
                    await uploadFileToGithub(token, fullFilePath, base64Content, `feat: Thêm ảnh ${file.name} vào chương ${chapterName}`);
                    appendLog(`Tải lên thành công: ${file.name}`);
                    successCount++;
                    resolve();
                } catch (error) {
                    appendLog(`Lỗi tải lên file ${file.name}: ${error.message}`, true);
                    failCount++;
                    resolve();
                }
            };
            reader.readAsDataURL(file);
        });

        await uploadPromise;
    }

    appendLog(`\n--- KẾT QUẢ UPLOAD CHAPTER ---`, false);
    appendLog(`Hoàn thành. ${successCount} file thành công, ${failCount} file thất bại.`, false);
}