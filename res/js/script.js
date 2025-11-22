/* ================= CẤU HÌNH GITHUB ================= */
const GITHUB_CONFIG = {
		OWNER: 'huynt89',
		REPO: 'Book',
		ROOT_DIR: '',
		COMIC_DIR: 'Comic',
        COVER_DIR: 'cover' // Đường dẫn thư mục cover mới
};

/* LƯU Ý: COMIC_DATA_JSON được định nghĩa trong comic_data.js */


/* ================= HÀM HỖ TRỢ PATH ================= */
function getBaseImagePath() {
		const origin = window.location.origin;
		const pathname = window.location.pathname;
		if(pathname.includes('/Book/')) return origin + '/Book/';
		return origin + pathname.substring(0, pathname.lastIndexOf('/') + 1);
}
const BASE_PATH = getBaseImagePath();

/* ================= KHỞI TẠO & CONTROLS ================= */
let currentComicBase = '';
let currentChapterPath = '';

document.addEventListener('DOMContentLoaded', initializePage);

function initializePage() {
		const params = new URLSearchParams(window.location.search);
		const folderParam = params.get('folder');
		
		// Ẩn nút "Load Chapter" (đã ẩn trong HTML nhưng để phòng hờ)
		const loadChapterBtn = document.getElementById('loadChapterBtn');
		if (loadChapterBtn) loadChapterBtn.style.display = 'none';	
		
		// Bắt sự kiện khi thay đổi chapter
		const chapterSelect = document.getElementById('chapterSelect');
		chapterSelect.addEventListener('change', (e) => {
				const selectedChapter = e.target.value;
				if (currentComicBase && selectedChapter) {
						loadComicPagesFast(`${currentComicBase}/${selectedChapter}`);
				}
		});
		
		// Bắt sự kiện Reload Images
		document.getElementById('reloadBtn').onclick = reloadFailedImages;

		if (folderParam) {
				showViewerPage(decodeURIComponent(folderParam));
		} else {
				showListPage();
		}
}

/* ================= LIST PAGE ================= */
function showListPage() {
		document.getElementById('backLink').style.display = 'none';
		document.getElementById('mainTitle').textContent = 'Truyện Tranh Online';
		document.getElementById('comicViewer').style.display = 'none';
		document.getElementById('comicList').style.display = 'block';
		document.getElementById('controls').style.display = 'none'; 

		// Tự động tải danh sách truyện (Không cần nút)
		loadComics();
}

function loadComics() {
		const comicsContainer = document.getElementById('comicsContainer');
		const comics = COMIC_DATA_JSON;
		comicsContainer.innerHTML = '';
			
		const basePath = getBaseImagePath();

		comics.forEach(comic => {
				const comicDiv = document.createElement('div');
				comicDiv.classList.add('comic-item');
				const comicLink = document.createElement('a');
				comicLink.href = `index.html?folder=${encodeURIComponent(comic.folder)}`;
				
				// Tạo đường dẫn cover đầy đủ: basePath + COVER_DIR + comic.cover
				// Ví dụ: https://[user].github.io/Book/ + cover/YugiOh_cover.jpg
				const coverSrc = comic.cover ? `${basePath}${GITHUB_CONFIG.COVER_DIR}/${comic.cover}` : 'placeholder.png';	
				
				comicLink.innerHTML = `
						<img src="${coverSrc}" alt="${comic.title} Cover" class="comic-cover">
						<h3>${comic.title}</h3>
						<p>${comic.description}</p>
						<p class="view-link" style="margin-top: 5px;">Xem ngay &rarr;</p>
				`;
				comicDiv.appendChild(comicLink);
				comicsContainer.appendChild(comicDiv);
		});
}

