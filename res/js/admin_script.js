/* ===============================================
// CẤU HÌNH GITHUB
// =============================================== */
const GITHUB_CONFIG = {
    // ⚠️ ĐIỀN CHÍNH XÁC THÔNG TIN REPO CỦA BẠN ⚠️
    OWNER: 'huynt89',
    REPO: 'Book', 
    FILE_PATH: 'comic_data.js',
    // URL RAW để đọc file (Tránh lỗi Cache/CORS)
    RAW_CONTENT_URL: (owner, repo, path) => `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`,
    // URL API để ghi file
    API_URL: (owner, repo, path) => `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
};

// ===============================================
// BIẾN TOÀN CỤC & KHỞI TẠO (INIT)
// ===============================================
let currentComicData = []; 
let isEditMode = false;    
const LOG = document.getElementById('log');

document.addEventListener('DOMContentLoaded', initAdminApp);

function initAdminApp() {
    loadComicDataAndPopulateList();
    setupMainListeners();

    appendLog('Ứng dụng đã sẵn sàng.', false, true);
    appendLog('Lưu ý: GitHub không lưu thư mục rỗng. Hệ thống sẽ tạo file .gitkeep để giữ thư mục.', false, true);
}

function setupMainListeners() {
    document.getElementById('comicSelector').addEventListener('change', handleComicSelect);
    document.getElementById('addNewBtn').addEventListener('click', clearForm);
    document.getElementById('saveComicBtn').addEventListener('click', updateComicData);
    
    // ✅ Nút mới: Tạo Thư mục Truyện
    document.getElementById('createComicFolderBtn').addEventListener('click', createComicFolder); 
    
    // ✅ Nút mới: Tạo Thư mục Chapter
    document.getElementById('createChapterFolderBtn').addEventListener('click', createChapterFolder);
    
    document.getElementById('uploadCoverBtn').addEventListener('click', uploadCoverImage);
    document.getElementById('uploadChapterBtn').addEventListener('click', uploadChapterImages);
}

// ===============================================
// CÁC HÀM HỖ TRỢ CHUNG
// ===============================================

function appendLog(message, isError = false, prepend = false) {
    const timestamp = new Date().toLocaleTimeString('vi-VN');
    const prefix = isError ? '❌ LỖI: ' : '✅ ';
    const newLogEntry = `[${timestamp}] ${prefix}${message}\n`;
    
    if (prepend) {
        LOG.textContent = newLogEntry + LOG.textContent;
    } else {
        LOG.textContent = LOG.textContent + newLogEntry;
    }
}

function getHeaders() {
    return {
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
        // Lưu ý: Nếu không có Authorization token ở đây,
        // việc GHI (PUT) sẽ thất bại trừ khi bạn dùng GitHub Actions proxy
    };
}

function formatComicData(comicArray) {
    comicArray.sort((a, b) => a.title.localeCompare(b.title)); 
    return JSON.stringify(comicArray, null, 4);
}

// ===============================================
// LOGIC TẢI DỮ LIỆU (READ)
// ===============================================

async function loadComicDataAndPopulateList() {
    // Sử dụng RAW URL để đọc dữ liệu ổn định hơn
    const fileUrl = GITHUB_CONFIG.RAW_CONTENT_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, GITHUB_CONFIG.FILE_PATH);
    const selector = document.getElementById('comicSelector');
    selector.innerHTML = '<option value="">-- Đang tải danh sách --</option>';

    try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error(`Không thể tải file comic_data.js. Status: ${response.status}`);
        }
        
        const content = await response.text();
        const match = content.match(/const COMIC_DATA_JSON = (\[[\s\S]*?\]);/);
        if (!match) { throw new Error("Không tìm thấy mảng COMIC_DATA_JSON trong file."); }
        
        // Parse JSON an toàn hơn eval
        try {
            currentComicData = JSON.parse(match[1]);
        } catch(e) {
            eval(`currentComicData = ${match[1]}`); 
        }
        
        currentComicData.sort((a, b) => a.title.localeCompare(b.title));

        selector.innerHTML = '<option value="">-- Chọn Truyện --</option>';
        currentComicData.forEach((comic, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = comic.title;
            selector.appendChild(opt);
        });

        appendLog(`Đã tải và hiển thị ${currentComicData.length} truyện.`, false);

    } catch (error) {
        selector.innerHTML = '<option value="">-- Lỗi tải truyện --</option>';
        appendLog(`Lỗi tải dữ liệu: ${error.message}.`, true); 
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
    appendLog(`Đang chỉnh sửa: "${comic.title}"`);
}

function clearForm() {
    isEditMode = false;
    document.getElementById('comicSelector').value = "";
    document.getElementById('comicTitle').value = "";
    document.getElementById('comicFolder').value = "";
    document.getElementById('comicDescription').value = "";
    document.getElementById('comicCover').value = "";
    document.getElementById('chapterInput').value = "";
    appendLog('Đã xóa form. Nhập truyện mới.');
}

// ===============================================
// LOGIC GHI FILE (UPLOAD/UPDATE) - ĐÃ GỘP HÀM TRÙNG
// ===============================================

async function uploadFileToGithub(fullFilePath, base64Content, commitMessage) {
    const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, fullFilePath);
    
    // 1. Kiểm tra xem file đã tồn tại chưa để lấy SHA (tránh lỗi 409 Conflict)
    let sha = null;
    try {
        const getResponse = await fetch(apiUrl); 
        if (getResponse.ok) {
            const existingFile = await getResponse.json();
            sha = existingFile.sha;
        }
    } catch (e) { /* File chưa tồn tại, bỏ qua */ }

    // 2. Chuẩn bị dữ liệu commit
    const commitData = {
        message: commitMessage,
        content: base64Content,
        sha: sha // Nếu là file mới, sha sẽ là null, GitHub tự hiểu là tạo mới
    };
    
    // 3. Gửi request PUT
    const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: getHeaders(), 
        body: JSON.stringify(commitData)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Status ${response.status}: ${errorText}. Kiểm tra lại quyền Token.`);
    }
    
    return response.json();
}

