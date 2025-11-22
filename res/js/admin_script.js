/* ===============================================
// CẤU HÌNH GITHUB
// =============================================== */
const GITHUB_CONFIG = {
    // ⚠️ BẠN PHẢI ĐIỀN THÔNG TIN CHÍNH XÁC CỦA MÌNH VÀO ĐÂY ⚠️
    OWNER: 'huynt89', // Ví dụ: 'ten_github_cua_ban'
    REPO: 'Book',     // Ví dụ: 'ten_repo_chua_code'
    FILE_PATH: 'comic_data.js',
    API_URL: (owner, repo, path) => `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    TOKEN_FILE_PATH: 'token', // File chứa token cá nhân
};

// ===============================================
// BIẾN TOÀN CỤC & KHỞI TẠO (INIT)
// ===============================================
let currentComicData = []; // Mảng chứa dữ liệu truyện hiện tại
let currentSha = '';       // Mã SHA của file comic_data.js (cần cho việc cập nhật)
let isEditMode = false;    // Chế độ chỉnh sửa (true) hay thêm mới (false)
let currentToken = '';     // Token đã được xác nhận thành công
const LOG = document.getElementById('log');

document.addEventListener('DOMContentLoaded', initAdminApp);

function initAdminApp() {
    // Chỉ lắng nghe sự kiện nhập và nút xác nhận Token ban đầu
    document.getElementById('githubToken').addEventListener('input', handleTokenInput);
    document.getElementById('confirmTokenBtn').addEventListener('click', confirmTokenAndLoadData);
    
    appendLog('Ứng dụng đã sẵn sàng. Vui lòng nhập Token và bấm Xác nhận.');
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

/**
 * Định dạng lại mảng JSON thành chuỗi JavaScript hợp lệ (sắp xếp theo Title A-Z)
 */
function formatComicData(comicArray) {
    comicArray.sort((a, b) => a.title.localeCompare(b.title)); 
    
    const dataString = JSON.stringify(comicArray, null, 4)
        .replace(/"([^"]+)":/g, '$1:')
        .replace(/:/g, ': ')
        .replace(/    /g, '\t');
    
    return `/* ================= CẤU HÌNH TRUYỆN ================= */\n\n// Lưu ý: Đường dẫn ảnh bìa đã được đổi thành thư mục 'cover/' \n// Bạn chỉ cần điền tên file ảnh ở đây (ví dụ: 'YugiOh_cover.jpg')\nconst COMIC_DATA_JSON = ${dataString};\n`;
}

// ===============================================
// LOGIC TOKEN VÀ XÁC NHẬN
// ===============================================

async function fetchTokenFile(key) {
    try {
        const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, GITHUB_CONFIG.TOKEN_FILE_PATH);
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error("Không thể tải file 'token'. Kiểm tra tên file.");
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
            appendLog(`Token cho "${input}" đã được tải thành công. Vui lòng bấm Xác nhận Token.`, false);
        } else {
            e.target.value = '';
            appendLog(`Không tìm thấy Token cho "${input}".`, true);
        }
    }
}

