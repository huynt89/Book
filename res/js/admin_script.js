/* ===============================================
// CẤU HÌNH GITHUB
// =============================================== */
const GITHUB_CONFIG = {
    OWNER: 'huynt89',
    REPO: 'Book',
    FILE_PATH: 'comic_data.js',
    API_URL: (owner, repo, path) => `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    // ⚠️ LƯU Ý BẢO MẬT: BẠN PHẢI THAY THẾ CHUỖI NÀY BẰNG TOKEN CỦA MÌNH
    // CHỈ DÙNG CHO MỤC ĐÍCH TIỆN LỢI. CÁCH AN TOÀN HƠN LÀ KHÔNG LƯU Ở ĐÂY.
    PRECONFIGURED_TOKEN: 'PASTE_YOUR_LONG_LIVED_PAT_TOKEN_HERE' 
};

// ===============================================
// BIẾN TOÀN CỤC & INIT
// ===============================================
let currentComicData = [];
let currentSha = '';
let isEditMode = false;
const LOG = document.getElementById('log');

document.addEventListener('DOMContentLoaded', initAdminApp);

function initAdminApp() {
    // 1. Tải dữ liệu truyện và điền vào list box
    loadComicDataAndPopulateList();

    // 2. Thiết lập Listener cho UI
    document.getElementById('githubToken').addEventListener('input', handleTokenInput);
    document.getElementById('comicSelector').addEventListener('change', handleComicSelect);
    document.getElementById('addNewBtn').addEventListener('click', clearForm);
    document.getElementById('saveComicBtn').addEventListener('click', updateComicData);
    document.getElementById('uploadCoverBtn').addEventListener('click', uploadCoverImage);
    document.getElementById('uploadChapterBtn').addEventListener('click', uploadChapterImages);
    
    appendLog('Ứng dụng đã sẵn sàng. Vui lòng nhập Token.');
}

// ===============================================
// HÀM HỖ TRỢ CHUNG
// ===============================================
function appendLog(message, isError = false) {
    const timestamp = new Date().toLocaleTimeString('vi-VN');
    const color = isError ? 'color: #e74c3c;' : 'color: #2ecc71;';
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
 * Hàm định dạng lại mảng JSON thành chuỗi JavaScript hợp lệ
 */
function formatComicData(comicArray) {
    // Sắp xếp dữ liệu theo Tiêu đề (A-Z)
    comicArray.sort((a, b) => a.title.localeCompare(b.title)); 
    
    const dataString = JSON.stringify(comicArray, null, 4)
        .replace(/"([^"]+)":/g, '$1:')
        .replace(/:/g, ': ')
        .replace(/    /g, '\t');
    
    return `/* ================= CẤU HÌNH TRUYỆN ================= */\n\n// Lưu ý: Đường dẫn ảnh bìa đã được đổi thành thư mục 'cover/' \n// Bạn chỉ cần điền tên file ảnh ở đây (ví dụ: 'YugiOh_cover.jpg')\nconst COMIC_DATA_JSON = ${dataString};\n`;
}

// ===============================================
// LOGIC TOKEN VÀ LIST BOX
// ===============================================

/**
 * Yêu cầu 1: Tự động điền token khi nhập 'huynt' hoặc 'token'
 */
function handleTokenInput(e) {
    const input = e.target.value.toLowerCase();
    if (input === 'huynt' || input === 'token') {
        e.target.value = GITHUB_CONFIG.PRECONFIGURED_TOKEN;
        appendLog('Token đã được điền tự động.');
    }
}

/**
 * Yêu cầu 2: Tải dữ liệu và điền vào List Box
 */