// ===============================================
// ✅ TÍNH NĂNG MỚI: TẠO FOLDER
// ===============================================

// Hàm chung để tạo folder (bằng cách tạo file .gitkeep)
async function createFolderGeneric(folderPath, successMessage) {
    // GitHub không hỗ trợ folder rỗng, ta phải tạo 1 file bên trong nó.
    // File .gitkeep là quy ước chung.
    const dummyFilePath = `${folderPath}/.gitkeep`;
    
    // Nội dung file rỗng (đã mã hóa base64)
    const content = btoa(" "); 

    try {
        await uploadFileToGithub(dummyFilePath, content, `feat: Create folder ${folderPath}`);
        appendLog(successMessage, false);
    } catch (error) {
        // Nếu lỗi báo file đã tồn tại (SHA conflict), nghĩa là folder đã có
        if (error.message.includes('sha') || error.message.includes('422')) {
            appendLog(`Thư mục đã tồn tại: ${folderPath}`, false);
        } else {
            appendLog(`Lỗi tạo folder: ${error.message}`, true);
        }
    }
}

// 1. Tạo folder cho Truyện: Comic/[Tên Folder]
async function createComicFolder() {
    const folderName = document.getElementById('comicFolder').value.trim();
    
    if (!folderName) { 
        appendLog('Vui lòng nhập "Tên Thư Mục Truyện" trước.', true); 
        return; 
    }

    // Đường dẫn: Comic/TenTruyen
    const path = `Comic/${folderName}`;
    
    appendLog(`Đang tạo thư mục truyện: ${path}...`);
    await createFolderGeneric(path, `✅ Đã tạo xong thư mục truyện: ${folderName}`);
}

