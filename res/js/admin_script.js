/* ===============================================
// CẤU HÌNH GITHUB (PHẢI KHỚP VỚI CẤU HÌNH TRƯỚC)
// =============================================== */
const GITHUB_CONFIG = {
    OWNER: 'huynt89',
    REPO: 'Book',
    FILE_PATH: 'comic_data.js',
    API_URL: (owner, repo, path) => `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
};

const LOG = document.getElementById('log');

function appendLog(message, isError = false) {
    const timestamp = new Date().toLocaleTimeString('vi-VN');
    LOG.textContent = `[${timestamp}] ${isError ? '❌ LỖI: ' : '✅ '} ${message}\n` + LOG.textContent;
}

// Hàm định dạng lại mảng JSON thành chuỗi JavaScript hợp lệ
function formatComicData(comicArray) {
    // Sắp xếp lại dữ liệu theo thứ tự (ví dụ: title) để code sạch hơn (tùy chọn)
    comicArray.sort((a, b) => a.title.localeCompare(b.title)); 
    
    const dataString = JSON.stringify(comicArray, null, 4)
        .replace(/"([^"]+)":/g, '$1:')
        .replace(/:/g, ': ')
        .replace(/    /g, '\t');
    
    return `/* ================= CẤU HÌNH TRUYỆN ================= */\n\n// Lưu ý: Đường dẫn ảnh bìa đã được đổi thành thư mục 'cover/' \n// Bạn chỉ cần điền tên file ảnh ở đây (ví dụ: 'YugiOh_cover.jpg')\nconst COMIC_DATA_JSON = ${dataString};\n`;
}

document.getElementById('addComicBtn').addEventListener('click', updateComicData);

async function updateComicData() {
    const token = document.getElementById('githubToken').value.trim();
    const title = document.getElementById('comicTitle').value.trim();
    const folder = document.getElementById('comicFolder').value.trim();
    const description = document.getElementById('comicDescription').value.trim();
    const cover = document.getElementById('comicCover').value.trim();

    if (!token || !title || !folder || !description || !cover) {
        appendLog('Vui lòng điền đầy đủ các trường và GitHub Token.', true);
        return;
    }

    const newComic = {
        title,
        folder,
        upload_date: new Date().toISOString().split('T')[0],
        description,
        cover
    };

    appendLog(`Bắt đầu thêm truyện: ${newComic.title}...`);

    try {
        const apiUrl = GITHUB_CONFIG.API_URL(GITHUB_CONFIG.OWNER, GITHUB_CONFIG.REPO, GITHUB_CONFIG.FILE_PATH);
        const headers = {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
        };

        // 1. TẢI FILE HIỆN TẠI
        let response = await fetch(apiUrl, { headers });
        if (!response.ok) {
            throw new Error(`Tải file thất bại. Kiểm tra Token và quyền truy cập Repo. Status: ${response.status}`);
        }
        const fileContent = await response.json();
        const sha = fileContent.sha; 
        
        // Giải mã và trích xuất dữ liệu
        const contentBase64 = fileContent.content.replace(/\n/g, '');
        const content = atob(contentBase64); // atob dùng trong trình duyệt
        
        const match = content.match(/const COMIC_DATA_JSON = (\[[\s\S]*?\]);/);
        if (!match) {
            throw new Error("Không tìm thấy mảng COMIC_DATA_JSON.");
        }
        
        let existingData = [];
        try {
            // Sử dụng eval an toàn để parse chuỗi JS thành mảng JSON
            eval(`existingData = ${match[1]}`); 
        } catch(e) {
             throw new Error("Lỗi khi đọc dữ liệu truyện. Cú pháp file comic_data.js có thể sai.");
        }

        // 2. CẬP NHẬT DỮ LIỆU
        const isExist = existingData.some(comic => comic.folder === newComic.folder);
        if (isExist) {
            appendLog(`Truyện với folder "${newComic.folder}" đã tồn tại. Không thêm.`, true);
            return;
        }

        existingData.push(newComic);
        
        // 3. MÃ HÓA NỘI DUNG MỚI
        const newContentString = formatComicData(existingData);
        const newContentBase64 = btoa(unescape(encodeURIComponent(newContentString))); // btoa dùng trong trình duyệt
        
        // 4. ĐẨY FILE LÊN GITHUB
        const commitData = {
            message: `feat: Thêm truyện: ${newComic.title} (qua Web Admin)`,
            content: newContentBase64,
            sha: sha 
        };
        
        response = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                ...headers,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(commitData)
        });

        if (!response.ok) {
             throw new Error(`Đẩy file thất bại. Status: ${response.status}`);
        }
        
        appendLog(`Cập nhật file comic_data.js thành công! Truyện "${newComic.title}" đã được thêm.`);

    } catch (error) {
        appendLog(`Lỗi API: ${error.message}`, true);
    }
}