async function loadComicDataAndPopulateList() {
    const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, GITHUB_CONFIG.FILE_PATH);
    const selector = document.getElementById('comicSelector');
    
    // Tải comic_data.js (Không cần token vì đây là file công khai)
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Không thể tải file comic_data.js. Status: ${response.status}`);
        }
        const fileContent = await response.json();
        currentSha = fileContent.sha; 
        
        const contentBase64 = fileContent.content.replace(/\n/g, '');
        const content = atob(contentBase64);
        
        const match = content.match(/const COMIC_DATA_JSON = (\[[\s\S]*?\]);/);
        if (!match) {
            throw new Error("Không tìm thấy mảng COMIC_DATA_JSON trong file.");
        }
        
        // Dùng eval an toàn để parse chuỗi JS thành mảng JSON
        eval(`currentComicData = ${match[1]}`); 
        
        // Sắp xếp dữ liệu theo Tiêu đề (A-Z)
        currentComicData.sort((a, b) => a.title.localeCompare(b.title));

        // Xóa tùy chọn cũ và thêm tùy chọn mới
        selector.innerHTML = '<option value="">-- Chọn Truyện --</option>';
        currentComicData.forEach((comic, index) => {
            const opt = document.createElement('option');
            opt.value = index; // Sử dụng index để tra cứu dễ hơn
            opt.textContent = comic.title;
            selector.appendChild(opt);
        });

        appendLog(`Đã tải ${currentComicData.length} truyện và điền vào List Box.`);

    } catch (error) {
        selector.innerHTML = '<option value="">-- Lỗi tải truyện --</option>';
        appendLog(`Lỗi tải dữ liệu truyện: ${error.message}`, true);
    }
}

/**
 * Yêu cầu 3: Tải thông tin vào form khi chọn truyện
 */
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
    appendLog(`Đã tải thông tin truyện "${comic.title}" vào form (Chế độ CHỈNH SỬA).`);
}

/**
 * Yêu cầu 4: Xóa form khi bấm 'Thêm mới'
 */
function clearForm() {
    isEditMode = false;
    document.getElementById('comicSelector').value = "";
    document.getElementById('comicTitle').value = "";
    document.getElementById('comicFolder').value = "";
    document.getElementById('comicDescription').value = "";
    document.getElementById('comicCover').value = "";
    document.getElementById('chapterInput').value = "";
    appendLog('Đã xóa form, sẵn sàng cho truyện mới (Chế độ THÊM MỚI).');
}


// ===============================================
// LOGIC LƯU DỮ LIỆU JSON
// ===============================================

async function updateComicData() {
    const token = document.getElementById('githubToken').value.trim();
    if (!token) {
        appendLog('Vui lòng nhập GitHub Token.', true);
        return;
    }

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
        // Giữ nguyên ngày nếu chỉnh sửa, lấy ngày mới nếu thêm mới
        upload_date: isEditMode ? currentComicData.find(c => c.folder === folder)?.upload_date || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        description,
        cover
    };

    const isExisting = currentComicData.findIndex(c => c.folder === folder);
    
    if (isEditMode && isExisting !== -1) {
        // Chỉnh sửa truyện cũ
        currentComicData[isExisting] = newComic;
        appendLog(`Đã cập nhật thông tin cho truyện "${title}" trong bộ nhớ.`);
    } else if (isExisting === -1) {
        // Thêm truyện mới
        currentComicData.push(newComic);
        appendLog(`Đã thêm truyện mới "${title}" vào bộ nhớ.`);
        clearForm(); // Xóa form sau khi thêm để tránh trùng lặp
    } else {
        appendLog(`Folder "${folder}" đã tồn tại. Vui lòng chọn truyện đó để chỉnh sửa hoặc thay đổi tên folder.`, true);
        return;
    }

    // Tiến hành đẩy file lên GitHub
    try {
        const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, GITHUB_CONFIG.FILE_PATH);
        const newContentString = formatComicData(currentComicData);
        const newContentBase64 = btoa(unescape(encodeURIComponent(newContentString))); 

        const commitData = {
            message: `feat: Cập nhật comic_data.js (${isEditMode ? 'Chỉnh sửa' : 'Thêm mới'}: ${title})`,
            content: newContentBase64,
            sha: currentSha 
        };
        
        const response = await fetch(apiUrl, {
            method: 'PUT',
            headers: getHeaders(token),
            body: JSON.stringify(commitData)
        });

        if (!response.ok) {
             throw new Error(`Đẩy file thất bại. Status: ${response.status}`);
        }
        
        // Tải lại dữ liệu và SHA mới sau khi commit thành công
        await loadComicDataAndPopulateList(); 
        appendLog(`\n🎉 Cập nhật file comic_data.js thành công!`, false);

    } catch (error) {
        appendLog(`Lỗi API khi CẬP NHẬT JSON: ${error.message}`, true);
    }
}

// ===============================================
// LOGIC UPLOAD FILE (YÊU CẦU 5 & 6)
// ===============================================

/**
 * Hàm chung để upload một file
 */
async function uploadFileToGithub(token, fullFilePath, base64Content, commitMessage) {
    const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, fullFilePath);

    // Để upload file mới, SHA không cần thiết.
    // Nếu muốn đảm bảo không ghi đè, cần gọi GET trước để lấy SHA, nhưng ta sẽ chấp nhận ghi đè.
    
    const commitData = {
        message: commitMessage,
        content: base64Content,
        // Không cần SHA khi tạo file mới hoặc không quan tâm đến ghi đè
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

/**
 * Xử lý Tải lên Ảnh Bìa (Yêu cầu 5)
 */
async function uploadCoverImage() {
    const token = document.getElementById('githubToken').value.trim();
    const coverFileName = document.getElementById('comicCover').value.trim();
    const fileInput = document.getElementById('coverFileInput');
    
    if (!token) { appendLog('Vui lòng nhập GitHub Token.', true); return; }
    if (!coverFileName) { appendLog('Vui lòng điền Tên File Ảnh Bìa.', true); return; }
    if (fileInput.files.length === 0) { appendLog('Vui lòng chọn một file ảnh bìa.', true); return; }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function() {
        // Lấy nội dung Base64 (sau dấu 'base64,')
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

/**
 * Xử lý Tải lên Ảnh Chương (Yêu cầu 6)
 */
async function uploadChapterImages() {
    const token = document.getElementById('githubToken').value.trim();
    const comicFolder = document.getElementById('comicFolder').value.trim();
    const chapterName = document.getElementById('chapterInput').value.trim();
    const fileInput = document.getElementById('chapterFileInput');

    if (!token) { appendLog('Vui lòng nhập GitHub Token.', true); return; }
    if (!comicFolder) { appendLog('Vui lòng điền Tên Thư Mục (Folder) truyện.', true); return; }
    if (!chapterName) { appendLog('Vui lòng điền Tên Chapter Mới.', true); return; }
    if (fileInput.files.length === 0) { appendLog('Vui lòng chọn ít nhất một file ảnh chapter.', true); return; }

    const files = Array.from(fileInput.files).sort((a, b) => a.name.localeCompare(b.name));
    let successCount = 0;
    let failCount = 0;
    
    for (const file of files) {
        const reader = new FileReader();
        const fullFilePath = `Comic/${comicFolder}/${chapterName}/${file.name}`;

        // Hàm được gọi khi FileReader đọc xong file
        const uploadPromise = new Promise((resolve) => {
            reader.onload = async function() {
                const base64Content = reader.result.split(',')[1];
                
                try {
                    await uploadFileToGithub(token, fullFilePath, base64Content, `feat: Thêm ảnh ${file.name} vào chương ${comicFolder}/${chapterName}`);
                    appendLog(`Tải lên thành công: ${file.name}`);
                    successCount++;
                    resolve();
                } catch (error) {
                    appendLog(`Lỗi tải lên file ${file.name}: ${error.message}`, true);
                    failCount++;
                    resolve(); // Phải resolve để vòng lặp tiếp tục
                }
            };
            reader.readAsDataURL(file);
        });

        await uploadPromise;
    }

    appendLog(`\n--- KẾT QUẢ UPLOAD CHAPTER ---`, false);
    appendLog(`Hoàn thành. ${successCount} file thành công, ${failCount} file thất bại.`, false);
}