/* ================= VIEWER PAGE (INIT) ================= */
async function showViewerPage(folderParam) {
		document.getElementById('controls').style.display = 'none';
		document.getElementById('comicList').style.display = 'none';
		document.getElementById('comicViewer').style.display = 'block';
		document.getElementById('backLink').style.display = 'block';

		const parts = folderParam.split('/').filter(Boolean);
		currentComicBase = parts[0];	
		const initialChapter = parts.length > 1 ? parts.slice(1).join('/') : '';

		const currentComic = COMIC_DATA_JSON.find(c => c.folder === currentComicBase);
		document.getElementById('mainTitle').textContent = currentComic ? currentComic.title : currentComicBase;
        document.getElementById('subText').textContent = currentComic ? currentComic.description : 'Đang tải chương...';

		const chapterSelect = document.getElementById('chapterSelect');
		const apiStatus = document.getElementById('apiStatus');

		chapterSelect.innerHTML = '<option>Đang tìm Chap...</option>';
		apiStatus.textContent = 'Đang kết nối...';

		const path = [GITHUB_CONFIG.ROOT_DIR, GITHUB_CONFIG.COMIC_DIR, currentComicBase].filter(p => p).join('/');
		const apiUrl = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${path}`;

		let chapters = [];

		try {
				const res = await fetch(apiUrl);
				if (!res.ok) {
						throw new Error("Lỗi kết nối API");
				}
				const items = await res.json();
				chapters = items
						.filter(item => item.type === 'dir')
						.map(item => item.name)
						.sort((a, b) => {
								const numA = parseInt((a.match(/\d+/) || [0])[0]);
								const numB = parseInt((b.match(/\d+/) || [0])[0]);
								return numA - numB;
						});
				apiStatus.textContent = '';
		} catch (e) {
				console.error(e);
				apiStatus.innerHTML = ``;
		}

		chapterSelect.innerHTML = '';

		if (chapters.length > 0) {
				chapters.forEach(ch => {
						const opt = document.createElement('option');
						opt.value = ch;
						opt.textContent = ch;
						chapterSelect.appendChild(opt);
				});
				let chapterToLoad = chapters[0];
				if (initialChapter && chapters.includes(initialChapter)) {
						chapterSelect.value = initialChapter;
						chapterToLoad = initialChapter;
				} else {
						chapterSelect.selectedIndex = 0;
				}
				// Tự động load chapter khi khởi tạo
				loadComicPagesFast(`${currentComicBase}/${chapterToLoad}`);
		} else {
				const defaultChap = initialChapter || 'Chap1';
				const opt = document.createElement('option');
				opt.value = defaultChap;
				opt.textContent = `${defaultChap} (Mặc định)`;
				chapterSelect.appendChild(opt);
				loadComicPagesFast(`${currentComicBase}/${defaultChap}`);
		}
}


/* ================= LOAD ẢNH BẰNG API (KHÔNG DÙNG VÒNG LẶP ĐOÁN) ================= */
async function loadComicPagesFast(folderPath) {
		currentChapterPath = folderPath; 
		const viewer = document.getElementById('viewerContainer');
		const statusViewerEl = createOrGetStatusElement(viewer);
		viewer.innerHTML = ''; 
		viewer.appendChild(statusViewerEl);
			
		statusViewerEl.textContent = '🚀 Đang tải danh sách ảnh...';

		const [comicBase, chapterFolder] = folderPath.split('/');
		const fullPath = [GITHUB_CONFIG.ROOT_DIR, GITHUB_CONFIG.COMIC_DIR, comicBase, chapterFolder].filter(p => p).join('/');
		const apiUrl = `https://api.github.com/repos/${GITHUB_CONFIG.OWNER}/${GITHUB_CONFIG.REPO}/contents/${fullPath}`;

		try {
				const res = await fetch(apiUrl);
				if (!res.ok) {
						throw new Error(`GitHub API Error: ${res.statusText}`);
				}
				const items = await res.json();
				
				const imageFiles = items
						.filter(item => item.type === 'file' && (item.name.endsWith('.jpg') || item.name.endsWith('.png')))
						.map(item => item.name)
						.sort((a, b) => {
								const numA = parseInt(a.match(/\d+/)?.[0] || '0');
								const numB = parseInt(b.match(/\d+/)?.[0] || '0');
								return numA - numB;
						});

				if (imageFiles.length === 0) {
						statusViewerEl.textContent = 'Không tìm thấy bất kỳ file ảnh nào trong chương này (.jpg hoặc .png).';
						return;
				}

				const baseContentUrl = `${BASE_PATH}${GITHUB_CONFIG.COMIC_DIR}/${folderPath}/`;
				
				const fragment = document.createDocumentFragment();
				imageFiles.forEach((fileName, index) => {
						const imgContainer = document.createElement('div');
						imgContainer.className = 'comic-page-container';
						
						const img = new Image();
						img.className = 'comic-page';
						img.alt = `Trang ${index + 1} (${fileName})`;
						img.src = baseContentUrl + fileName;
						img.dataset.status = 'loading'; 

						img.onload = function() {
								this.dataset.status = 'loaded';
								// Xóa icon lỗi nếu có
								const errorIcon = this.nextElementSibling;
								if(errorIcon && errorIcon.classList.contains('error-icon')) {
										errorIcon.remove();
								}
						};

						img.onerror = function() {
								this.dataset.status = 'failed';
								// Thêm icon lỗi (X)
								let errorIcon = this.nextElementSibling;
								if (!errorIcon || !errorIcon.classList.contains('error-icon')) {
										errorIcon = document.createElement('span');
										errorIcon.className = 'error-icon';
										errorIcon.textContent = '❌ Lỗi tải ảnh';
										errorIcon.style.cssText = 'color: #c0392b; font-weight: bold; margin-top: 5px; display: block;';
										this.parentNode.insertBefore(errorIcon, this.nextSibling);
								}
						};
						
						imgContainer.appendChild(img);
						fragment.appendChild(imgContainer);
				});

				// Hiển thị tất cả ảnh cùng lúc
				viewer.insertBefore(fragment, statusViewerEl);

				// Xóa dòng trạng thái
				statusViewerEl.textContent = '';	

		} catch (e) {
				console.error("Lỗi khi tải trang bằng API:", e);
				statusViewerEl.textContent = `❌ Lỗi: Không thể tải danh sách file.`;
		}
}