// 2. Tạo folder cho Chapter: Comic/[Tên Truyện]/[Tên Chapter]
async function createChapterFolder() {
    const comicFolder = document.getElementById('comicFolder').value.trim();
    const chapterName = document.getElementById('chapterInput').value.trim();
    
    if (!comicFolder) { appendLog('Chưa có Tên Thư Mục Truyện.', true); return; }
    if (!chapterName) { appendLog('Vui lòng nhập "Tên Chapter Mới".', true); return; }

    // Đường dẫn: Comic/TenTruyen/Chap01
    const path = `Comic/${comicFolder}/${chapterName}`;

    appendLog(`Đang tạo thư mục chapter: ${path}...`);
    await createFolderGeneric(path, `✅ Đã tạo xong thư mục chapter: ${chapterName}`);
}

// ===============================================
// LOGIC CẬP NHẬT DATA & UPLOAD ẢNH
// ===============================================

async function updateComicData() {
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
        appendLog(`Folder "${folder}" đã tồn tại. Đang chuyển sang chế độ chỉnh sửa.`, true);
        return;
    }

    const fileContent = formatComicData(currentComicData); 
    const newContentBase64 = btoa(unescape(encodeURIComponent(fileContent)));

    // Ghi vào temp_data.json để kích hoạt GitHub Actions
    const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'temp_data.json');
    
    try {
        // Gọi hàm upload đã gộp
        await uploadFileToGithub('temp_data.json', newContentBase64, `chore: Update data for ${title}`);
        appendLog(`\n🎉 Đã tạo/cập nhật file temp_data.json thành công!`, false);
        appendLog(`Vui lòng chờ GitHub Actions xử lý.`, false);
        
    } catch (error) {
        appendLog(`Lỗi API khi CẬP NHẬT FILE TẠM: ${error.message}`, true);
    }
}

async function uploadCoverImage() {
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
            await uploadFileToGithub(fullFilePath, base64Content, `feat: Upload ảnh bìa: ${coverFileName}`);
            appendLog(`Tải lên Ảnh Bìa thành công!`, false);
        } catch (error) {
            appendLog(`Lỗi tải lên Ảnh Bìa: ${error.message}`, true);
        }
    };

    reader.readAsDataURL(file);
}

async function uploadChapterImages() {
    const comicFolder = document.getElementById('comicFolder').value.trim();
    const chapterName = document.getElementById('chapterInput').value.trim();
    const fileInput = document.getElementById('chapterFileInput');

    if (!comicFolder) { appendLog('Vui lòng điền Tên Thư Mục Truyện.', true); return; }
    if (!chapterName) { appendLog('Vui lòng điền Tên Chapter Mới.', true); return; }
    if (fileInput.files.length === 0) { appendLog('Vui lòng chọn ít nhất một file ảnh chapter.', true); return; }

    const files = Array.from(fileInput.files).sort((a, b) => a.name.localeCompare(b.name));
    let successCount = 0;
    let failCount = 0;
    
    appendLog(`Bắt đầu tải lên ${files.length} ảnh vào: Comic/${comicFolder}/${chapterName}/...`);

    for (const file of files) {
        const reader = new FileReader();
        const fullFilePath = `Comic/${comicFolder}/${chapterName}/${file.name}`;

        const uploadPromise = new Promise((resolve) => {
            reader.onload = async function() {
                const base64Content = reader.result.split(',')[1];
                
                try {
                    await uploadFileToGithub(fullFilePath, base64Content, `feat: Thêm ảnh ${file.name} vào ${chapterName}`);
                    appendLog(`Tải lên thành công: ${file.name}`);
                    successCount++;
                    resolve();
                } catch (error) {
                    appendLog(`Lỗi tải file ${file.name}: ${error.message}`, true);
                    failCount++;
                    resolve();
                }
            };
            reader.readAsDataURL(file);
        });

        await uploadPromise;
    }

    appendLog(`\n--- KẾT QUẢ UPLOAD ---`, false);
    appendLog(`Hoàn thành: ${successCount} thành công, ${failCount} thất bại.`, false);
}