async function confirmTokenAndLoadData() {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) {
        appendLog('Vui lòng nhập Token trước khi xác nhận.', true);
        return;
    }
    
    const confirmBtn = document.getElementById('confirmTokenBtn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Đang xác nhận...';
    
    appendLog('Đang kiểm tra quyền truy cập GitHub...');

    const repoApiUrl = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}`;

    try {
        const headers = getHeaders(token);
        
        // 1. Kiểm tra Token
        const response = await fetch(repoApiUrl, {
            method: 'GET',
            headers: headers
        });

        if (!response.ok) {
            const errorBody = await response.text(); 
            throw new Error(`Token không hợp lệ hoặc không có quyền truy cập. Status: ${response.status}. Chi tiết: ${errorBody.substring(0, 50)}...`);
        }

        // 2. TOKEN HỢP LỆ
        currentToken = token;
        appendLog('✅ Xác nhận Token thành công! Đang tải dữ liệu truyện...');
        
        // 3. Tải danh sách truyện
        await loadComicDataAndPopulateList(); 
        
        // 4. Hiển thị giao diện chính
        document.getElementById('managementBar').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'block';
        
        setupMainListeners();
        document.getElementById('githubToken').disabled = true; // Khóa ô Token đã xác nhận

    } catch (error) {
        currentToken = '';
        appendLog(`❌ Lỗi Xác nhận Token: ${error.message}`, true);
        document.getElementById('githubToken').value = '';
        document.getElementById('githubToken').disabled = false;
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = '🔒 Xác nhận Token';
    }
}

function setupMainListeners() {
    document.getElementById('comicSelector').addEventListener('change', handleComicSelect);
    document.getElementById('addNewBtn').addEventListener('click', clearForm);
    document.getElementById('saveComicBtn').addEventListener('click', updateComicData);
    document.getElementById('uploadCoverBtn').addEventListener('click', uploadCoverImage);
    document.getElementById('uploadChapterBtn').addEventListener('click', uploadChapterImages);
}

// ===============================================
// LOGIC TẢI DỮ LIỆU VÀ CHỈNH SỬA
// ===============================================

async function loadComicDataAndPopulateList() {
    const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, GITHUB_CONFIG.FILE_PATH);
    const selector = document.getElementById('comicSelector');
    selector.innerHTML = '<option value="">-- Đang tải danh sách --</option>';

    try {
        // Sử dụng currentToken để tải file comic_data.js
        const response = await fetch(apiUrl, { 
            headers: getHeaders(currentToken) 
        });

        if (!response.ok) {
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

        appendLog(`Đã tải và hiển thị ${currentComicData.length} truyện trong List Box.`, false);

    } catch (error) {
        selector.innerHTML = '<option value="">-- Lỗi tải truyện --</option>';
        appendLog(`Lỗi tải dữ liệu truyện: ${error.message}. Kiểm tra quyền repo.`, true);
    }
}

function handleComicSelect(e) {
    const index = e.target.value;
    if (index === "") {
        clearForm();
        return;
    }
    
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

async function updateComicData() {
    // ⚠️ LƯU Ý: Không cần kiểm tra Token ở đây nữa!
    
    // 1. Thu thập dữ liệu và cập nhật mảng local (currentComicData)
    // (Giữ nguyên logic kiểm tra và thêm/sửa truyện như bản trước)
    // ... (logic thu thập form và kiểm tra tồn tại) ...
    // ... (Cập nhật currentComicData[isExistingIndex] = newComic hoặc push(newComic)) ...

    const isExistingIndex = currentComicData.findIndex(c => c.folder === folder);
    const title = document.getElementById('comicTitle').value.trim();
    // (Bổ sung code kiểm tra và cập nhật mảng currentComicData như bản trước)
    // ... (Phần này là logic nghiệp vụ) ...

    if (isExistingIndex === -1 && !isEditMode) {
        // Thêm truyện mới
        currentComicData.push(newComic);
        appendLog(`Đã thêm truyện mới "${title}" vào bộ nhớ.`);
        clearForm();
    } else if (isEditMode && isExistingIndex !== -1) {
        // Chỉnh sửa
        currentComicData[isExistingIndex] = newComic;
        appendLog(`Đã cập nhật thông tin cho truyện "${title}" trong bộ nhớ.`);
    } else {
        appendLog(`Lỗi kiểm tra dữ liệu.`, true);
        return;
    }
    
    // 2. CHUẨN BỊ COMMIT VÀO FILE TẠM THỜI (temp_data.json)

    const fileContent = JSON.stringify(currentComicData.sort((a, b) => a.title.localeCompare(b.title)), null, 4);
    const newContentBase64 = btoa(unescape(encodeURIComponent(fileContent)));

    // Cần Token để commit file tạm thời lên GitHub
    const token = currentToken; 
    if (!token) { appendLog('Token chưa được xác nhận để commit file tạm thời.', true); return; }

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
        } catch (e) {
            // Không sao, file chưa tồn tại
        }

        const commitData = {
            message: `chore: Tạo file temp_data.json để kích hoạt Action`,
            content: newContentBase64,
            sha: sha // Ghi đè file nếu nó đã tồn tại
        };
        
        // Đẩy file tạm thời lên GitHub
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: getHeaders(token),
            body: JSON.stringify(commitData)
        });

        if (!response.ok) { throw new Error(`Đẩy file tạm thời thất bại. Status: ${response.status}`); }
        
        appendLog(`\n🎉 Đã tạo/cập nhật file temp_data.json thành công!`, false);
        appendLog(`Vui lòng chờ 10-20 giây để GitHub Actions tự động cập nhật comic_data.js.`, false);
        
        // Cần tải lại dữ liệu sau khi Action hoàn thành (cần cơ chế chờ hoặc tải lại trang)

    } catch (error) {
        appendLog(`Lỗi API khi CẬP NHẬT FILE TẠM THỜI: ${error.message}`, true);
    }
}

// ===============================================
// LOGIC UPLOAD FILE
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
    const token = currentToken;
    if (!token) { appendLog('Token chưa được xác nhận.', true); return; }

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
    const token = currentToken;
    if (!token) { appendLog('Token chưa được xác nhận.', true); return; }

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