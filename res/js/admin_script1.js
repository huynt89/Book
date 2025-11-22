/* ===============================================
// CẤU HÌNH GITHUB
// =============================================== */
const GITHUB_CONFIG = {
    // ⚠️ ĐIỀN CHÍNH XÁC THÔNG TIN REPO CỦA BẠN ⚠️
    OWNER: 'huynt89',
    REPO: 'Book', 
    FILE_PATH: 'comic_data.js',
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

    appendLog('Token được xử lý an toàn qua GitHub Actions.', false, true); 
    appendLog('Ứng dụng đã sẵn sàng.', false, true);
}

function setupMainListeners() {
    document.getElementById('comicSelector').addEventListener('change', handleComicSelect);
    document.getElementById('addNewBtn').addEventListener('click', clearForm);
    document.getElementById('saveComicBtn').addEventListener('click', updateComicData);
    
    // Nút mới: Tạo Comic Folder
    document.getElementById('createComicFolderBtn').addEventListener('click', createComicFolder); 
    
    // Nút đã có: Tạo Chapter Folder
    document.getElementById('createChapterFolderBtn').addEventListener('click', createChapterFolder);
    
    document.getElementById('uploadCoverBtn').addEventListener('click', uploadCoverImage);
    document.getElementById('uploadChapterBtn').addEventListener('click', uploadChapterImages);
}


// ... (Các hàm loadComicDataAndPopulateList, handleComicSelect, clearForm, updateComicData, getHeaders, formatComicData giữ nguyên) ...

// ===============================================
// LOGIC UPLOAD FILE (WRITE)
// ===============================================

// Sửa đổi hàm appendLog để thêm tùy chọn hiển thị ở đầu (prepend)
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
    };
}
// ===============================================
// LOGIC TẢI DỮ LIỆU (READ) - SỬA LỖI 404
// ===============================================

async function loadComicDataAndPopulateList() {
    // 🛑 ĐÃ SỬA LỖI 404: Thêm GITHUB_CONFIG.REPO vào đường dẫn
    const fileUrl = `${window.location.origin}/${GITHUB_CONFIG.REPO}/${GITHUB_CONFIG.FILE_PATH}`;
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
        
        eval(`currentComicData = ${match[1]}`); 
        currentComicData.sort((a, b) => a.title.localeCompare(b.title));

        selector.innerHTML = '<option value="">-- Chọn Truyện --</option>';
        currentComicData.forEach((comic, index) => {
            const opt = document.createElement('option');
            opt.value = index;
            opt.textContent = comic.title;
            selector.appendChild(opt);
        });
        appendLog(`Đã tải và hiển thị ${currentComicData.length} truyện trong danh sách.`, false);
        selector.innerHTML = '<option value="">-- Lỗi tải truyện --</option>';
        // Hiển thị lỗi ra Log
        appendLog(`Lỗi tải dữ liệu truyện: ${error.message}. Vui lòng kiểm tra Console (F12) và đường dẫn file!`, true); 
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

	
function formatComicData(comicArray) {
    comicArray.sort((a, b) => a.title.localeCompare(b.title)); 
    return JSON.stringify(comicArray, null, 4);
}

// ===============================================
// LOGIC UPLOAD FILE (WRITE)
// ===============================================

// Hàm hỗ trợ upload (Tokenless)
async function uploadFileToGithub(fullFilePath, base64Content, commitMessage) {
    const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, fullFilePath);
    
    const commitData = {
        message: commitMessage,
        content: base64Content,
    };
    
    const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: getHeaders(), 
        body: JSON.stringify(commitData)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Status ${response.status}: ${errorText}. Kiểm tra quyền Actions.`);
    }
    
    return response.json();
}


// Hàm hỗ trợ upload (Tokenless) - Giữ nguyên
async function uploadFileToGithub(fullFilePath, base64Content, commitMessage) {
    const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, fullFilePath);
    
    let sha = null;
    try {
        const getResponse = await fetch(apiUrl); 
        if (getResponse.ok) {
            const existingFile = await getResponse.json();
            sha = existingFile.sha;
        }
    } catch (e) { /* File chưa tồn tại */ }

    const commitData = {
        message: commitMessage,
        content: base64Content,
        sha: sha
    };
    
    const response = await fetch(apiUrl, {
        method: 'PUT',
        headers: getHeaders(), 
        body: JSON.stringify(commitData)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Status ${response.status}: ${errorText}. Kiểm tra quyền Actions.`);
    }
    
    return response.json();
}