// Hàm hỗ trợ tạo/lấy status element
function createOrGetStatusElement(viewer) {
		let statusViewerEl = document.getElementById('status-viewer');
		if (!statusViewerEl) {
				statusViewerEl = document.createElement('p');
				statusViewerEl.id = 'status-viewer';
				statusViewerEl.style.color = '#777';
				statusViewerEl.style.fontStyle = 'italic';
				statusViewerEl.style.textAlign = 'center';
		}
		return statusViewerEl;
}

/* ================= CHỨC NĂNG RELOAD LỖI ================= */
function reloadFailedImages() {
		const viewer = document.getElementById('viewerContainer');
		const statusViewerEl = createOrGetStatusElement(viewer);
			
		// Tìm tất cả các thẻ <img> có thuộc tính data-status="failed"
		const failedImages = viewer.querySelectorAll('img[data-status="failed"]');
			
		if (failedImages.length === 0) {
				statusViewerEl.textContent = '🎉 Không có ảnh nào bị lỗi cần tải lại.';
				setTimeout(() => statusViewerEl.textContent = '', 3000);
				return;
		}

		statusViewerEl.textContent = `🔄 Đang tải lại ${failedImages.length} ảnh bị lỗi...`;

		failedImages.forEach(img => {
				img.dataset.status = 'loading';	
					
				// Buộc trình duyệt tải lại ảnh
				const originalSrc = img.src;
				img.src = '';	
				img.src = originalSrc;	
		});

		setTimeout(() => {
				const stillFailed = viewer.querySelectorAll('img[data-status="failed"]').length;
				if (stillFailed === 0) {
						statusViewerEl.textContent = `✅ Tải lại thành công!`;
				} else {
						statusViewerEl.textContent = `⚠️ Vẫn còn ${stillFailed} ảnh chưa tải được. Thử lại sau.`;
				}
				setTimeout(() => statusViewerEl.textContent = '', 3000); 
		}, 1500);	
}


/* ================= BACK LINK ================= */
document.getElementById('backLink').addEventListener('click', function(e) {
		e.preventDefault();
		window.location.href = 'index.html';
});