// Hàm mới: Tạo Folder Truyện (trong thư mục 'Comic')
async function createComicFolder() {
    const comicFolder = document.getElementById('comicFolder').value.trim();
    
    if (!comicFolder) { 
        appendLog('Vui lòng điền Tên Thư Mục Truyện (Folder) trước.', true); 
        return; 
    }

    // Tạo file dummy .gitkeep bên trong thư mục Comic/<Tên Truyện>/
    const fullFilePath = `Comic/${comicFolder}/.gitkeep`; 
    const base64Content = btoa(unescape(encodeURIComponent(''))); // Nội dung rỗng

    appendLog(`Đang tạo folder truyện: Comic/${comicFolder}/...`);

    try {
        await uploadFileToGithub(fullFilePath, base64Content, `feat: Tạo folder truyện: ${comicFolder}`);
        appendLog(`Tạo folder truyện thành công!`, false);
    } catch (error) {
        if (error.message.includes('sha')) {
            // Lỗi 422 khi file đã tồn tại, tức là folder đã có
            appendLog(`Folder Truyện đã tồn tại: ${comicFolder}.`, false);
        } else {
            appendLog(`Lỗi tạo folder truyện: ${error.message}`, true);
        }
    }
}

// Hàm Tạo Folder Chapter (Giữ nguyên)
async function createChapterFolder() {
    const comicFolder = document.getElementById('comicFolder').value.trim();
    const chapterName = document.getElementById('chapterInput').value.trim();
    
    if (!comicFolder) { appendLog('Vui lòng điền Tên Thư Mục Truyện trước.', true); return; }
    if (!chapterName) { appendLog('Vui lòng điền Tên Chapter Mới.', true); return; }

    const fullFilePath = `Comic/${comicFolder}/${chapterName}/.gitkeep`; 
    const base64Content = btoa(unescape(encodeURIComponent(''))); 

    appendLog(`Đang tạo folder chapter: Comic/${comicFolder}/${chapterName}/...`);

    try {
        await uploadFileToGithub(fullFilePath, base64Content, `feat: Tạo folder chapter: ${chapterName}`);
        appendLog(`Tạo folder chapter thành công!`, false);
    } catch (error) {
        if (error.message.includes('sha')) {
            appendLog(`Folder Chapter đã tồn tại: ${chapterName}.`, false);
        } else {
            appendLog(`Lỗi tạo folder chapter: ${error.message}`, true);
        }
    }
}


// ... (Các hàm uploadCoverImage và uploadChapterImages giữ nguyên logic) ...

async function updateComicData() {
    // Logic cập nhật dữ liệu... (Không thay đổi)
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

    const fileContent = formatComicData(currentComicData); 
    const newContentBase64 = btoa(unescape(encodeURIComponent(fileContent)));

    const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, 'temp_data.json');
    
    try {
        let sha = null;
        try {
            const getResponse = await fetch(apiUrl); 
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
            headers: getHeaders(), 
            body: JSON.stringify(commitData)
        });

        if (!response.ok) { 
            throw new Error(`Đẩy file tạm thời thất bại. Status: ${response.status}.`); 
        }
        
        appendLog(`\n🎉 Đã tạo/cập nhật file temp_data.json thành công!`, false);
        appendLog(`Vui lòng chờ 10-20 giây để GitHub Actions tự động cập nhật comic_data.js.`, false);
        
    } catch (error) {
        appendLog(`Lỗi API khi CẬP NHẬT FILE TẠM THỜI: ${error.message}`, true);
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
            appendLog(`Tải lên Ảnh Bìa thành công vào: ${fullFilePath}`, false);
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
                    await uploadFileToGithub(fullFilePath, base64Content, `feat: Thêm ảnh ${file.name} vào chương ${chapterName}`);
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