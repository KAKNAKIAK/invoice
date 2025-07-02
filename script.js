// =======================================================================
// 1. 전역 변수 및 설정
// =======================================================================
let quoteGroupsData = {}; // 모든 견적 그룹의 데이터를 저장하는 핵심 객체
let groupCounter = 0;
let activeGroupId = null;
let currentFileHandle = null;

const ROW_DEFINITIONS = [
    { id: 'airfare', label: '항공', type: 'costInput' }, { id: 'hotel', label: '호텔', type: 'costInput' },
    { id: 'ground', label: '지상', type: 'costInput' }, { id: 'insurance', label: '보험', type: 'costInput' },
    { id: 'commission', label: '커미션', type: 'costInput' }, { id: 'addDynamicRow', label: '+ 항목 추가', type: 'button' },
    { id: 'netCost', label: '넷가', type: 'calculated' }, { id: 'salesPrice', label: '상품가', type: 'salesInput' },
    { id: 'profitPerPerson', label: '1인수익', type: 'calculated' }, { id: 'profitMargin', label: '1인수익률', type: 'calculatedPercentage' }
];

// Firebase 연동 관련 변수 및 초기화 (메인 앱)
const firebaseConfig = {
    apiKey: "AIzaSyC7eXBtNczq0ylN5UZNyZaMUH3M-6Gicvc",
    authDomain: "memo-1-e9ee8.firebaseapp.com",
    projectId: "memo-1-e9ee8",
    storageBucket: "memo-1-e9ee8.appspot.com",
    messagingSenderId: "787316238134",
    appId: "1:787316238134:web:20b136703e76ff3de67597",
    measurementId: "G-WGB4VSG0MP"
};
const fbApp = firebase.initializeApp(firebaseConfig, 'memoApp');
const db = firebase.firestore(fbApp);

// =======================================================================
// 2. IndexedDB 헬퍼 함수 (파일 핸들 저장을 위해)
// =======================================================================
const IDB_NAME = 'FileHandlesDB';
const IDB_STORE_NAME = 'fileHandles';
let idbPromise;

function initDB() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(IDB_NAME, 1);
        request.onerror = () => reject("IndexedDB error: " + request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
                db.createObjectStore(IDB_STORE_NAME, { keyPath: 'name' });
            }
        };
    });
    return idbPromise;
}

async function saveFileHandle(name, handle) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(IDB_STORE_NAME);
        const request = store.put({ name, handle, timestamp: new Date() });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("Failed to save file handle: " + request.error);
    });
}

async function getFileHandle(name) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE_NAME, 'readonly');
        const store = transaction.objectStore(IDB_STORE_NAME);
        const request = store.get(name);
        request.onsuccess = () => resolve(request.result?.handle);
        request.onerror = () => reject("Failed to get file handle: " + request.error);
    });
}

async function getAllFileHandles() {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE_NAME, 'readonly');
        const store = transaction.objectStore(IDB_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => {
            const sorted = request.result.sort((a, b) => b.timestamp - a.timestamp);
            resolve(sorted);
        };
        request.onerror = () => reject("Failed to get all file handles: " + request.error);
    });
}

async function deleteFileHandle(name) {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(IDB_STORE_NAME);
        const request = store.delete(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject("Failed to delete file handle: " + request.error);
    });
}

// =======================================================================
// 3. GDS 파서 연동 함수
// =======================================================================
function addFlightsFromParser(parsedFlights) {
    if (!parsedFlights || parsedFlights.length === 0) return;
    if (!activeGroupId) { showToastMessage("파싱된 항공편을 추가할 활성 견적이 없습니다.", true); return; }
    const activeGroupData = quoteGroupsData[activeGroupId];
    const activeGroupElement = document.getElementById(`group-content-${activeGroupId}`);
    if (!activeGroupData || !activeGroupElement) return;
    const flightContainer = activeGroupElement.querySelector('.flight-schedule-container');
    const airlineCodeMap = {
        "KE": "대한항공", "OZ": "아시아나항공", "7C": "제주항공", "LJ": "진에어", "TW": "티웨이항공", "RS": "에어서울", "BX": "에어부산", "ZE": "이스타항공",
        "NH": "전일본공수(ANA)", "JL": "일본항공", "MM": "피치항공", "CA": "중국국제항공", "MU": "중국동방항공", "CZ": "중국남방항공", "CX": "캐세이퍼시픽",
        "CI": "중화항공", "BR": "에바항공", "SQ": "싱가포르항공", "TG": "타이항공", "VN": "베트남항공", "VJ": "비엣젯항공", "QH": "뱀부항공",
        "PR": "필리핀항공", "MH": "말레이시아항공", "GA": "가루다인도네시아항공", "EK": "에미레이트항공", "QR": "카타르항공", "EY": "에티하드항공", "SV": "사우디아항공", "TK": "터키항공",
        "AA": "아메리칸항공", "UA": "유나이티드항공", "DL": "델타항공", "HA": "하와이안항공", "AS": "알래스카항공", "AC": "에어캐나다", "AM": "아에로멕시코",
        "AF": "에어프랑스", "KL": "KLM네덜란드항공", "BA": "영국항공", "VS": "버진애틀랜틱", "LH": "루프트한자", "AZ": "알리탈리아(ITA)", "IB": "이베리아항공", "LX": "스위스국제항공", "AY": "핀에어", "SU": "아에로플로트",
        "QF": "콴타스항공", "NZ": "에어뉴질랜드"
    };
    const firstFlightAirlineCode = parsedFlights[0].airlineCode;
    const subgroupTitle = airlineCodeMap[firstFlightAirlineCode] || firstFlightAirlineCode;
    const newSubgroup = { id: `flight_sub_${Date.now()}`, title: subgroupTitle, rows: parsedFlights.map(flight => ({ ...flight })) };
    if (!activeGroupData.flightSchedule) activeGroupData.flightSchedule = [];
    activeGroupData.flightSchedule.push(newSubgroup);
    createFlightSubgroup(flightContainer, newSubgroup, activeGroupId);
    showToastMessage("GDS 항공 정보가 추가되었습니다.");
}

// =======================================================================
// ▼▼▼ 4. 호텔카드 메이커 (Hotel Maker) 통합 코드 ▼▼▼
// =======================================================================
const hmFirebaseConfig = {
    apiKey: "AIzaSyDsV5PGKMFdCDKgFfl077-DuaYv6N5kVNs",
    authDomain: "hotelinformation-app.firebaseapp.com",
    projectId: "hotelinformation-app",
    storageBucket: "hotelinformation-app.firebasestorage.app",
    messagingSenderId: "1027315001739",
    appId: "1:1027315001739:web:d7995a67062441fa93a78e",
    measurementId: "G-X889T0FZCY"
};
const hmFbApp = firebase.initializeApp(hmFirebaseConfig, 'hotelMakerApp');
const hmDb = firebase.firestore(hmFbApp);

function initializeHotelMakerForGroup(container, groupId) {
    container.innerHTML = `
        <div class="hm-controls flex flex-wrap gap-2 justify-end mb-4">
            <button id="hm-copyHtmlBtn-${groupId}" class="btn btn-sm btn-outline"><i class="fas fa-copy"></i> 코드 복사</button>
            <button id="hm-previewHotelBtn-${groupId}" class="btn btn-sm btn-outline"><i class="fas fa-eye"></i> 미리보기</button>
            <button id="hm-loadHotelHtmlBtn-${groupId}" class="btn btn-sm btn-outline"><i class="fas fa-database"></i> DB 불러오기</button>
        </div>
        <div id="hm-hotelTabsContainer-${groupId}" class="hm-tabs-container flex flex-wrap items-center border-b-2 border-gray-200 mb-4">
            <button id="hm-addHotelTabBtn-${groupId}" class="hotel-tab-button"><i class="fas fa-plus mr-2"></i>새 호텔 추가</button>
        </div>
        <div id="hm-hotelEditorForm-${groupId}" class="hm-editor-form">
            <div class="input-card-group bg-white p-4 rounded-lg border border-gray-200">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="form-field"><input type="text" id="hm-hotelNameKo-${groupId}" class="input-field" placeholder=" "><label for="hm-hotelNameKo-${groupId}">호텔명 (한글)</label></div>
                    <div class="form-field"><input type="text" id="hm-hotelNameEn-${groupId}" class="input-field" placeholder=" "><label for="hm-hotelNameEn-${groupId}">호텔명 (영문)</label></div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div class="form-field"><input type="url" id="hm-hotelWebsite-${groupId}" class="input-field" placeholder=" "><label for="hm-hotelWebsite-${groupId}">호텔 웹사이트</label></div>
                    <div class="form-field"><input type="url" id="hm-hotelImage-${groupId}" class="input-field" placeholder=" "><label for="hm-hotelImage-${groupId}">대표 이미지 URL</label></div>
                </div>
                <div class="form-field mt-4"><textarea id="hm-hotelDescription-${groupId}" class="input-field" rows="4" placeholder=" "></textarea><label for="hm-hotelDescription-${groupId}">간단 설명</label></div>
            </div>
        </div>
    `;

    document.getElementById(`hm-copyHtmlBtn-${groupId}`).addEventListener('click', () => hm_copyOptimizedHtml(groupId));
    document.getElementById(`hm-previewHotelBtn-${groupId}`).addEventListener('click', () => hm_previewHotelInfo(groupId));
    document.getElementById(`hm-loadHotelHtmlBtn-${groupId}`).addEventListener('click', () => hm_openLoadHotelSetModal(groupId));
    document.getElementById(`hm-addHotelTabBtn-${groupId}`).addEventListener('click', () => hm_addHotel(groupId));

    const editorForm = document.getElementById(`hm-hotelEditorForm-${groupId}`);
    editorForm.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('input', () => {
            hm_syncCurrentHotelData(groupId);
            if (input.id.includes('hotelNameKo')) {
                hm_renderTabs(groupId);
            }
        });
    });

    hm_render(groupId);
}

function hm_render(groupId) {
    hm_renderTabs(groupId);
    hm_renderEditorForCurrentHotel(groupId);
}

function hm_syncCurrentHotelData(groupId) {
    const hotelData = quoteGroupsData[groupId]?.hotelMakerData;
    if (!hotelData || hotelData.currentHotelIndex === -1 || hotelData.currentHotelIndex >= hotelData.allHotelData.length) return;

    const groupEl = document.getElementById(`group-content-${groupId}`);
    if (!groupEl) return;

    const currentHotel = hotelData.allHotelData[hotelData.currentHotelIndex];
    if (!currentHotel) return;

    currentHotel.nameKo = groupEl.querySelector(`#hm-hotelNameKo-${groupId}`).value.trim();
    currentHotel.nameEn = groupEl.querySelector(`#hm-hotelNameEn-${groupId}`).value.trim();
    currentHotel.website = groupEl.querySelector(`#hm-hotelWebsite-${groupId}`).value.trim();
    currentHotel.image = groupEl.querySelector(`#hm-hotelImage-${groupId}`).value.trim();
    currentHotel.description = groupEl.querySelector(`#hm-hotelDescription-${groupId}`).value.trim();
}

function hm_renderTabs(groupId) {
    const groupEl = document.getElementById(`group-content-${groupId}`);
    if (!groupEl) return;
    const hotelData = quoteGroupsData[groupId]?.hotelMakerData;
    if (!hotelData) return;
    
    const tabsContainer = groupEl.querySelector(`#hm-hotelTabsContainer-${groupId}`);
    const addBtn = groupEl.querySelector(`#hm-addHotelTabBtn-${groupId}`);

    tabsContainer.querySelectorAll('.hotel-tab-button:not([id^="hm-addHotelTabBtn-"])').forEach(tab => tab.remove());

    hotelData.allHotelData.forEach((hotel, index) => {
        const tabButton = document.createElement('button');
        tabButton.className = 'hotel-tab-button';
        if (index === hotelData.currentHotelIndex) {
            tabButton.classList.add('active');
        }
        tabButton.innerHTML = `<span class="tab-title">${hotel.nameKo || `새 호텔 ${index + 1}`}</span><i class="fas fa-times tab-delete-icon" title="이 호텔 정보 삭제"></i>`;
        
        tabButton.addEventListener('click', () => hm_switchTab(groupId, index));
        tabButton.querySelector('.tab-delete-icon').addEventListener('click', (e) => {
            e.stopPropagation();
            hm_deleteHotel(groupId, index);
        });

        tabsContainer.insertBefore(tabButton, addBtn);
    });
}

function hm_renderEditorForCurrentHotel(groupId) {
    const groupEl = document.getElementById(`group-content-${groupId}`);
    if (!groupEl) return;
    const hotelData = quoteGroupsData[groupId]?.hotelMakerData;
    if (!hotelData) return;
    const editorForm = groupEl.querySelector(`#hm-hotelEditorForm-${groupId}`);

    if (hotelData.currentHotelIndex === -1 || !hotelData.allHotelData[hotelData.currentHotelIndex]) {
        editorForm.classList.add('disabled');
        editorForm.querySelectorAll('input, textarea').forEach(el => { el.value = ''; el.placeholder = ' '; });
        return;
    }

    editorForm.classList.remove('disabled');
    const hotel = hotelData.allHotelData[hotelData.currentHotelIndex];
    groupEl.querySelector(`#hm-hotelNameKo-${groupId}`).value = hotel.nameKo || '';
    groupEl.querySelector(`#hm-hotelNameEn-${groupId}`).value = hotel.nameEn || '';
    groupEl.querySelector(`#hm-hotelWebsite-${groupId}`).value = hotel.website || '';
    groupEl.querySelector(`#hm-hotelImage-${groupId}`).value = hotel.image || '';
    groupEl.querySelector(`#hm-hotelDescription-${groupId}`).value = hotel.description || '';
    editorForm.querySelectorAll('input, textarea').forEach(el => { if(el.value) el.placeholder = ' '; });
}

function hm_switchTab(groupId, index) {
    hm_syncCurrentHotelData(groupId);
    const hotelData = quoteGroupsData[groupId].hotelMakerData;
    hotelData.currentHotelIndex = index;
    hm_render(groupId);
}

function hm_addHotel(groupId) {
    hm_syncCurrentHotelData(groupId);
    const hotelData = quoteGroupsData[groupId].hotelMakerData;
    const newHotel = { nameKo: `새 호텔 ${hotelData.allHotelData.length + 1}`, nameEn: "", website: "", image: "", description: "" };
    hotelData.allHotelData.push(newHotel);
    hm_switchTab(groupId, hotelData.allHotelData.length - 1);
}

function hm_deleteHotel(groupId, indexToDelete) {
    const hotelData = quoteGroupsData[groupId].hotelMakerData;
    const hotelName = hotelData.allHotelData[indexToDelete].nameKo || `새 호텔 ${indexToDelete + 1}`;
    if (!confirm(`'${hotelName}' 호텔을 삭제하시겠습니까?`)) return;

    hotelData.allHotelData.splice(indexToDelete, 1);

    if (hotelData.currentHotelIndex >= indexToDelete) {
        hotelData.currentHotelIndex = Math.max(0, hotelData.currentHotelIndex - 1);
    }
    
    if (hotelData.allHotelData.length === 0) {
        hotelData.currentHotelIndex = -1;
    }

    hm_render(groupId);
}

function hm_copyOptimizedHtml(groupId) {
    hm_syncCurrentHotelData(groupId);
    const hotelData = quoteGroupsData[groupId].hotelMakerData;
    if (hotelData.currentHotelIndex === -1) {
        showToastMessage('복사할 호텔을 선택해주세요.', true);
        return;
    }
    const hotel = hotelData.allHotelData[hotelData.currentHotelIndex];
    const htmlToCopy = hm_generateHotelCardHtml(hotel);
    navigator.clipboard.writeText(htmlToCopy)
        .then(() => showToastMessage('호텔 카드 HTML 코드가 클립보드에 복사되었습니다.'))
        .catch(err => showToastMessage('복사에 실패했습니다.', true));
}

function hm_previewHotelInfo(groupId) {
    hm_syncCurrentHotelData(groupId);
    const hotelData = quoteGroupsData[groupId].hotelMakerData;
    if (hotelData.allHotelData.length === 0) {
        showToastMessage('미리보기할 호텔 정보가 없습니다.', true);
        return;
    }
    const previewHtml = hm_generateFullPreviewHtml(hotelData.allHotelData);
    const previewWindow = window.open('', '_blank', 'width=900,height=600,scrollbars=yes,resizable=yes');
    if (previewWindow) {
        previewWindow.document.open();
        previewWindow.document.write(previewHtml);
        previewWindow.document.close();
    } else {
        showToastMessage('팝업이 차단되어 미리보기를 열 수 없습니다.', true);
    }
}

async function hm_openLoadHotelSetModal(groupId) {
    let modal = document.getElementById('hm_loadHotelSetModal');
    if (modal) modal.remove();

    modal = document.createElement('div');
    modal.id = 'hm_loadHotelSetModal';
    modal.className = "fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex items-center justify-center z-50";
    modal.innerHTML = `
        <div class="relative p-5 border w-11/12 md:w-1/2 lg:w-1/3 shadow-lg rounded-md bg-white">
            <div class="flex justify-between items-center mb-3"><h3 class="text-lg font-medium">저장된 호텔 정보 불러오기</h3><button id="hm_closeLoadHotelSetModalButton" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button></div>
            <input type="text" id="hm_hotelSetSearchInput" placeholder="저장된 이름으로 검색..." class="w-full p-2 mb-3 border rounded-md">
            <ul id="hm_hotelSetListForLoad" class="mt-2 h-60 overflow-y-auto border rounded-md divide-y"></ul>
            <div id="hm_loadingHotelSetListMsg" class="mt-2 text-sm" style="display:none;">목록을 불러오는 중...</div>
            <div class="mt-4"><button id="hm_cancelLoadHotelSetModalButton" class="btn btn-outline w-full">닫기</button></div>
        </div>
    `;
    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#hm_closeLoadHotelSetModalButton').addEventListener('click', closeModal);
    modal.querySelector('#hm_cancelLoadHotelSetModalButton').addEventListener('click', closeModal);

    const listEl = modal.querySelector('#hm_hotelSetListForLoad');
    const loadingMsg = modal.querySelector('#hm_loadingHotelSetListMsg');
    const searchInput = modal.querySelector('#hm_hotelSetSearchInput');
    
    loadingMsg.style.display = 'block';
    listEl.innerHTML = '';

    try {
        const querySnapshot = await hmDb.collection("hotels").orderBy("timestamp", "desc").get();
        const allSets = [];
        querySnapshot.forEach(doc => allSets.push({ id: doc.id, ...doc.data() }));
        loadingMsg.style.display = 'none';

        const renderList = (sets) => {
            listEl.innerHTML = sets.length ? '' : `<li class="p-3 text-center text-gray-500">결과가 없습니다.</li>`;
            sets.forEach(set => {
                const li = document.createElement('li');
                li.className = 'p-3 hover:bg-gray-100 cursor-pointer';
                li.textContent = set.name;
                li.addEventListener('click', () => {
                    hm_addHotelsFromDbToGroup(groupId, set.hotels);
                    showToastMessage(`'${set.name}'의 호텔 정보가 현재 목록에 추가되었습니다.`);
                    closeModal();
                });
                listEl.appendChild(li);
            });
        };
        
        searchInput.addEventListener('input', () => {
            const term = searchInput.value.toLowerCase();
            const filtered = allSets.filter(s => s.name.toLowerCase().includes(term));
            renderList(filtered);
        });

        renderList(allSets);

    } catch (error) {
        loadingMsg.textContent = '목록 로딩 실패';
        showToastMessage('호텔 목록을 불러오는 중 오류가 발생했습니다.', true);
    }
}

function hm_addHotelsFromDbToGroup(groupId, hotelsToAdd) {
    if (!hotelsToAdd || hotelsToAdd.length === 0) return;
    hm_syncCurrentHotelData(groupId);
    const hotelData = quoteGroupsData[groupId].hotelMakerData;
    
    if (hotelData.allHotelData.length === 1 && hotelData.allHotelData[0].nameKo.startsWith('새 호텔')) {
        hotelData.allHotelData = JSON.parse(JSON.stringify(hotelsToAdd));
        hotelData.currentHotelIndex = 0;
    } else {
        hotelData.allHotelData.push(...JSON.parse(JSON.stringify(hotelsToAdd)));
        hotelData.currentHotelIndex = hotelData.allHotelData.length - hotelsToAdd.length;
    }

    hm_render(groupId);
}

function hm_generateHotelCardHtml(hotel) {
    const placeholderImage = 'https://placehold.co/400x300/e2e8f0/cbd5e0?text=No+Image';
    const currentHotelImage = (typeof hotel.image === 'string' && hotel.image.startsWith('http')) ? hotel.image : placeholderImage;

    const descriptionItems = hotel.description ? hotel.description.split('\n').filter(line => line.trim() !== '') : [];
    const descriptionHtml = descriptionItems.map(item => `
        <div style="margin-bottom: 6px; line-height: 1.6;"><span style="font-size: 12px; color: #34495e;">${item.replace(/● /g, '')}</span></div>`).join('');

    const websiteButtonHtml = hotel.website ? `
        <div style="margin-top: 20px;"><a href="${hotel.website}" target="_blank" style="background-color: #3498db; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 12px;">웹사이트 바로가기</a></div>` : '';

    return `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 750px; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; border-collapse: separate; border-spacing: 24px;"><tbody><tr><td width="320" style="width: 320px; vertical-align: top;"><table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); overflow: hidden;"><tbody><tr><td><img src="${currentHotelImage}" alt="${hotel.nameKo || '호텔 이미지'}" width="320" style="width: 100%; height: auto; display: block;" onerror="this.onerror=null; this.src='${placeholderImage}';"></td></tr><tr><td style="padding: 16px 20px;"><div style="font-size: 14px; font-weight: bold; color: #2c3e50;">${hotel.nameKo || '호텔명 없음'}</div>${hotel.nameEn ? `<div style="font-size: 12px; color: #7f8c8d; margin-top: 4px;">${hotel.nameEn}</div>` : ''}</td></tr></tbody></table></td><td style="vertical-align: middle;"><div>${descriptionHtml}${websiteButtonHtml}</div></td></tr></tbody></table>`;
}

function hm_generateFullPreviewHtml(data) {
    const hotelName = data.length > 0 ? data[0].nameKo : '호텔';
    const sliderHead = data.length > 1 ? `<link rel="stylesheet" href="https://unpkg.com/swiper/swiper-bundle.min.css" /><script src="https://unpkg.com/swiper/swiper-bundle.min.js"></script>` : '';
    const sliderBodyScript = data.length > 1 ? `<script>new Swiper('.swiper', {loop: true, pagination: {el: '.swiper-pagination', clickable: true}, navigation: {nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev'}});</script>` : '';
    
    let bodyContent;
    if (data.length > 1) {
        const slides = data.map(hotel => `<div class="swiper-slide">${hm_generateHotelCardHtml(hotel)}</div>`).join('');
        bodyContent = `<div class="swiper" style="max-width: 800px; margin: auto;"><div class="swiper-wrapper">${slides}</div><div class="swiper-pagination"></div><div class="swiper-button-prev"></div><div class="swiper-button-next"></div></div>`;
    } else if (data.length === 1) {
        bodyContent = hm_generateHotelCardHtml(data[0]);
    } else {
        bodyContent = '<h1 style="text-align: center;">표시할 호텔 정보가 없습니다.</h1>';
    }

    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>호텔 안내: ${hotelName}</title>${sliderHead}<style>body{font-family:'Malgun Gothic',sans-serif;background-color:#f0f2f5;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:2rem;box-sizing:border-box;margin:0;}.swiper-slide{display:flex;justify-content:center;align-items:center;}</style></head><body>${bodyContent}${sliderBodyScript}</body></html>`;
}

// =======================================================================
// ▲▲▲ 4. 호텔카드 메이커 (Hotel Maker) 통합 코드 끝 ▲▲▲
// =======================================================================
// =======================================================================
// 5. 상세 일정표 (Itinerary Planner) 통합 코드
// =======================================================================
const ipFirebaseConfig = {
  apiKey: "AIzaSyAGULxdnWWnSc5eMCsqHeKGK9tmyHsxlv0",
  authDomain: "trip-planner-app-cc72c.firebaseapp.com",
  projectId: "trip-planner-app-cc72c",
  storageBucket: "trip-planner-app-cc72c.appspot.com",
  messagingSenderId: "1063594141232",
  appId: "1:1063594141232:web:1dbba9b9722b20ff602ff5",
  measurementId: "G-2G3Z6WMLF6"
};
const ipFbApp = firebase.initializeApp(ipFirebaseConfig, 'itineraryPlannerApp');
const ipDb = firebase.firestore(ipFbApp);

const ip_travelEmojis = [
    { value: "", display: "아이콘 없음" }, { value: "💆🏻", display: "💆🏻 마사지" }, { value: "✈️", display: "✈️ 항공" }, { value: "🏨", display: "🏨 숙소" }, { value: "🍽️", display: "🍽️ 식사" }, { value: "🏛️", display: "🏛️ 관광(실내)" }, { value: "🏞️", display: "🏞️ 관광(야외)" }, { value: "🚶", display: "🚶 이동(도보)" }, { value: "🚌", display: "🚌 이동(버스)" }, { value: "🚆", display: "🚆 이동(기차)" }, { value: "🚢", display: "🚢 이동(배)" }, { value: "🚕", display: "🚕 이동(택시)" }, { value: "🛍️", display: "🛍️ 쇼핑" }, { value: "📷", display: "📷 사진촬영" }, { value: "🗺️", display: "🗺️ 계획/지도" }, { value: "📌", display: "📌 중요장소" }, { value: "☕", display: "☕ 카페/휴식" }, { value: "🎭", display: "🎭 공연/문화" }, { value: "💼", display: "💼 업무" }, { value: "ℹ️", display: "ℹ️ 정보" }
];
const ip_editIconSVG = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>`;
const ip_saveIconSVG = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
const ip_cancelIconSVG = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
const ip_deleteIconSVG = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
const ip_duplicateIconSVG = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`;

function ip_generateId() { return 'id_' + Math.random().toString(36).substr(2, 9); }
function dateToYyyyMmDd(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1); let dayVal = '' + d.getDate(); const year = d.getFullYear();
    if (month.length < 2) month = '0' + month; if (dayVal.length < 2) dayVal = '0' + dayVal;
    return [year, month, dayVal].join('-');
}
function ip_formatDate(dateString, dayNumber) { return `DAY ${dayNumber}`; }
function ip_formatTimeToHHMM(timeStr) {
    if (timeStr && timeStr.length === 4 && /^\d{4}$/.test(timeStr)) {
        const hours = timeStr.substring(0, 2); const minutes = timeStr.substring(2, 4);
        if (parseInt(hours, 10) >= 0 && parseInt(hours, 10) <= 23 && parseInt(minutes, 10) >= 0 && parseInt(minutes, 10) <= 59) return `${hours}:${minutes}`;
    }
    return "";
}
function ip_isValidDateString(dateString) { if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false; const parts = dateString.split("-"); const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10); const day = parseInt(parts[2], 10); if (year < 1000 || year > 3000 || month === 0 || month > 12) return false; const monthLength = [31, (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; return !(day === 0 || day > monthLength[month - 1]); }
function ip_parseAndValidateDateInput(inputValue) { let dateStr = inputValue.trim(); if (/^\d{8}$/.test(dateStr)) { dateStr = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`; } else if (/^\d{6}$/.test(dateStr)) { const currentYearPrefix = new Date().getFullYear().toString().substring(0, 2); dateStr = `${currentYearPrefix}${dateStr.substring(0, 2)}-${dateStr.substring(2, 4)}-${dateStr.substring(4, 6)}`; } else if (/^\d{4}[./]\d{2}[./]\d{2}$/.test(dateStr)) { dateStr = dateStr.replace(/[./]/g, '-'); } return ip_isValidDateString(dateStr) ? dateStr : null; }

function initializeItineraryPlannerForGroup(container, groupId) {
    container.innerHTML = `
        <header class="ip-header sticky top-0 z-10 py-3 px-4 -mx-4 mb-4 bg-white/80 backdrop-blur-sm">
            <div class="flex justify-between items-center h-[50px]">
                <div id="ip-headerTitleSection-${groupId}" class="ip-header-title-container"></div>
                <div class="flex items-center space-x-2">
                    <button id="ip-loadFromDBBtn-${groupId}" class="btn btn-sm btn-primary" title="DB에서 일정 불러오기"><i class="fas fa-database"></i><span class="inline ml-2">DB 불러오기</span></button>
                    <button id="ip-copyInlineHtmlButton-${groupId}" class="btn btn-sm btn-outline" title="일정표 코드 복사"><i class="fas fa-copy"></i> 코드 복사</button>
                    <button id="ip-inlinePreviewButton-${groupId}" class="btn btn-sm btn-primary" title="인라인 형식 미리보기"><i class="fas fa-eye"></i> 미리보기</button>
                </div>
            </div>
        </header>
        <main class="ip-main-content">
            <div id="ip-daysContainer-${groupId}" class="space-y-4"></div>
            <div class="add-day-button-container mt-6 text-center">
                <button id="ip-addDayButton-${groupId}" class="btn btn-indigo"><i class="fas fa-plus mr-2"></i>새 날짜 추가</button>
            </div>
        </main>
    `;
    container.querySelector(`#ip-addDayButton-${groupId}`).addEventListener('click', () => ip_addDay(groupId));
    container.querySelector(`#ip-copyInlineHtmlButton-${groupId}`).addEventListener('click', () => ip_handleCopyInlineHtml(groupId));
    container.querySelector(`#ip-inlinePreviewButton-${groupId}`).addEventListener('click', () => ip_handleInlinePreview(groupId));
    container.querySelector(`#ip-loadFromDBBtn-${groupId}`).addEventListener('click', () => ip_openLoadTripModal(groupId));
    container.querySelector(`#ip-daysContainer-${groupId}`).addEventListener('dblclick', (event) => ip_handleActivityDoubleClick(event, groupId));
    ip_render(groupId);
}

function ip_render(groupId) {
    const container = document.getElementById(`itinerary-planner-container-${groupId}`);
    if (!container) return;
    ip_renderHeaderTitle(groupId, container);
    ip_renderDays(groupId, container);
}
function ip_renderHeaderTitle(groupId, container) {
    const itineraryData = quoteGroupsData[groupId].itineraryData;
    const headerTitleSection = container.querySelector(`#ip-headerTitleSection-${groupId}`);
    if (!headerTitleSection) return;
    headerTitleSection.innerHTML = '';
    if (itineraryData.editingTitle) {
        const input = document.createElement('input'); input.type = 'text'; input.className = 'ip-header-title-input'; input.value = itineraryData.title;
        const saveButton = document.createElement('button'); saveButton.className = 'icon-button'; saveButton.title = '제목 저장'; saveButton.innerHTML = ip_saveIconSVG; saveButton.addEventListener('click', () => ip_handleSaveTripTitle(groupId));
        const cancelButton = document.createElement('button'); cancelButton.className = 'icon-button'; cancelButton.title = '취소'; cancelButton.innerHTML = ip_cancelIconSVG; cancelButton.addEventListener('click', () => ip_handleCancelTripTitleEdit(groupId));
        headerTitleSection.append(input, saveButton, cancelButton); input.focus();
    } else {
        const titleH1 = document.createElement('h1'); titleH1.className = 'text-2xl font-bold'; titleH1.textContent = itineraryData.title;
        const editButton = document.createElement('button'); editButton.className = 'icon-button ml-2'; editButton.title = '여행 제목 수정'; editButton.innerHTML = ip_editIconSVG; editButton.addEventListener('click', () => ip_handleEditTripTitle(groupId));
        headerTitleSection.append(titleH1, editButton);
    }
}
function ip_renderDays(groupId, container) {
    const itineraryData = quoteGroupsData[groupId].itineraryData;
    const daysContainer = container.querySelector(`#ip-daysContainer-${groupId}`);
    daysContainer.innerHTML = '';
    (itineraryData.days || []).forEach((day, dayIndex) => {
        const daySection = document.createElement('div');
        daySection.className = 'ip-day-section day-section'; daySection.dataset.dayId = `day-${dayIndex}`;
        const expandedIcon = `<svg class="toggle-icon w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
        const collapsedIcon = `<svg class="toggle-icon w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
        let dateDisplayHTML = day.editingDate
            ? `<input type="text" class="date-edit-input-text" value="${day.date}" placeholder="YYYY-MM-DD"><button class="save-date-button icon-button" title="날짜 저장">${ip_saveIconSVG}</button><button class="cancel-date-edit-button icon-button" title="취소">${ip_cancelIconSVG}</button>`
            : `<h2 class="day-header-title">${ip_formatDate(day.date, dayIndex + 1)}</h2><button class="edit-date-button icon-button ml-2" title="날짜 수정">${ip_editIconSVG}</button>`;
        daySection.innerHTML = `<div class="ip-day-header-container day-header-container"><div class="ip-day-header-main">${dateDisplayHTML}</div><div class="ip-day-header-controls"><button class="delete-day-button icon-button" title="이 날짜 삭제">${ip_deleteIconSVG}</button><button class="day-toggle-button icon-button">${day.isCollapsed ? collapsedIcon : expandedIcon}</button></div></div><div class="day-content-wrapper ${day.isCollapsed ? 'hidden' : ''}"><div class="activities-list ip-activities-list pt-4" data-day-index="${dayIndex}"></div><button class="add-activity-button mt-4 ml-2 btn btn-sm btn-outline"><i class="fas fa-plus mr-1"></i>일정 추가</button></div>`;
        daysContainer.appendChild(daySection);
        const activitiesList = daySection.querySelector('.activities-list');
        ip_renderActivities(activitiesList, day.activities, dayIndex, groupId);
        if (day.editingDate) {
            daySection.querySelector('.save-date-button').addEventListener('click', (e) => ip_handleSaveDate(dayIndex, groupId, e.currentTarget.previousElementSibling.value));
            daySection.querySelector('.cancel-date-edit-button').addEventListener('click', () => ip_handleCancelDateEdit(dayIndex, groupId));
        } else {
            daySection.querySelector('.edit-date-button').addEventListener('click', () => ip_handleEditDate(dayIndex, groupId));
        }
        daySection.querySelector('.delete-day-button').addEventListener('click', () => ip_showConfirmDeleteDayModal(dayIndex, groupId));
        daySection.querySelector('.day-toggle-button').addEventListener('click', (e) => ip_handleToggleDayCollapse(e, dayIndex, groupId));
        daySection.querySelector('.add-activity-button').addEventListener('click', () => ip_openActivityModal(groupId, dayIndex));
    });
    if (typeof Sortable !== 'undefined') {
        new Sortable(daysContainer, { handle: '.day-header-container', animation: 150, ghostClass: 'sortable-ghost', onEnd: (evt) => { const itineraryData = quoteGroupsData[groupId].itineraryData; const movedDay = itineraryData.days.splice(evt.oldIndex, 1)[0]; itineraryData.days.splice(evt.newIndex, 0, movedDay); ip_recalculateAllDates(groupId); ip_render(groupId); } });
        daysContainer.querySelectorAll('.activities-list').forEach(list => { new Sortable(list, { group: `shared-activities-${groupId}`, handle: '.ip-activity-card', animation: 150, ghostClass: 'sortable-ghost', onEnd: (evt) => { const fromDayIndex = parseInt(evt.from.dataset.dayIndex); const toDayIndex = parseInt(evt.to.dataset.dayIndex); const itineraryData = quoteGroupsData[groupId].itineraryData; const movedActivity = itineraryData.days[fromDayIndex].activities.splice(evt.oldIndex, 1)[0]; itineraryData.days[toDayIndex].activities.splice(evt.newIndex, 0, movedActivity); ip_render(groupId); } }); });
    }
}
function ip_renderActivities(activitiesListElement, activities, dayIndex, groupId) {
    activitiesListElement.innerHTML = '';
    (activities || []).forEach((activity, activityIndex) => {
        const card = document.createElement('div'); card.className = 'ip-activity-card activity-card';
        card.dataset.activityId = activity.id; card.dataset.dayIndex = dayIndex; card.dataset.activityIndex = activityIndex;
        let imageHTML = activity.imageUrl ? `<img src="${activity.imageUrl}" alt="${activity.title}" class="ip-card-image card-image" onerror="this.style.display='none';">` : '';
        const descHTML = activity.description ? `<div class="card-description">${activity.description.replace(/\n/g, '<br>')}</div>` : '';
        let locationText = activity.locationLink;
        if (locationText && locationText.length > 35) { locationText = locationText.substring(0, 32) + '...'; }
        const locHTML = activity.locationLink ? `<div class="card-location">📍 <a href="${activity.locationLink}" target="_blank" title="${activity.locationLink}">${locationText}</a></div>` : '';
        const costHTML = activity.cost ? `<div class="card-cost">💰 ${activity.cost}</div>` : '';
        const notesHTML = activity.notes ? `<div class="card-notes">📝 ${activity.notes.replace(/\n/g, '<br>')}</div>` : '';
        card.innerHTML = `<div class="card-time-icon-area"><div class="card-icon">${activity.icon||'&nbsp;'}</div><div class="card-time" data-time-value="${activity.time||''}">${ip_formatTimeToHHMM(activity.time)}</div></div><div class="card-details-area"><div class="card-title">${activity.title||''}</div>${descHTML}${imageHTML}${locHTML}${costHTML}${notesHTML}</div><div class="card-actions-direct"><button class="icon-button edit-activity-button" title="수정">${ip_editIconSVG}</button><button class="icon-button duplicate-activity-button" title="복제">${ip_duplicateIconSVG}</button><button class="icon-button delete-activity-button" title="삭제">${ip_deleteIconSVG}</button></div>`;
        activitiesListElement.appendChild(card);
    });
    activitiesListElement.addEventListener('click', e => {
        const button = e.target.closest('button'); if (!button) return;
        const card = button.closest('.ip-activity-card'); if (!card) return;
        const dayIdx = parseInt(card.dataset.dayIndex); const activityIdx = parseInt(card.dataset.activityIndex);
        if (button.classList.contains('edit-activity-button')) ip_openActivityModal(groupId, dayIdx, activityIdx);
        else if (button.classList.contains('delete-activity-button')) ip_handleDeleteActivity(groupId, dayIdx, activityIdx);
        else if (button.classList.contains('duplicate-activity-button')) ip_handleDuplicateActivity(groupId, dayIdx, activityIdx);
    });
}

function ip_addDay(groupId) {
    const itineraryData = quoteGroupsData[groupId].itineraryData; let newDate;
    if (itineraryData.days.length > 0) { const lastDate = new Date(itineraryData.days[itineraryData.days.length - 1].date + "T00:00:00Z"); newDate = new Date(lastDate.setDate(lastDate.getDate() + 1)); } else { newDate = new Date(); }
    itineraryData.days.push({ date: dateToYyyyMmDd(newDate), activities: [], isCollapsed: false, editingDate: false });
    ip_render(groupId);
}
function ip_handleDeleteActivity(groupId, dayIndex, activityIndex) { if (confirm("이 일정을 삭제하시겠습니까?")) { quoteGroupsData[groupId].itineraryData.days[dayIndex].activities.splice(activityIndex, 1); ip_render(groupId); } }
function ip_handleDuplicateActivity(groupId, dayIndex, activityIndex) {
    const itineraryData = quoteGroupsData[groupId].itineraryData;
    const activityToDuplicate = itineraryData.days[dayIndex].activities[activityIndex];
    if (activityToDuplicate) { const newActivity = JSON.parse(JSON.stringify(activityToDuplicate)); newActivity.id = ip_generateId(); newActivity.title = `${newActivity.title} (복사본)`; itineraryData.days[dayIndex].activities.splice(activityIndex + 1, 0, newActivity); ip_render(groupId); }
}
function ip_handleEditTripTitle(groupId) { quoteGroupsData[groupId].itineraryData.editingTitle = true; ip_render(groupId); }
function ip_handleSaveTripTitle(groupId) { const container = document.getElementById(`itinerary-planner-container-${groupId}`); const input = container.querySelector(`#ip-headerTitleSection-${groupId} input`); quoteGroupsData[groupId].itineraryData.title = input.value; quoteGroupsData[groupId].itineraryData.editingTitle = false; ip_render(groupId); }
function ip_handleCancelTripTitleEdit(groupId) { quoteGroupsData[groupId].itineraryData.editingTitle = false; ip_render(groupId); }
function ip_handleEditDate(dayIndex, groupId) { quoteGroupsData[groupId].itineraryData.days.forEach((day, index) => { day.editingDate = (index === dayIndex); }); ip_render(groupId); }
function ip_handleSaveDate(dayIndex, groupId, dateValue) {
    const validatedDate = ip_parseAndValidateDateInput(dateValue);
    if (validatedDate) {
        quoteGroupsData[groupId].itineraryData.days[dayIndex].date = validatedDate;
        quoteGroupsData[groupId].itineraryData.days[dayIndex].editingDate = false;
        ip_recalculateAllDates(groupId); ip_render(groupId);
    } else { showToastMessage("잘못된 날짜 형식입니다. (YYYY-MM-DD)", true); }
}
function ip_handleCancelDateEdit(dayIndex, groupId) { quoteGroupsData[groupId].itineraryData.days[dayIndex].editingDate = false; ip_render(groupId); }
function ip_handleToggleDayCollapse(event, dayIndex, groupId) {
    const day = quoteGroupsData[groupId].itineraryData.days[dayIndex]; if (day.editingDate) return; day.isCollapsed = !day.isCollapsed; ip_render(groupId);
}
function ip_handleActivityDoubleClick(event, groupId) {
    const card = event.target.closest('.ip-activity-card');
    if (card) { ip_openActivityModal(groupId, parseInt(card.dataset.dayIndex), parseInt(card.dataset.activityIndex)); }
}

function ip_openActivityModal(groupId, dayIndex, activityIndex = -1) {
    const modal = document.getElementById('ipActivityModal'); const form = document.getElementById('ipActivityForm');
    modal.querySelector('#ipModalTitle').textContent = activityIndex > -1 ? '일정 수정' : '새 일정 추가';
    form.reset();
    form.querySelector('#ipActivityDayIndex').value = dayIndex; form.querySelector('#ipActivityIndex').value = activityIndex; form.querySelector('#ipGroupId').value = groupId;
    const activityIconSelect = document.getElementById('ipActivityIconSelect');
    activityIconSelect.innerHTML = ip_travelEmojis.map(emoji => `<option value="${emoji.value}">${emoji.display}</option>`).join('');
    if (activityIndex > -1) {
        const activity = quoteGroupsData[groupId].itineraryData.days[dayIndex].activities[activityIndex];
        Object.keys(activity).forEach(key => { const input = form.querySelector(`#ipActivity${key.charAt(0).toUpperCase() + key.slice(1)}`); if (input) input.value = activity[key] || ''; });
    }
    modal.classList.remove('hidden');
}
function ip_handleActivityFormSubmit(event) {
    event.preventDefault(); const form = event.target;
    const groupId = form.querySelector('#ipGroupId').value; const dayIndex = parseInt(form.querySelector('#ipActivityDayIndex').value); const activityIndex = parseInt(form.querySelector('#ipActivityIndex').value);
    let timeValue = form.querySelector('#ipActivityTimeInput').value.trim();
    if (timeValue && (timeValue.length !== 4 || !/^\d{4}$/.test(timeValue))) { showToastMessage("시간은 HHMM 형식의 4자리 숫자로 입력하세요.", true); return; }
    const itineraryData = quoteGroupsData[groupId].itineraryData;
    const activityData = {
        id: (activityIndex > -1 ? itineraryData.days[dayIndex].activities[activityIndex].id : ip_generateId()),
        time: timeValue, icon: form.querySelector('#ipActivityIconSelect').value, title: form.querySelector('#ipActivityTitle').value,
        description: form.querySelector('#ipActivityDescription').value, locationLink: form.querySelector('#ipActivityLocation').value,
        imageUrl: form.querySelector('#ipActivityImageUrl').value, cost: form.querySelector('#ipActivityCost').value, notes: form.querySelector('#ipActivityNotes').value,
    };
    if (activityIndex > -1) itineraryData.days[dayIndex].activities[activityIndex] = activityData;
    else itineraryData.days[dayIndex].activities.push(activityData);
    document.getElementById('ipActivityModal').classList.add('hidden'); ip_render(groupId);
}
function ip_showConfirmDeleteDayModal(dayIndex, groupId) {
    const modal = document.getElementById('ipConfirmDeleteDayModal');
    modal.querySelector('#ipConfirmDeleteDayMessage').textContent = `DAY ${dayIndex + 1} 일정을 정말 삭제하시겠습니까?`;
    modal.classList.remove('hidden');
    const confirmBtn = document.getElementById('ipConfirmDeleteDayActionButton');
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener('click', () => {
        quoteGroupsData[groupId].itineraryData.days.splice(dayIndex, 1); ip_recalculateAllDates(groupId); ip_render(groupId); modal.classList.add('hidden');
    }, { once: true });
}

async function ip_handleCopyInlineHtml(groupId) {
    const html = ip_generateInlineStyledHTML(quoteGroupsData[groupId].itineraryData, { 
        includeStyles: false, 
        makePageTitleEmptyForCopy: true 
    });

    try {
        const blobHtml = new Blob([html], { type: 'text/html' });
        const blobText = new Blob([html], { type: 'text/plain' });
        await navigator.clipboard.write([
            new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })
        ]);
        showToastMessage('일정표 HTML이 클립보드에 복사되었습니다.');
    } catch (err) {
        console.error("HTML 복사 실패, 텍스트로 재시도:", err);
        try {
            await navigator.clipboard.writeText(html);
            showToastMessage('일정표 코드가 텍스트로 복사되었습니다 (HTML 형식 복사 실패).');
        } catch (fallbackErr) {
            showToastMessage('클립보드 복사에 최종적으로 실패했습니다.', true);
        }
    }
}
function ip_handleInlinePreview(groupId) {
    const html = ip_generateInlineStyledHTML(quoteGroupsData[groupId].itineraryData, { includeStyles: true });
    const previewWindow = window.open('', '_blank');
    if (previewWindow) { previewWindow.document.write(html); previewWindow.document.close(); } else { showToastMessage("팝업이 차단되었습니다.", true); }
}
function ip_generateInlineStyledHTML(itineraryData, options = {}) {
    let daysHTML = '';
    (itineraryData.days || []).forEach((day, dayIndex) => {
        let activitiesHTML = (day.activities || []).map(activity => {
            const imageHTML = activity.imageUrl ? `<details open style="margin-top:8px;"><summary style="font-size:12px;color:#007bff;cursor:pointer;display:inline-block;">🖼️ 사진</summary><img src="${activity.imageUrl}" alt="${activity.title}" style="max-width:300px;height:auto;border-radius:4px;margin-top:8px;" onerror="this.style.display='none';"></details>` : '';
            const locationHTML = activity.locationLink ? `<div style="font-size:12px;margin-top:4px;">📍 <a href="${activity.locationLink}" target="_blank" rel="noopener noreferrer" style="color:#007bff;text-decoration:none;">위치 보기</a></div>` : '';
            const costHTML = activity.cost ? `<div style="font-size:12px;margin-top:4px;">💰 ${activity.cost}</div>` : '';
            const notesHTML = activity.notes ? `<div style="font-size:12px;margin-top:4px;white-space:pre-wrap;">📝 ${activity.notes.replace(/\n/g, '<br>')}</div>` : '';
            const descHTML = activity.description ? `<div style="font-size:12px;white-space:pre-wrap;">${activity.description.replace(/\n/g, '<br>')}</div>` : '';
            return `<div style="background-color:white;border-radius:8px;border:1px solid #E0E0E0;padding:16px;margin-bottom:16px;display:flex;"><div style="width:100px;flex-shrink:0;"><div style="font-size:20px;margin-bottom:4px;">${activity.icon || '&nbsp;'}</div><div style="font-size:12px;font-weight:bold;">${ip_formatTimeToHHMM(activity.time) || '&nbsp;'}</div></div><div style="flex-grow:1;"><div style="font-size:13px;font-weight:bold;">${activity.title || ''}</div>${descHTML}${imageHTML}${locationHTML}${costHTML}${notesHTML}</div></div>`;
        }).join('');
        
        daysHTML += `<div style="margin-bottom: 16px;"><details ${day.isCollapsed ? '' : 'open'}><summary style="display: flex; align-items: center; padding: 12px 8px; border-bottom: 1px solid #EEE; background-color: #fdfdfd; cursor: pointer;"><h2 style="font-size: 14px; font-weight: 600; margin:0;">${ip_formatDate(day.date, dayIndex + 1)}</h2></summary><div style="padding: 8px;"><div style="padding-top: .75rem;">${activitiesHTML || '<p style="font-size:12px;color:#777;">일정이 없습니다.</p>'}</div></div></details></div>`;
    });

    const styles = `body{font-family:-apple-system,sans-serif;margin:0;background:#f8f9fa;}main{max-width:768px;margin:auto;padding:1rem;}header{background:white;border-bottom:1px solid #E0E0E0;padding:1rem;text-align:center;}h1{font-size:18px;font-weight:bold;margin:0;}h2{font-size:14px;font-weight:600;margin:0;}summary{list-style:none;}summary::-webkit-details-marker{display:none;}`;
    const styleTagHTML = options.includeStyles ? `<style>${styles}</style>` : '';

    const pageDocumentTitle = options.makePageTitleEmptyForCopy ? ' ' : (itineraryData.title || "여행 일정");
    
    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>${pageDocumentTitle}</title>${styleTagHTML}</head><body><header><h1>${itineraryData.title}</h1></header><main>${daysHTML}</main></body></html>`;
}
function ip_recalculateAllDates(groupId) {
    const itineraryData = quoteGroupsData[groupId].itineraryData;
    if (itineraryData.days && itineraryData.days.length > 0 && itineraryData.days[0].date) {
        let currentDate = new Date(itineraryData.days[0].date + "T00:00:00Z");
        for (let i = 0; i < itineraryData.days.length; i++) {
            itineraryData.days[i].date = dateToYyyyMmDd(currentDate);
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }
}
async function ip_openLoadTripModal(groupId) {
    const modal = document.getElementById('ipLoadTemplateModal');
    modal.classList.remove('hidden');
    const listEl = modal.querySelector('#ipTemplateList');
    const loadingMsg = modal.querySelector('#ipLoadingTemplateMsg');
    const searchInput = modal.querySelector('#ipTemplateSearchInput');
    listEl.innerHTML = ''; loadingMsg.style.display = 'block'; searchInput.value = '';
    try {
        const querySnapshot = await ipDb.collection("tripplan").orderBy("title").get();
        const templates = [];
        querySnapshot.forEach(doc => templates.push({ id: doc.id, ...doc.data() }));
        loadingMsg.style.display = 'none';
        
        const renderList = (sets) => {
            listEl.innerHTML = sets.length ? '' : '<li class="p-3 text-center text-gray-500">템플릿이 없습니다.</li>';
            sets.forEach(template => {
                const li = document.createElement('li');
                li.className = 'p-3 hover:bg-gray-100 cursor-pointer';
                li.textContent = template.title;
                li.onclick = () => {
                    if (confirm(`'${template.title}' 일정을 현재 견적에 불러오시겠습니까?\n(기존 일정은 모두 교체됩니다.)`)) {
                        ip_loadTripFromFirestore(template.id, groupId);
                        modal.classList.add('hidden');
                    }
                };
                listEl.appendChild(li);
            });
        };
        
        searchInput.oninput = () => renderList(templates.filter(t => t.title.toLowerCase().includes(searchInput.value.toLowerCase())));
        renderList(templates);

    } catch (error) { loadingMsg.textContent = "템플릿 목록 로딩 실패"; showToastMessage("템플릿 로딩 중 오류 발생", true); }
}
async function ip_loadTripFromFirestore(tripId, groupId) {
    try {
        const doc = await ipDb.collection("tripplan").doc(tripId).get();
        if (doc.exists) {
            const loadedData = doc.data();
            quoteGroupsData[groupId].itineraryData = {
                title: loadedData.title || "제목 없음",
                days: (loadedData.days || []).map((day, index) => ({...day, editingDate: false, isCollapsed: index !== 0 })),
                editingTitle: false
            };
            showToastMessage(`'${loadedData.title}' 일정을 불러왔습니다.`);
            ip_render(groupId);
        } else { showToastMessage("선택한 일정을 찾을 수 없습니다.", true); }
    } catch(error) { showToastMessage("일정 불러오기 중 오류 발생", true); console.error(error); }
}

// =======================================================================
// 6. 핵심 기능 함수 (메인 앱 함수들)
// =======================================================================
function createCustomerCard(initialData = { name: '', phone: '', email: '' }) {
    const container = document.getElementById('customerInfoContainer');
    if (!container) return;
    const cardId = `customer_${Date.now()}`;
    const card = document.createElement('div');
    card.className = 'p-4 border border-gray-200 rounded-lg relative flex-grow sm:flex-grow-0 sm:min-w-[300px]';
    card.id = cardId;
    card.innerHTML = `<button type="button" class="absolute top-1 right-1 text-gray-400 hover:text-red-500 text-xs remove-customer-btn p-1" title="고객 삭제"><i class="fas fa-times"></i></button><div class="space-y-3 text-sm"><div class="flex items-center gap-2"><label for="customerName_${cardId}" class="font-medium text-gray-800 w-12 text-left flex-shrink-0">고객명</label><input type="text" id="customerName_${cardId}" class="w-full flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm" data-field="name" value="${initialData.name}"><button type="button" class="inline-copy-btn copy-customer-info-btn" title="고객명 복사"><i class="far fa-copy"></i></button></div><div class="flex items-center gap-2"><label for="customerPhone_${cardId}" class="font-medium text-gray-800 w-12 text-left flex-shrink-0">연락처</label><input type="tel" id="customerPhone_${cardId}" class="w-full flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm" data-field="phone" value="${initialData.phone}"><button type="button" class="inline-copy-btn copy-customer-info-btn" title="연락처 복사"><i class="far fa-copy"></i></button></div><div class="flex items-center gap-2"><label for="customerEmail_${cardId}" class="font-medium text-gray-800 w-12 text-left flex-shrink-0">이메일</label><input type="email" id="customerEmail_${cardId}" class="w-full flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm" data-field="email" value="${initialData.email}"><button type="button" class="inline-copy-btn copy-customer-info-btn" title="이메일 복사"><i class="far fa-copy"></i></button></div></div>`;
    container.appendChild(card);
    card.querySelectorAll('input').forEach(input => {
        input.addEventListener('dblclick', (event) => {
            const label = event.target.previousElementSibling ? event.target.previousElementSibling.textContent : '입력 필드';
            copyToClipboard(event.target.value, label);
        });
    });
    card.querySelectorAll('.copy-customer-info-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const inputElement = event.currentTarget.previousElementSibling;
            const labelElement = inputElement.previousElementSibling;
            const textToCopy = inputElement.value;
            const fieldName = labelElement ? labelElement.textContent : '고객 정보';
            copyToClipboard(textToCopy, fieldName);
        });
    });
    card.querySelector('.remove-customer-btn').addEventListener('click', () => { card.remove(); });
}
function getCustomerData() {
    const customers = [];
    const container = document.getElementById('customerInfoContainer');
    if (container) {
        container.querySelectorAll('.p-4').forEach(card => {
            const nameInput = card.querySelector('[data-field="name"]');
            const phoneInput = card.querySelector('[data-field="phone"]');
            const emailInput = card.querySelector('[data-field="email"]');
            if (nameInput && (nameInput.value.trim() || phoneInput.value.trim() || emailInput.value.trim())) {
                customers.push({ name: nameInput.value, phone: phoneInput.value, email: emailInput.value });
            }
        });
    }
    return customers;
}

const evaluateMath = (expression) => { 
    if (typeof expression !== 'string' || !expression) return 0; 
    const formula = expression.startsWith('=') ? expression.substring(1) : expression;
    const s = formula.replace(/,/g, ''); 
    if (!/^[0-9+\-*/().\s]+$/.test(s)) { 
        return parseFloat(s) || 0; 
    } 
    try { 
        return new Function('return ' + s)(); 
    } catch (e) { 
        return parseFloat(s) || 0; 
    } 
};
const formatCurrency = (amount) => new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + ' 원';
const formatPercentage = (value) => (isNaN(value) || !isFinite(value) ? 0 : value * 100).toFixed(2) + ' %';
const copyHtmlToClipboard = (htmlString) => {
    if (!htmlString || htmlString.trim() === "") { showToastMessage('복사할 내용이 없습니다.', true); return; }
    navigator.clipboard.writeText(htmlString).then(() => showToastMessage('HTML 소스 코드가 클립보드에 복사되었습니다.'))
    .catch(err => { console.error('클립보드 복사 실패:', err); showToastMessage('복사에 실패했습니다.', true); });
};
function copyToClipboard(text, fieldName = '텍스트') {
    if (!text || text.trim() === "") { showToastMessage('복사할 내용이 없습니다.', true); return; }
    navigator.clipboard.writeText(text).then(() => {
        showToastMessage(`'${text}' (${fieldName}) 클립보드에 복사되었습니다.`);
    }).catch(err => { console.error('클립보드 복사 실패:', err); showToastMessage('복사에 실패했습니다.', true); });
}
function showToastMessage(message, isError = false) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `p-3 mb-2 rounded-md shadow-lg text-white text-sm opacity-0 transition-opacity duration-300 transform translate-y-4`;
    toast.style.backgroundColor = isError ? '#dc2626' : '#10B981';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-4');
        toast.classList.add('opacity-100', 'translate-y-0');
    }, 10);
    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', 'translate-y-4');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, 3000);
}

function syncGroupUIToData(groupId) {
    if (!groupId || !quoteGroupsData[groupId]) return;
    const groupEl = document.getElementById(`group-content-${groupId}`);
    if (!groupEl) return;

    groupEl.querySelectorAll('.calculator-instance').forEach(instance => {
        const calcId = instance.dataset.calculatorId;
        const calculatorData = quoteGroupsData[groupId].calculators.find(c => c.id === calcId);
        if (!calculatorData) return;

        const pnrTextarea = instance.querySelector('.pnr-pane textarea');
        if (pnrTextarea) {
            calculatorData.pnr = pnrTextarea.value;
        }

        const table = instance.querySelector('.quote-table');
        if (table) {
            const tableClone = table.cloneNode(true);

            tableClone.querySelectorAll('[data-event-bound]').forEach(el => {
                el.removeAttribute('data-event-bound');
            });
             tableClone.querySelectorAll('[data-dblclick-bound]').forEach(el => {
                el.removeAttribute('data-dblclick-bound');
            });
            
            const originalInputs = table.querySelectorAll('input[type="text"]');
            const clonedInputs = tableClone.querySelectorAll('input[type="text"]');
            originalInputs.forEach((originalInput, index) => {
                if (clonedInputs[index]) {
                    clonedInputs[index].setAttribute('value', originalInput.value);
                }
            });

            calculatorData.tableHTML = tableClone.innerHTML;
        }
    });

    hm_syncCurrentHotelData(groupId);
}

async function getSaveDataBlob() {
    if (activeGroupId) {
        syncGroupUIToData(activeGroupId);
    }
    const allData = {
        quoteGroupsData,
        groupCounter,
        activeGroupId,
        memoText: document.getElementById('memoText').value,
        customerInfo: getCustomerData()
    };
    const doc = document.cloneNode(true);
    try {
        const styleResponse = await fetch('./style.css');
        const styleText = await styleResponse.text();
        const scriptResponse = await fetch('./script.js');
        const scriptText = await scriptResponse.text();
        const styleTag = document.createElement('style');
        styleTag.textContent = styleText;
        doc.head.querySelector('link[href="style.css"]')?.replaceWith(styleTag);
        const scriptTag = document.createElement('script');
        scriptTag.textContent = scriptText;
        doc.body.querySelector('script[src="script.js"]')?.replaceWith(scriptTag);
        const dataScriptTag = doc.getElementById('restored-data');
        if (dataScriptTag) { dataScriptTag.textContent = JSON.stringify(allData); }
        return new Blob([doc.documentElement.outerHTML], { type: 'text/html' });
    } catch (error) {
        console.error("CSS 또는 JS 파일을 포함하는 중 오류 발생:", error);
        showToastMessage("저장 준비 중 오류가 발생했습니다. 외부 파일을 읽을 수 없습니다.", true);
        return null;
    }
}
async function saveFile(isSaveAs = false, clickedButton = null) {
    const saveBtn = document.getElementById('saveBtn');
    const saveAsBtn = document.getElementById('saveAsBtn');
    const originalBtnHTML = clickedButton ? clickedButton.innerHTML : '';
    saveBtn.disabled = true;
    saveAsBtn.disabled = true;
    if (clickedButton) { clickedButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>저장 중...`; }
    try {
        const blob = await getSaveDataBlob();
        if (!blob) throw new Error("Blob 생성 실패");
        if (isSaveAs || !currentFileHandle) {
            const newHandle = await window.showSaveFilePicker({
                suggestedName: `견적서_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.html`,
                types: [{ description: 'HTML 파일', accept: { 'text/html': ['.html'] } }]
            });
            const writableStream = await newHandle.createWritable();
            await writableStream.write(blob);
            await writableStream.close();
            currentFileHandle = newHandle;
            document.title = newHandle.name;
            showToastMessage('파일이 성공적으로 저장되었습니다.');
            await saveFileHandle(newHandle.name, newHandle);
        } else {
            const writableStream = await currentFileHandle.createWritable();
            await writableStream.write(blob);
            await writableStream.close();
            showToastMessage('변경사항이 성공적으로 저장되었습니다.');
            await saveFileHandle(currentFileHandle.name, currentFileHandle);
        }
    } catch (err) {
        if (err.name !== 'AbortError') { console.error('파일 저장 실패:', err); showToastMessage('파일 저장에 실패했습니다.', true); }
    } finally {
        saveBtn.disabled = false;
        saveAsBtn.disabled = false;
        if (clickedButton) { clickedButton.innerHTML = originalBtnHTML; }
    }
}
async function loadFile() {
    try {
        const [fileHandle] = await window.showOpenFilePicker({ types: [{ description: 'HTML 파일', accept: { 'text/html': ['.html'] } }] });
        const openInNew = confirm("파일을 새 창에서 여시겠습니까?\n'확인' = 새 창, '취소' = 현재 창");
        await loadDataIntoWindow(fileHandle, openInNew);
    } catch (err) {
        if (err.name !== 'AbortError') { console.error('파일 열기 실패:', err); showToastMessage('파일을 열지 못했습니다.', true); }
    }
}
async function loadDataIntoWindow(fileHandle, openInNewWindow) {
    try {
        if ((await fileHandle.queryPermission({ mode: 'read' })) !== 'granted') {
            if ((await fileHandle.requestPermission({ mode: 'read' })) !== 'granted') {
                showToastMessage('파일 읽기 권한이 필요합니다.', true);
                return;
            }
        }
        const file = await fileHandle.getFile();
        const contents = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(contents, 'text/html');
        const restoredDataScript = doc.getElementById('restored-data');
        if (restoredDataScript && restoredDataScript.textContent) {
            const restoredDataJSON = restoredDataScript.textContent;
            if (openInNewWindow) {
                const uniqueKey = `PWA_LOAD_DATA_${Date.now()}`;
                sessionStorage.setItem(uniqueKey, restoredDataJSON);
                const relativeUrl = `?loadDataKey=${uniqueKey}`;
                const newWindow = window.open(relativeUrl, '_blank');
                if (!newWindow) {
                    showToastMessage('팝업이 차단되어 새 창을 열 수 없습니다. 팝업 차단을 해제해주세요.', true);
                    sessionStorage.removeItem(uniqueKey);
                }
            } else {
                try {
                    const restoredData = JSON.parse(restoredDataJSON);
                    restoreState(restoredData);
                    currentFileHandle = fileHandle;
                    document.title = fileHandle.name;
                    showToastMessage(`'${fileHandle.name}' 파일을 현재 창에 로드했습니다.`);
                } catch (e) {
                    console.error("데이터 파싱 또는 상태 복원 실패:", e);
                    showToastMessage("파일 데이터를 처리하는 중 오류가 발생했습니다.", true);
                }
            }
        } else {
            showToastMessage('유효한 데이터가 포함된 견적서 파일이 아닙니다.', true);
        }
        await saveFileHandle(fileHandle.name, fileHandle);
    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error('파일 로딩 실패:', err);
            showToastMessage('파일을 열지 못했습니다.', true);
        }
    }
}

let recentFilesModal, recentFileSearchInput, recentFileListUl, loadingRecentFileListMsg, cancelRecentFilesModalButton, closeRecentFilesModalButton;

async function openRecentFilesModal() {
    if (!recentFilesModal || !recentFileListUl || !loadingRecentFileListMsg || !recentFileSearchInput) {
        showToastMessage("최근 파일 불러오기 UI가 준비되지 않았습니다.", true); return;
    }
    loadingRecentFileListMsg.style.display = 'block';
    recentFileListUl.innerHTML = '';
    recentFileSearchInput.value = '';
    recentFilesModal.classList.remove('hidden');

    const allHandles = await getAllFileHandles();
    loadingRecentFileListMsg.style.display = 'none';
    renderRecentFileList(allHandles, '');
    recentFileSearchInput.oninput = () => {
        renderRecentFileList(allHandles, recentFileSearchInput.value);
    };
}
function renderRecentFileList(fullList, searchTerm) {
    if (!recentFileListUl) return;
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    recentFileListUl.innerHTML = '';
    const filteredList = fullList.filter(item => item.name.toLowerCase().includes(lowerCaseSearchTerm));
    if (filteredList.length > 0) {
        filteredList.forEach(item => {
            const listItem = document.createElement('li');
            listItem.className = 'flex justify-between items-center p-3 hover:bg-gray-100 cursor-pointer';
            
            const titleSpan = document.createElement('span');
            titleSpan.textContent = item.name;
            titleSpan.className = 'text-sm font-medium text-gray-900 flex-grow';
            titleSpan.title = `"${item.name}" 파일 바로 불러오기 (클릭)`;
            titleSpan.addEventListener('click', async () => {
                try {
                    const handle = await getFileHandle(item.name);
                    if (handle) {
                        const openInNew = confirm("파일을 새 창에서 여시겠습니까?\n'확인' = 새 창, '취소' = 현재 창");
                        await loadDataIntoWindow(handle, openInNew);
                        recentFilesModal.classList.add('hidden');
                    } else { showToastMessage(`'${item.name}' 파일 핸들을 찾을 수 없습니다. 다시 선택해주세요.`, true); }
                } catch (e) { showToastMessage(`파일 로드 중 오류 발생: ${e.message}`, true); }
            });
            
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = `<svg class="w-5 h-5 text-gray-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
            deleteButton.className = 'p-1 rounded-full hover:bg-red-100 ml-2';
            deleteButton.title = `"${item.name}" 최근 파일 목록에서 삭제`;
            deleteButton.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`'${item.name}'을(를) 최근 파일 목록에서 삭제하시겠습니까?`)) {
                    await deleteFileHandle(item.name);
                    const allHandles = await getAllFileHandles();
                    renderRecentFileList(allHandles, recentFileSearchInput.value);
                    showToastMessage(`'${item.name}'이(가) 최근 파일 목록에서 삭제되었습니다.`);
                }
            });
            listItem.appendChild(titleSpan);
            listItem.appendChild(deleteButton);
            recentFileListUl.appendChild(listItem);
        });
    } else {
        recentFileListUl.innerHTML = `<li class="p-3 text-sm text-gray-500 text-center">최근 파일이 없거나, 검색 결과가 없습니다.</li>`;
    }
}
function renderFilteredList(options) {
    const { fullList, searchTerm, listElementId, clickHandler, itemTitleField = 'name' } = options;
    const listEl = document.getElementById(listElementId);
    if (!listEl) return;
    listEl.innerHTML = '';
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const filteredList = fullList.filter(item => item[itemTitleField].toLowerCase().includes(lowerCaseSearchTerm));
    if (filteredList.length > 0) {
        filteredList.forEach(item => {
            const li = document.createElement('li');
            li.className = 'p-3 hover:bg-gray-100 cursor-pointer text-sm';
            li.textContent = item[itemTitleField];
            li.addEventListener('click', () => clickHandler(item));
            listEl.appendChild(li);
        });
    } else {
        listEl.innerHTML = '<li class="p-3 text-gray-500 text-sm text-center">검색 결과가 없습니다.</li>';
    }
}

async function loadAllInclusionDataSets() {
    const dataSets = [];
    try {
        const q = db.collection("inclusionsExclusions").orderBy("timestamp", "desc");
        const querySnapshot = await q.get();
        querySnapshot.forEach((doc) => { dataSets.push({ id: doc.id, ...doc.data() }); });
        return dataSets;
    } catch (error) { console.error("목록 불러오기 오류:", error); showToastMessage("목록을 불러오는 중 오류가 발생했습니다.", true); return []; }
}
async function openLoadInclusionsModal() {
    if (!activeGroupId) { showToastMessage("견적 그룹을 먼저 선택해주세요.", true); return; }
    const modal = document.getElementById('loadInclusionsModal');
    const listEl = document.getElementById('inclusionsList');
    const loadingMsg = document.getElementById('loadingInclusionsMsg');
    const searchInput = document.getElementById('inclusionsSearchInput');
    searchInput.value = '';
    modal.classList.remove('hidden');
    listEl.innerHTML = '';
    loadingMsg.style.display = 'block';
    const allSets = await loadAllInclusionDataSets();
    loadingMsg.style.display = 'none';
    const clickHandler = (item) => {
        applyInclusionData(item);
        modal.classList.add('hidden');
    };
    renderFilteredList({ fullList: allSets, searchTerm: '', listElementId: 'inclusionsList', clickHandler, itemTitleField: 'name' });
    searchInput.oninput = () => {
        renderFilteredList({ fullList: allSets, searchTerm: searchInput.value, listElementId: 'inclusionsList', clickHandler, itemTitleField: 'name' });
    };
}
function applyInclusionData(item) {
    if (!activeGroupId) return;
    const groupData = quoteGroupsData[activeGroupId];
    const groupEl = document.getElementById(`group-content-${activeGroupId}`);
    if (!groupData || !groupEl) return;
    groupData.inclusionText = item.inclusions || '';
    groupData.exclusionText = item.exclusions || '';
    groupData.inclusionExclusionDocId = item.id;
    groupData.inclusionExclusionDocName = item.name;
    groupEl.querySelector('.inclusion-text').value = groupData.inclusionText;
    groupEl.querySelector('.exclusion-text').value = groupData.exclusionText;
    groupEl.querySelector('.inclusion-exclusion-doc-name-display').textContent = `(${item.name})`;
    showToastMessage(`'${item.name}' 내역을 적용했습니다.`);
}
async function loadAllSnippets() {
    const dataSets = [];
    try {
        const q = db.collection("textSnippets").orderBy("timestamp", "desc");
        const querySnapshot = await q.get();
        querySnapshot.forEach((doc) => { dataSets.push({ id: doc.id, ...doc.data() }); });
        return dataSets;
    } catch (error) { console.error("자주 쓰는 문자 목록 불러오기 오류:", error); showToastMessage("자주 쓰는 문자 목록을 불러오는 중 오류가 발생했습니다.", true); return []; }
}
function applyMemoData(snippet) {
    const memoTextarea = document.getElementById('memoText');
    if (!memoTextarea) return;
    memoTextarea.value = snippet.content || '';
    showToastMessage(`'${snippet.name}' 내용을 메모에 적용했습니다.`);
}
async function openLoadMemoModal() {
    const modal = document.getElementById('loadMemoModal');
    const listEl = document.getElementById('memoList');
    const loadingMsg = document.getElementById('loadingMemoMsg');
    const searchInput = document.getElementById('memoSearchInput');
    searchInput.value = '';
    modal.classList.remove('hidden');
    listEl.innerHTML = '';
    loadingMsg.style.display = 'block';
    const allSnippets = await loadAllSnippets();
    loadingMsg.style.display = 'none';
    const clickHandler = (item) => {
        applyMemoData(item);
        modal.classList.add('hidden');
    };
    renderFilteredList({ fullList: allSnippets, searchTerm: '', listElementId: 'memoList', clickHandler, itemTitleField: 'name' });
    searchInput.oninput = () => {
        renderFilteredList({ fullList: allSnippets, searchTerm: searchInput.value, listElementId: 'memoList', clickHandler, itemTitleField: 'name' });
    };
}

function addNewGroup() {
    groupCounter++;
    const groupId = groupCounter;
    quoteGroupsData[groupId] = {
        id: groupId,
        calculators: [{ id: `calc_${Date.now()}`, pnr: '', tableHTML: null }],
        flightSchedule: [], 
        priceInfo: [],
        inclusionExclusionDocId: null,
        inclusionExclusionDocName: '새로운 포함/불포함 내역',
        hotelMakerData: {
            allHotelData: [{ nameKo: `새 호텔 1`, nameEn: "", website: "", image: "", description: "" }],
            currentHotelIndex: 0,
            currentHotelDocumentId: null,
            currentHotelDocumentName: "새 호텔 정보 모음"
        },
        itineraryData: {
            title: "새 여행 일정표",
            editingTitle: false,
            days: [
                { date: dateToYyyyMmDd(new Date()), activities: [], isCollapsed: false, editingDate: false }
            ]
        }
    };
    createGroupUI(groupId);
    switchTab(groupId);
    showToastMessage(`새 견적 그룹 ${groupId}이(가) 추가되었습니다.`);
}
function deleteGroup(groupId) {
    if (Object.keys(quoteGroupsData).length <= 1) { showToastMessage('마지막 견적 그룹은 삭제할 수 없습니다.', true); return; }
    if (confirm(`견적 ${groupId}을(를) 삭제하시겠습니까?`)) {
        document.querySelector(`.quote-tab[data-group-id="${groupId}"]`)?.remove();
        document.getElementById(`group-content-${groupId}`)?.remove();
        delete quoteGroupsData[groupId];
        if (activeGroupId == groupId) {
            const lastTab = document.querySelector('.quote-tab:last-child');
            if (lastTab) { switchTab(lastTab.dataset.groupId); } else { activeGroupId = null; }
        }
        showToastMessage(`견적 그룹 ${groupId}이(가) 삭제되었습니다.`);
    }
}
function deleteActiveGroup() { if (activeGroupId) { deleteGroup(activeGroupId); } }
function copyActiveGroup() {
    if (!activeGroupId) return;
    syncGroupUIToData(activeGroupId);
    const newGroupData = JSON.parse(JSON.stringify(quoteGroupsData[activeGroupId]));
    groupCounter++;
    newGroupData.id = groupCounter;
    newGroupData.calculators.forEach(calc => { calc.id = `calc_${Date.now()}_${Math.random()}`; });
    quoteGroupsData[groupCounter] = newGroupData;
    createGroupUI(groupCounter);
    switchTab(groupCounter);
    showToastMessage(`견적 그룹 ${activeGroupId}이(가) 복사되어 새 그룹 ${groupCounter}이(가) 생성되었습니다.`);
}
function switchTab(newGroupId) {
    if (activeGroupId && activeGroupId !== newGroupId) {
        syncGroupUIToData(activeGroupId);
    }
    activeGroupId = String(newGroupId);
    document.querySelectorAll('.quote-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.groupId == newGroupId);
    });
    const contentsContainer = document.getElementById('quoteGroupContentsContainer');
    contentsContainer.innerHTML = '';
    const groupEl = document.createElement('div');
    groupEl.className = 'calculation-group-content active';
    groupEl.id = `group-content-${newGroupId}`;
    contentsContainer.appendChild(groupEl);
    initializeGroup(groupEl, newGroupId);
}

function createGroupUI(groupId) {
    const tabsContainer = document.getElementById('quoteGroupTabs');
    const tabEl = document.createElement('div');
    tabEl.className = 'quote-tab';
    tabEl.dataset.groupId = groupId;
    tabEl.innerHTML = `<span>견적 ${groupId}</span><button type="button" class="close-tab-btn" title="탭 닫기">×</button>`;
    tabsContainer.appendChild(tabEl);
    tabEl.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') switchTab(groupId); });
    tabEl.querySelector('.close-tab-btn').addEventListener('click', () => deleteGroup(groupId));
}

function renderCalculators(groupId) {
    const groupData = quoteGroupsData[groupId];
    const groupEl = document.getElementById(`group-content-${groupId}`);
    if (!groupData || !groupEl) return;
    
    const calculatorsWrapper = groupEl.querySelector(`#calculators-wrapper-${groupId}`);
    calculatorsWrapper.innerHTML = ''; 

    if (groupData.calculators && groupData.calculators.length > 0) {
        groupData.calculators.forEach(calcData => {
            createCalculatorInstance(calculatorsWrapper, groupId, calcData);
        });
    }
}

function initializeGroup(groupEl, groupId) {
    groupEl.innerHTML = `<div class="flex flex-col xl:flex-row gap-6"> 
        <div class="xl:w-1/2 flex flex-col"> 
            <div id="calculators-wrapper-${groupId}" class="space-y-4"></div> 
            <div class="mt-4 flex gap-2">
                <button type="button" class="btn btn-outline add-calculator-btn w-1/2"><i class="fas fa-plus mr-2"></i>견적 계산 추가</button>
                <button type="button" class="btn btn-outline copy-last-calculator-btn w-1/2"><i class="fas fa-copy mr-2"></i>견적 복사</button>
            </div> 
        </div> 
        <div class="xl:w-1/2 space-y-6 right-panel-container"> 
            <section class="p-4 sm:p-6 border rounded-lg bg-gray-50/50">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-semibold">항공 스케줄</h2>
                    <div class="flex items-center space-x-2">
                        <button type="button" class="btn btn-sm btn-outline copy-flight-schedule-btn" title="HTML 복사"><i class="fas fa-clipboard"></i> 코드 복사</button>
                        <button type="button" class="btn btn-sm btn-primary parse-gds-btn">GDS 파싱</button>
                        <button type="button" class="btn btn-sm btn-primary add-flight-subgroup-btn"><i class="fas fa-plus"></i> 추가</button>
                    </div>
                </div>
                <div class="space-y-4 flight-schedule-container"></div>
            </section> 
            <section class="p-4 sm:p-6 border rounded-lg bg-gray-50/50">
                <div class="flex justify-between items-center mb-4">
                    <h2 class="text-xl font-semibold">요금 안내</h2>
                    <div class="flex items-center space-x-2">
                        <button type="button" class="btn btn-sm btn-outline copy-price-info-btn" title="HTML 복사"><i class="fas fa-clipboard"></i> 코드 복사</button>
                        <button type="button" class="btn btn-sm btn-primary add-price-subgroup-btn"><i class="fas fa-plus"></i> 추가</button>
                    </div>
                </div>
                <div class="space-y-4 price-info-container"></div>
            </section> 
            <section class="p-4 sm:p-6 border rounded-lg bg-gray-50/50">
                <div class="flex justify-between items-center mb-4">
                    <div class="flex items-center"><h2 class="text-xl font-semibold">포함/불포함</h2><span class="text-sm text-gray-500 ml-2 inclusion-exclusion-doc-name-display"></span></div>
                    <button type="button" class="btn btn-sm btn-primary load-inclusion-exclusion-db-btn"><i class="fas fa-database mr-1"></i> DB 불러오기</button>
                </div>
                <div class="flex flex-col sm:flex-row gap-4">
                    <div class="w-full sm:w-1/2"><div class="flex items-center mb-1"><h3 class="font-medium">포함</h3><button type="button" class="ml-2 copy-inclusion-btn inline-copy-btn" title="포함 내역 복사"><i class="far fa-copy"></i></button></div><textarea class="w-full flex-grow px-3 py-2 border rounded-md shadow-sm inclusion-text" rows="5"></textarea></div>
                    <div class="w-full sm:w-1/2"><div class="flex items-center mb-1"><h3 class="font-medium">불포함</h3><button type="button" class="ml-2 copy-exclusion-btn inline-copy-btn" title="불포함 내역 복사"><i class="far fa-copy"></i></button></div><textarea class="w-full flex-grow px-3 py-2 border rounded-md shadow-sm exclusion-text" rows="5"></textarea></div>
                </div>
            </section> 
            <section class="p-4 sm:p-6 border rounded-lg bg-gray-50/50"><h2 class="text-xl font-semibold mb-4">호텔카드 메이커</h2><div id="hotel-maker-container-${groupId}"></div></section> 
            <section class="p-4 sm:p-6 border rounded-lg bg-gray-50/50"><div id="itinerary-planner-container-${groupId}"></div></section> 
        </div> 
    </div>`;

    const groupData = quoteGroupsData[groupId];
    if (!groupData) return;

    renderCalculators(groupId);

    const calculatorsWrapper = groupEl.querySelector(`#calculators-wrapper-${groupId}`);
    if (calculatorsWrapper) {
        new Sortable(calculatorsWrapper, {
            handle: '.calculator-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                const { oldIndex, newIndex } = evt;
                if (oldIndex === newIndex) return;
                syncGroupUIToData(groupId);
                const calculators = groupData.calculators;
                const [movedItem] = calculators.splice(oldIndex, 1);
                calculators.splice(newIndex, 0, movedItem);
                renderCalculators(groupId);
            }
        });
    }

    const flightContainer = groupEl.querySelector('.flight-schedule-container');
    if (groupData.flightSchedule) { groupData.flightSchedule.forEach(subgroup => createFlightSubgroup(flightContainer, subgroup, groupId)); }
    const priceContainer = groupEl.querySelector('.price-info-container');
    if (groupData.priceInfo) { groupData.priceInfo.forEach(subgroup => createPriceSubgroup(priceContainer, subgroup, groupId)); }
    const inclusionTextEl = groupEl.querySelector('.inclusion-text');
    const exclusionTextEl = groupEl.querySelector('.exclusion-text');
    if (inclusionTextEl) inclusionTextEl.value = groupData.inclusionText || '';
    if (exclusionTextEl) exclusionTextEl.value = groupData.exclusionText || '';
    groupEl.querySelector('.inclusion-exclusion-doc-name-display').textContent = `(${groupData.inclusionExclusionDocName || '새 내역'})`;
    
    groupEl.querySelector('.add-calculator-btn').addEventListener('click', () => {
        syncGroupUIToData(groupId);
        const newCalcData = { id: `calc_${Date.now()}`, pnr: '', tableHTML: null };
        groupData.calculators.push(newCalcData);
        renderCalculators(groupId);
    });
    groupEl.querySelector('.copy-last-calculator-btn').addEventListener('click', () => {
        if (!groupData || groupData.calculators.length === 0) { showToastMessage('복사할 견적 계산이 없습니다.', true); return; }
        syncGroupUIToData(groupId);
        const lastCalculatorData = groupData.calculators[groupData.calculators.length - 1];
        const newCalcData = JSON.parse(JSON.stringify(lastCalculatorData));
        newCalcData.id = `calc_${Date.now()}_${Math.random()}`;
        groupData.calculators.push(newCalcData);
        renderCalculators(groupId);
    });

    inclusionTextEl.addEventListener('input', e => { groupData.inclusionText = e.target.value; });
    exclusionTextEl.addEventListener('input', e => { groupData.exclusionText = e.target.value; });
    groupEl.querySelector('.copy-inclusion-btn').addEventListener('click', () => { copyToClipboard(inclusionTextEl.value, '포함 내역'); });
    groupEl.querySelector('.copy-exclusion-btn').addEventListener('click', () => { copyToClipboard(exclusionTextEl.value, '불포함 내역'); });
    groupEl.querySelector('.load-inclusion-exclusion-db-btn').addEventListener('click', () => { openLoadInclusionsModal(); });
    groupEl.querySelector('.parse-gds-btn').addEventListener('click', () => { window.open('./gds_parser/gds_parser.html', 'GDS_Parser', `width=800,height=500,top=${(screen.height / 2) - 250},left=${(screen.width / 2) - 400}`); });
    groupEl.querySelector('.add-flight-subgroup-btn').addEventListener('click', () => {
        if (!groupData.flightSchedule) groupData.flightSchedule = [];
        const sg = { id: `flight_sub_${Date.now()}`, title: "", rows: [{}] };
        groupData.flightSchedule.push(sg);
        createFlightSubgroup(flightContainer, sg, groupId);
    });
    groupEl.querySelector('.add-price-subgroup-btn').addEventListener('click', () => {
        if (!groupData.priceInfo) groupData.priceInfo = [];
        const sg = {
            id: `price_sub_${Date.now()}`, title: "",
            rows: [{ item: "성인요금", price: 0, count: 1, remarks: "" }, { item: "소아요금", price: 0, count: 1, remarks: "만2~12세미만" }, { item: "유아요금", price: 0, count: 1, remarks: "만24개월미만" }]
        };
        groupData.priceInfo.push(sg);
        createPriceSubgroup(priceContainer, sg, groupId);
    });
    groupEl.querySelector('.copy-flight-schedule-btn').addEventListener('click', () => copyHtmlToClipboard(generateFlightScheduleInlineHtml(groupData.flightSchedule)));
    groupEl.querySelector('.copy-price-info-btn').addEventListener('click', () => copyHtmlToClipboard(generatePriceInfoInlineHtml(groupData.priceInfo)));
    const hotelMakerContainer = groupEl.querySelector(`#hotel-maker-container-${groupId}`);
    if (hotelMakerContainer) {
        initializeHotelMakerForGroup(hotelMakerContainer, groupId);
    }
    const itineraryContainer = groupEl.querySelector(`#itinerary-planner-container-${groupId}`);
    if (itineraryContainer) {
        initializeItineraryPlannerForGroup(itineraryContainer, groupId);
    }
}

function buildCalculatorDOM(calcContainer) {
    const content = document.createElement('div');
    content.innerHTML = `<div class="split-container"><div class="pnr-pane"><label class="label-text font-semibold mb-2">PNR 정보</label><textarea class="w-full flex-grow px-3 py-2 border rounded-md shadow-sm" placeholder="PNR 정보를 여기에 붙여넣으세요."></textarea></div><div class="resizer-handle"></div><div class="quote-pane"><div class="table-container"><table class="quote-table"><thead><tr class="header-row"><th><button type="button" class="btn btn-sm btn-primary add-person-type-btn"><i class="fas fa-plus"></i></button></th></tr><tr class="count-row"><th></th></tr></thead><tbody></tbody><tfoot></tfoot></table></div></div></div>`;
    const calculatorElement = content.firstElementChild;
    calcContainer.appendChild(calculatorElement);

    const table = calculatorElement.querySelector('.quote-table');
    table.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (!button) return;

        if (button.classList.contains('add-person-type-btn')) {
            addPersonTypeColumn(calculatorElement, '아동', 1);
        } else if (button.classList.contains('add-dynamic-row-btn')) {
            addDynamicCostRow(calculatorElement);
        } else if (button.classList.contains('remove-col-btn')) {
            const headerCell = button.closest('th');
            if (headerCell) {
                const colIndex = Array.from(headerCell.parentNode.children).indexOf(headerCell);
                if (confirm('해당 항목을 삭제하시겠습니까?')) {
                    calculatorElement.querySelectorAll('.quote-table tr').forEach(row => row.cells[colIndex]?.remove());
                    updateSummaryRow(calculatorElement);
                    calculateAll(calculatorElement);
                }
            }
        } else if (button.classList.contains('dynamic-row-delete-btn')) {
            if (confirm('해당 항목을 삭제하시겠습니까?')) {
                button.closest('tr').remove();
                calculateAll(calculatorElement);
            }
        }
    });

    const tbody = calculatorElement.querySelector('tbody');
    ROW_DEFINITIONS.forEach(def => {
        const row = tbody.insertRow();
        row.dataset.rowId = def.id;
        const labelCell = row.insertCell(0);
        if (def.type === 'button') {
            labelCell.innerHTML = `<button type="button" class="btn btn-sm btn-outline add-dynamic-row-btn">${def.label}</button>`;
        } else { 
            labelCell.innerHTML = `<span>${def.label}</span>`; 
        }
    });
}

function createCalculatorInstance(wrapper, groupId, calcData) {
    const instanceContainer = document.createElement('div');
    instanceContainer.className = 'calculator-instance border p-4 rounded-lg relative bg-white shadow mb-4';
    instanceContainer.dataset.calculatorId = calcData.id;

    const headerDiv = document.createElement('div');
    headerDiv.className = 'calculator-header flex justify-between items-center pb-2 mb-2 border-b';
    headerDiv.innerHTML = `
        <div class="calculator-handle cursor-grab text-gray-500 p-1" title="순서 변경">
            <i class="fas fa-grip-vertical"></i>
        </div>
        <button type="button" class="delete-calculator-btn text-gray-400 hover:text-red-600 z-10 p-1" title="이 계산기 삭제">
            <i class="fas fa-times-circle"></i>
        </button>
    `;

    headerDiv.querySelector('.delete-calculator-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('이 견적 계산기를 삭제하시겠습니까?')) {
            const groupData = quoteGroupsData[groupId];
            if (groupData) {
                const calcIndex = groupData.calculators.findIndex(c => c.id === calcData.id);
                if (calcIndex > -1) {
                    groupData.calculators.splice(calcIndex, 1);
                }
            }
            instanceContainer.remove();
        }
    });
    
    instanceContainer.appendChild(headerDiv);
    wrapper.appendChild(instanceContainer);
    buildCalculatorDOM(instanceContainer);

    if (calcData && calcData.tableHTML) {
        restoreCalculatorState(instanceContainer, calcData);
    } else {
        addPersonTypeColumn(instanceContainer, '성인', 1);
    }
    
    rebindCalculatorEventListeners(instanceContainer);
    calculateAll(instanceContainer);
}

function restoreCalculatorState(instanceContainer, calcData) {
    if (!instanceContainer || !calcData) return;
    const pnrTextarea = instanceContainer.querySelector('.pnr-pane textarea');
    if (pnrTextarea) pnrTextarea.value = calcData.pnr || '';
    const table = instanceContainer.querySelector('.quote-table');
    if (table && calcData.tableHTML) { 
        table.innerHTML = calcData.tableHTML;
    }
    else { 
        addPersonTypeColumn(instanceContainer, '성인', 1);
    }
}

// =======================================================================
// 7. 견적 계산기 핵심 로직
// =======================================================================
/**
 * 입력 필드를 엑셀처럼 수식 입력과 결과 표시 모드로 전환하고,
 * 엔터 키를 누르면 아래 셀로 이동하는 기능을 설정합니다.
 * 이 함수는 특정 input 요소에 대해 한 번만 실행되도록 보장합니다.
 *
 * @param {HTMLInputElement} inputElement - 기능을 적용할 대상 입력 필드 요소입니다.
 * @param {Function} onCalculationEnd - 계산이 완료된 후(포커스가 해제될 때) 실행될 콜백 함수입니다.
 */
function setupExcelLikeInput(inputElement, onCalculationEnd) {
    // --------------------------------------------------------------------------
    // 1. 초기화 및 중복 바인딩 방지
    // --------------------------------------------------------------------------
    // 이미 이벤트 리스너가 할당된 요소인지 확인하여 중복 실행을 막습니다.
    // 이는 동적으로 요소를 추가하고 이벤트를 다시 바인딩할 때 매우 중요합니다.
    if (inputElement.dataset.excelLikeBound) {
        return;
    }
    inputElement.dataset.excelLikeBound = 'true';

    // --------------------------------------------------------------------------
    // 2. 이벤트 리스너 할당
    // --------------------------------------------------------------------------

    // --- 포커스 이벤트: 사용자가 셀을 클릭(선택)했을 때 ---
    const handleFocus = (event) => {
        const input = event.target;
        // 'data-formula' 속성에 저장된 원본 수식이 있다면, 그 수식을 다시 보여줍니다.
        // 이를 통해 사용자는 이전에 입력했던 수식을 확인하고 수정할 수 있습니다.
        const formula = input.dataset.formula;
        if (formula) {
            input.value = formula;
            input.select(); // 수식 전체를 선택하여 쉽게 수정할 수 있도록 합니다.
        }
    };

    // --- 블러 이벤트: 사용자가 셀에서 포커스를 잃었을 때 (Enter, Tab, 다른 곳 클릭) ---
    const handleBlur = (event) => {
        const input = event.target;
        const rawValue = input.value.trim();

        // 입력값이 '='로 시작하면 수식으로 판단합니다.
        if (rawValue.startsWith('=')) {
            // 원본 수식을 'data-formula' 속성에 저장하여 나중에 다시 볼 수 있게 합니다.
            input.dataset.formula = rawValue;

            // '='를 제외한 실제 계산식을 추출합니다.
            const expression = rawValue.substring(1);

            // 외부 `evaluateMath` 함수를 호출하여 수식을 계산합니다.
            const result = evaluateMath(expression);

            // 계산 결과를 쉼표가 포함된 숫자 형식(로케일 형식)으로 변환하여 보여줍니다.
            // isNaN으로 유효한 숫자인지 확인하고, 아닐 경우 'Error'를 표시합니다.
            input.value = isNaN(result) ? 'Error' : Math.round(result).toLocaleString('ko-KR');
        } else {
            // '='로 시작하지 않으면 일반 숫자로 처리합니다.
            // 혹시 남아있을 수 있는 수식 정보를 삭제합니다.
            delete input.dataset.formula;
            // 쉼표 등을 제거하고 숫자로 변환한 뒤, 다시 로케일 형식으로 변환합니다.
            const numericValue = parseFloat(rawValue.replace(/,/g, '')) || 0;
            input.value = numericValue.toLocaleString('ko-KR');
        }

        // 계산이 완료된 후, 부모 컴포넌트에 알리기 위한 콜백 함수를 호출합니다.
        // (예: 전체 합계 재계산)
        if (typeof onCalculationEnd === 'function') {
            onCalculationEnd();
        }
    };

    // --- 키다운 이벤트: 엑셀처럼 Enter 키로 아래로 이동하는 기능 ---
    const handleKeyDown = (event) => {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault(); // Enter 키의 기본 동작(예: 폼 제출)을 막습니다.
        event.stopPropagation(); // 이벤트가 부모 요소로 전파되는 것을 막습니다.

        // 현재 셀의 위치(행, 열 인덱스)를 파악합니다.
        const currentCell = event.target.closest('td');
        if (!currentCell) return;

        const currentRow = currentCell.closest('tr');
        const tableBody = currentRow.closest('tbody');
        const allRows = Array.from(tableBody.querySelectorAll('tr'));
        const currentRowIndex = allRows.indexOf(currentRow);
        const currentCellIndex = Array.from(currentRow.children).indexOf(currentCell);

        // 현재 입력창의 포커스를 강제로 해제하여 `blur` 이벤트를 실행시킵니다.
        // 이 과정에서 수식 계산 및 결과 표시가 이루어집니다.
        event.target.blur();

        // 바로 아래 행의 같은 열에 있는 다음 입력 필드를 찾습니다.
        for (let i = currentRowIndex + 1; i < allRows.length; i++) {
            const nextCell = allRows[i].cells[currentCellIndex];
            if (nextCell) {
                const nextInput = nextCell.querySelector('input[type="text"]');
                // 다음 입력 필드가 존재하면, 그곳으로 포커스를 이동시키고 종료합니다.
                if (nextInput) {
                    nextInput.focus();
                    return; // 다음 입력 필드를 찾았으므로 반복 종료
                }
            }
        }
    };

    // --------------------------------------------------------------------------
    // 3. 실제 이벤트 연결
    // --------------------------------------------------------------------------
    inputElement.addEventListener('focus', handleFocus);
    inputElement.addEventListener('blur', handleBlur);
    inputElement.addEventListener('keydown', handleKeyDown);
}

function rebindCalculatorEventListeners(calcContainer) {
    const calcAll = () => calculateAll(calcContainer);

    calcContainer.querySelectorAll('[data-event-bound]').forEach(el => el.removeAttribute('data-event-bound'));
    calcContainer.querySelectorAll('[data-dblclick-bound]').forEach(el => el.removeAttribute('data-dblclick-bound'));

    calcContainer.querySelectorAll('.cost-item, .sales-price').forEach(input => {
        setupExcelLikeInput(input, calcAll);
    });

    calcContainer.querySelectorAll('.person-type-name-span').forEach(span => {
        makeEditable(span, 'text', calcAll);
    });
    calcContainer.querySelectorAll('.person-count-span').forEach(span => {
        makeEditable(span, 'number', calcAll);
    });
    calcContainer.querySelectorAll('.dynamic-row-label-span').forEach(span => {
        makeEditable(span, 'text', () => {});
    });
    
    calcContainer.querySelectorAll('.sales-price').forEach(input => {
        if (input.dataset.dblclickBound) return;
        input.dataset.dblclickBound = 'true';
        input.addEventListener('dblclick', (event) => {
            const expression = event.target.dataset.formula || event.target.value;
            const calculatedValue = evaluateMath(expression).toString();
            copyToClipboard(calculatedValue, '상품가');
        });
    });

    updateSummaryRow(calcContainer);
}


function makeEditable(element, inputType, onBlurCallback) {
    if (element.dataset.eventBound) return;
    element.dataset.eventBound = 'true';
    
    const clickHandler = () => {
        if (element.style.display === 'none') return;
        const currentText = element.textContent;
        const input = document.createElement('input');
        input.type = inputType;
        input.value = inputType === 'number' ? parseInt(currentText.replace(/,/g, ''), 10) || 0 : currentText;
        input.className = 'person-type-input w-full bg-yellow-100 text-center';
        element.style.display = 'none';
        element.parentNode.insertBefore(input, element.nextSibling);
        input.focus();
        input.select();

        const finishEditing = () => {
            element.textContent = input.value;
            element.style.display = '';
            if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
            if (onBlurCallback) onBlurCallback();
            element.removeAttribute('data-event-bound');
        };

        input.addEventListener('blur', finishEditing, { once: true });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault();
                e.target.blur();
            }
        });
    };
    element.addEventListener('click', clickHandler);
}

function getCellContent(rowId, colIndex, type) {
    const name = `group[${colIndex}][${rowId}]`;
    let initialValue = '';
    if (type === 'costInput') {
        if (rowId === 'insurance') {
            initialValue = '5,000';
        }
    }
    switch (type) {
        case 'costInput':
        case 'salesInput':
             return `<input type="text" class="input-field-sm ${type === 'salesInput' ? 'sales-price' : 'cost-item'}" name="${name}" value="${initialValue}" placeholder="">`;
        case 'calculated': 
            return `<div class="calculated-field" data-row-id="${rowId}">0 원</div>`;
        case 'calculatedPercentage': 
            return `<div class="calculated-field" data-row-id="${rowId}">0.00 %</div>`;
        default: return '';
    }
}

function addPersonTypeColumn(calcContainer, typeName = '성인', count = 1) {
    const table = calcContainer.querySelector('.quote-table');
    if (!table) return;
    const headerRow = table.querySelector('thead .header-row');
    const colIndex = headerRow.cells.length;
    const headerCell = document.createElement('th');
    headerCell.innerHTML = `<div class="relative"><span class="person-type-name-span">${typeName}</span><button type="button" class="remove-col-btn" title="이 항목 삭제"><i class="fas fa-times"></i></button></div>`;
    headerRow.appendChild(headerCell);
    const countCell = document.createElement('th');
    countCell.innerHTML = `<span class="person-count-span">${count}</span>`;
    table.querySelector('thead .count-row').appendChild(countCell);
    table.querySelectorAll('tbody tr').forEach(tr => {
        const rowId = tr.dataset.rowId;
        const rowDef = ROW_DEFINITIONS.find(r => r.id === rowId) || { type: 'costInput' };
        tr.insertCell(-1).innerHTML = getCellContent(rowId, colIndex, rowDef.type);
    });
    
    rebindCalculatorEventListeners(calcContainer);
    
    updateSummaryRow(calcContainer);
    calculateAll(calcContainer);
}

function addDynamicCostRow(calcContainer, label = '신규 항목') {
    const table = calcContainer.querySelector('.quote-table');
    if (!table) return;
    const tbody = table.querySelector('tbody');
    const numCols = table.querySelector('thead .header-row').cells.length;
    const rowId = `dynamic_${Date.now()}`;
    const buttonRow = tbody.querySelector('tr[data-row-id="addDynamicRow"]');
    if (!buttonRow) return;
    const insertionIndex = Array.from(tbody.rows).indexOf(buttonRow);
    const newRow = tbody.insertRow(insertionIndex);
    newRow.dataset.rowId = rowId;
    newRow.insertCell(0).innerHTML = `<div class="flex items-center"><button type="button" class="dynamic-row-delete-btn"><i class="fas fa-trash-alt"></i></button><span class="dynamic-row-label-span ml-2">${label}</span></div>`;
    for (let i = 1; i < numCols; i++) { newRow.insertCell(i).innerHTML = getCellContent(rowId, i, 'costInput'); }
    
    rebindCalculatorEventListeners(calcContainer);
    calculateAll(calcContainer);
}
function updateSummaryRow(calcContainer) {
    const table = calcContainer.querySelector('.quote-table');
    if (!table) return;
    let tfoot = table.querySelector('tfoot');
    if (!tfoot) { tfoot = document.createElement('tfoot'); table.appendChild(tfoot); }
    tfoot.innerHTML = '';
    const headerRow = table.querySelector('.header-row');
    if (!headerRow || headerRow.cells.length <= 1) return;
    const summaryRow = tfoot.insertRow();
    summaryRow.insertCell(0).innerHTML = '<div class="p-2 font-bold text-center">전체 합계</div>';
    const summaryCell = summaryRow.insertCell(1);
    summaryCell.colSpan = headerRow.cells.length - 1;
    summaryCell.innerHTML = `<div class="totals-summary-section flex items-center justify-around p-1"><div class="text-center mx-2"><span class="text-base font-medium text-gray-600">전체상품가 </span><span class="text-lg font-bold text-indigo-700 totalSalesPrice">0 원</span></div><div class="text-center mx-2"><span class="text-base font-medium text-gray-600">전체수익 </span><span class="text-lg font-bold text-indigo-700 totalProfit">0 원</span></div><div class="text-center mx-2"><span class="text-base font-medium text-gray-600">전체수익률 </span><span class="text-lg font-bold text-indigo-700 totalProfitMargin">0.00 %</span></div></div>`;
    summaryRow.cells[0].style.borderTop = "2px solid #a0aec0";
    summaryCell.style.borderTop = "2px solid #a0aec0";
}

function updateCalculatedCell(table, colIndex, rowId, value) {
    const row = table.querySelector(`tbody tr[data-row-id="${rowId}"]`);
    if (row && row.cells[colIndex]) {
        const div = row.cells[colIndex].querySelector('div');
        if (div) div.textContent = value;
    }
}

function calculateAll(calcContainer) {
    if (!calcContainer) return;
    const table = calcContainer.querySelector('.quote-table');
    if (!table) return;
    const headerRow = table.querySelector('.header-row');
    if (!headerRow) return;
    let grandTotalSales = 0, grandTotalProfit = 0;
    
    for (let i = 1; i < headerRow.cells.length; i++) {
        const countCell = table.querySelector(`.count-row th:nth-child(${i + 1})`);
        const count = countCell ? parseInt(countCell.textContent.replace(/,/g, ''), 10) || 0 : 0;
        let netCost = 0;

        table.querySelectorAll(`tbody tr td:nth-child(${i + 1}) .cost-item`).forEach(input => {
            const expression = input.dataset.formula || input.value;
            netCost += evaluateMath(expression);
        });

        const salesPriceInput = table.querySelector(`tbody tr td:nth-child(${i + 1}) .sales-price`);
        const salesPriceExpression = salesPriceInput ? (salesPriceInput.dataset.formula || salesPriceInput.value) : '0';
        const salesPrice = evaluateMath(salesPriceExpression);

        const profitPerPerson = salesPrice - netCost;
        const profitMargin = salesPrice > 0 ? (profitPerPerson / salesPrice) : 0;
        
        updateCalculatedCell(table, i, 'netCost', formatCurrency(netCost));
        updateCalculatedCell(table, i, 'profitPerPerson', formatCurrency(profitPerPerson));
        updateCalculatedCell(table, i, 'profitMargin', formatPercentage(profitMargin));
        
        grandTotalSales += salesPrice * count;
        grandTotalProfit += profitPerPerson * count;
    }
    
    const grandTotalProfitMargin = grandTotalSales > 0 ? (grandTotalProfit / grandTotalSales) : 0;
    const summarySection = calcContainer.querySelector('.totals-summary-section');
    if (!summarySection) return;
    summarySection.querySelector('.totalSalesPrice').textContent = formatCurrency(grandTotalSales);
    summarySection.querySelector('.totalProfit').textContent = formatCurrency(grandTotalProfit);
    summarySection.querySelector('.totalProfitMargin').textContent = formatPercentage(grandTotalProfitMargin);
}
// =======================================================================
// 8. 기타 유틸리티 함수 - "요금 안내" 섹션 수정
// =======================================================================
function createFlightSubgroup(container, subgroupData, groupId) {
    const subGroupDiv = document.createElement('div');
    subGroupDiv.className = 'dynamic-section flight-schedule-subgroup';
    subGroupDiv.id = subgroupData.id;
    subGroupDiv.innerHTML = `<button type="button" class="delete-dynamic-section-btn" title="삭제"><i class="fas fa-trash-alt"></i></button><div class="mb-2"><input type="text" class="w-full flex-grow px-3 py-2 border rounded-md shadow-sm" placeholder="항공사" value="${subgroupData.title || ''}"></div><div class="overflow-x-auto"><table class="flight-schedule-table"><thead><tr><th>편명</th><th>출발일</th><th>출발지</th><th>출발시간</th><th>도착일</th><th>도착지</th><th>도착시간</th><th style="width: 50px;"></th></tr></thead><tbody></tbody></table></div><div class="add-row-btn-container pt-2"><button type="button" class="add-row-btn"><i class="fas fa-plus mr-1"></i></button></div>`;
    const tbody = subGroupDiv.querySelector('tbody');
    subgroupData.rows.forEach(rowData => addFlightRow(tbody, rowData, subgroupData));
    subGroupDiv.querySelector('.delete-dynamic-section-btn').addEventListener('click', () => { if (confirm('삭제?')) { quoteGroupsData[groupId].flightSchedule = quoteGroupsData[groupId].flightSchedule.filter(g => g.id !== subgroupData.id); subGroupDiv.remove(); } });
    subGroupDiv.querySelector('input[type="text"]').addEventListener('input', e => { subgroupData.title = e.target.value; });
    subGroupDiv.querySelector('.add-row-btn').addEventListener('click', () => { const newRowData = {}; subgroupData.rows.push(newRowData); addFlightRow(tbody, newRowData, subgroupData); });
    container.appendChild(subGroupDiv);
}
function addFlightRow(tbody, rowData, subgroupData) {
    const tr = document.createElement('tr');
    const fields = [{ key: 'flightNum', placeholder: 'ZE561' }, { key: 'depDate', placeholder: '07/09' }, { key: 'originCity', placeholder: 'ICN' }, { key: 'depTime', placeholder: '20:55' }, { key: 'arrDate', placeholder: '07/09' }, { key: 'destCity', placeholder: 'CXR' }, { key: 'arrTime', placeholder: '23:55' }];
    tr.innerHTML = fields.map(f => `<td><input type="text" class="flight-schedule-input" data-field="${f.key}" value="${rowData[f.key] || ''}" placeholder="${f.placeholder}"></td>`).join('') + `<td class="text-center"><button type="button" class="delete-row-btn" title="삭제"><i class="fas fa-trash"></i></button></td>`;
    tbody.appendChild(tr);
    tr.querySelectorAll('input').forEach(input => input.addEventListener('input', e => { const field = e.target.dataset.field; rowData[field] = e.target.value; }));
    tr.querySelector('.delete-row-btn').addEventListener('click', () => { const rowIndex = Array.from(tbody.children).indexOf(tr); subgroupData.rows.splice(rowIndex, 1); tr.remove(); });
}
// [수정 시작] '요금 안내' 섹션 관련 함수들을 원래 버전의 코드로 교체합니다.
function createPriceSubgroup(container, subgroupData, groupId) {
    const subGroupDiv = document.createElement('div');
    subGroupDiv.className = 'dynamic-section price-subgroup';
    subGroupDiv.id = subgroupData.id;
    subGroupDiv.innerHTML = `<button type="button" class="delete-dynamic-section-btn" title="삭제"><i class="fas fa-trash-alt"></i></button><input type="text" class="w-full flex-grow px-3 py-2 border rounded-md shadow-sm mb-2" placeholder="견적설명" value="${subgroupData.title || ''}"><table class="price-table"><thead><tr><th style="width:25%">내역</th><th>1인당금액</th><th>인원</th><th>총금액</th><th style="width:30%">비고</th><th style="width:50px"></th></tr></thead><tbody></tbody><tfoot><tr><td colspan="3" class="text-right font-bold pr-2">총 합계</td><td class="grand-total">0</td><td colspan="2"><button type="button" class="add-row-btn"><i class="fas fa-plus mr-1"></i></button></td></tr></tfoot></table>`;
    const tbody = subGroupDiv.querySelector('tbody');
    subgroupData.rows.forEach(rowData => addPriceRow(tbody, rowData, subgroupData, subGroupDiv, groupId));
    updateGrandTotal(subGroupDiv, groupId);
    subGroupDiv.querySelector('.delete-dynamic-section-btn').addEventListener('click', () => { if (confirm('삭제?')) { quoteGroupsData[groupId].priceInfo = quoteGroupsData[groupId].priceInfo.filter(g => g.id !== subgroupData.id); subGroupDiv.remove(); } });
    subGroupDiv.querySelector('input.w-full').addEventListener('input', e => { subgroupData.title = e.target.value; });
    subGroupDiv.querySelector('.add-row-btn').addEventListener('click', () => { const newRow = { item: "", price: 0, count: 1, remarks: "" }; subgroupData.rows.push(newRow); addPriceRow(tbody, newRow, subgroupData, subGroupDiv, groupId); });
    container.appendChild(subGroupDiv);
}
function addPriceRow(tbody, rowData, subgroupData, subGroupDiv, groupId) {
    const tr = document.createElement('tr');
    const fields = [{ key: 'item', align: 'center' }, { key: 'price', align: 'center' }, { key: 'count', align: 'center' }, { key: 'total', align: 'center', readonly: true }, { key: 'remarks', align: 'center' }];
    tr.innerHTML = fields.map(f => `<td><input type="text" class="text-${f.align}" data-field="${f.key}" value="${rowData[f.key] !== undefined ? (f.key === 'price' || f.key === 'total' ? (parseFloat(String(rowData[f.key]).replace(/,/g, '')) || 0).toLocaleString() : rowData[f.key]) : ''}" ${f.readonly ? 'readonly' : ''}></td>`).join('') + `<td><button type="button" class="delete-row-btn"><i class="fas fa-trash"></i></button></td>`;
    tbody.appendChild(tr);
    const updateRow = () => {
        const price = parseFloat(String(rowData.price).replace(/,/g, '')) || 0;
        const count = parseInt(String(rowData.count).replace(/,/g, '')) || 0;
        const total = price * count;
        rowData.total = total;
        const totalInput = tr.querySelector('[data-field="total"]');
        if (totalInput) totalInput.value = total.toLocaleString();
        updateGrandTotal(subGroupDiv, groupId);
    };
    tr.querySelectorAll('input:not([readonly])').forEach(input => {
        input.addEventListener('input', e => {
            let value = e.target.value;
            const field = e.target.dataset.field;
            if (field === 'price' || field === 'count') {
                value = value.replace(/,/g, '');
            }
            rowData[field] = value;
            updateRow();
        });
        if (input.dataset.field === 'price' || input.dataset.field === 'count') {
            input.addEventListener('blur', e => {
                const numValue = parseFloat(e.target.value.replace(/,/g, '')) || 0;
                e.target.value = numValue.toLocaleString();
            });
        }
    });
    tr.querySelector('.delete-row-btn').addEventListener('click', () => { if (subgroupData.rows.length > 1) { const rowIndex = Array.from(tbody.children).indexOf(tr); subgroupData.rows.splice(rowIndex, 1); tr.remove(); updateGrandTotal(subGroupDiv, groupId); } else { showToastMessage('최소 한 개의 요금 항목은 유지해야 합니다.', true); } });
    updateRow();
}
function updateGrandTotal(subGroupDiv, groupId) {
    const subgroupData = quoteGroupsData[groupId]?.priceInfo.find(g => g.id === subGroupDiv.id);
    if (!subgroupData) return;
    const grandTotal = subgroupData.rows.reduce((sum, row) => (sum + (parseFloat(String(row.price).replace(/,/g, '')) || 0) * (parseInt(String(row.count).replace(/,/g, '')) || 0)), 0);
    subGroupDiv.querySelector('.grand-total').textContent = grandTotal.toLocaleString();
}
// [수정 끝]

function generateInclusionExclusionInlineHtml(inclusionText, exclusionText) { 
    const i = inclusionText ? inclusionText.replace(/\n/g, '<br>') : ''; 
    const e = exclusionText ? exclusionText.replace(/\n/g, '<br>') : ''; 
    return `<table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:12px"><tbody><tr><td style="vertical-align:top;width:50%;padding-right:10px"><h3 style="font-size:16px;font-weight:600;margin-bottom:8px">포함</h3><div style="padding:8px;border:1px solid #eee;min-height:100px">${i}</div></td><td style="vertical-align:top;width:50%;padding-left:10px"><h3 style="font-size:16px;font-weight:600;margin-bottom:8px">불포함</h3><div style="padding:8px;border:1px solid #eee;min-height:100px">${e}</div></td></tr></tbody></table>`; 
}
function generatePriceInfoInlineHtml(priceData) {
    let html = '';
    if (priceData) {
        priceData.forEach(subgroup => {
            if (subgroup.title) { html += `<h4 style="font-size:14px;font-weight:600;margin-bottom:8px">${subgroup.title}</h4>`; }
            html += `<table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:12px;margin-bottom:16px"><thead><tr style="background-color:#f9fafb"><th style="border:1px solid #ddd;padding:8px;text-align:center">내역</th><th style="border:1px solid #ddd;padding:8px;text-align:center">1인당 금액</th><th style="border:1px solid #ddd;padding:8px;text-align:center">인원</th><th style="border:1px solid #ddd;padding:8px;text-align:center">총 금액</th><th style="border:1px solid #ddd;padding:8px;text-align:center">비고</th></tr></thead><tbody>`;
            let grandTotal = 0;
            subgroup.rows.forEach(row => { const p = parseFloat(String(row.price).replace(/,/g, '')) || 0; const c = parseInt(String(row.count).replace(/,/g, '')) || 0; const t = p * c; grandTotal += t; html += `<tr><td style="border:1px solid #ddd;padding:8px">${row.item || ''}</td><td style="border:1px solid #ddd;padding:8px;text-align:right">${p.toLocaleString()}</td><td style="border:1px solid #ddd;padding:8px;text-align:center">${c}</td><td style="border:1px solid #ddd;padding:8px;text-align:right">${t.toLocaleString()}</td><td style="border:1px solid #ddd;padding:8px">${row.remarks || ''}</td></tr>`; });
            html += `</tbody><tfoot><tr style="font-weight:bold"><td colspan="3" style="border:1px solid #ddd;padding:8px;text-align:right">총 합계</td><td style="border:1px solid #ddd;padding:8px;text-align:right">${grandTotal.toLocaleString()}</td><td style="border:1px solid #ddd;padding:8px"></td></tr></tfoot></table>`;
        });
    }
    return html;
}
function generateFlightScheduleInlineHtml(flightData) { 
    let html = ''; 
    if(flightData) {
        flightData.forEach(subgroup => { 
            html += `<h4 style="font-size:14px;font-weight:600;margin-bottom:8px">${subgroup.title || '항공 스케줄'}</h4><table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:12px;margin-bottom:16px"><thead><tr style="background-color:#f9fafb"><th style="border:1px solid #ddd;padding:8px;text-align:left">편명</th><th style="border:1px solid #ddd;padding:8px;text-align:left">출발일</th><th style="border:1px solid #ddd;padding:8px;text-align:left">출발지</th><th style="border:1px solid #ddd;padding:8px;text-align:left">출발시간</th><th style="border:1px solid #ddd;padding:8px;text-align:left">도착일</th><th style="border:1px solid #ddd;padding:8px;text-align:left">도착지</th><th style="border:1px solid #ddd;padding:8px;text-align:left">도착시간</th></tr></thead><tbody>`; 
            subgroup.rows.forEach(row => { html += `<tr><td style="border:1px solid #ddd;padding:8px">${row.flightNum || ''}</td><td style="border:1px solid #ddd;padding:8px">${row.depDate || ''}</td><td style="border:1px solid #ddd;padding:8px">${row.originCity || ''}</td><td style="border:1px solid #ddd;padding:8px">${row.depTime || ''}</td><td style="border:1px solid #ddd;padding:8px">${row.arrDate || ''}</td><td style="border:1px solid #ddd;padding:8px">${row.destCity || ''}</td><td style="border:1px solid #ddd;padding:8px">${row.arrTime || ''}</td></tr>`; }); 
            html += `</tbody></table>`; 
        }); 
    }
    return html; 
}

function restoreState(data) {
    document.getElementById('customerInfoContainer').innerHTML = '';
    document.getElementById('quoteGroupTabs').innerHTML = '';
    document.getElementById('quoteGroupContentsContainer').innerHTML = '';
    
    quoteGroupsData = data.quoteGroupsData || {};

    Object.values(quoteGroupsData).forEach(group => {
        if (!group.hotelMakerData) {
            group.hotelMakerData = {
                allHotelData: [{ nameKo: `새 호텔 1`, nameEn: "", website: "", image: "", description: "" }],
                currentHotelIndex: 0,
                currentHotelDocumentId: null,
                currentHotelDocumentName: "새 호텔 정보 모음"
            };
        }
        if (!group.itineraryData) {
             group.itineraryData = {
                title: "새 여행 일정표",
                editingTitle: false,
                days: [{ date: dateToYyyyMmDd(new Date()), activities: [], isCollapsed: false, editingDate: false }]
            };
        }
    });

    groupCounter = data.groupCounter || 0;
    document.getElementById('memoText').value = data.memoText || '';
    
    if (data.customerInfo && data.customerInfo.length > 0) { data.customerInfo.forEach(customer => createCustomerCard(customer)); }
    else { createCustomerCard(); }
    
    if (Object.keys(quoteGroupsData).length > 0) { 
        Object.keys(quoteGroupsData).forEach(id => createGroupUI(id)); 
        const groupIdToSelect = (data.activeGroupId && quoteGroupsData[data.activeGroupId]) ? data.activeGroupId : Object.keys(quoteGroupsData)[0];
        switchTab(groupIdToSelect);
    }
    else { 
        addNewGroup(); 
    }
}
function initializeNewSession() {
    createCustomerCard();
    addNewGroup();
    document.getElementById('memoText').value = '지원어려울시 업셀링 요청';
}
function setupGlobalEventListeners() {
    document.getElementById('addCustomerBtn').addEventListener('click', () => createCustomerCard());
    document.getElementById('newGroupBtn').addEventListener('click', addNewGroup);
    document.getElementById('copyGroupBtn').addEventListener('click', copyActiveGroup);
    document.getElementById('deleteGroupBtn').addEventListener('click', deleteActiveGroup);
    document.getElementById('newWindowBtn').addEventListener('click', () => window.open(window.location.href, '_blank'));
    document.getElementById('saveBtn').addEventListener('click', (event) => saveFile(false, event.currentTarget));
    document.getElementById('saveAsBtn').addEventListener('click', (event) => saveFile(true, event.currentTarget));
    const loadFileLabel = document.querySelector('label[for="loadFile"]');
    if (loadFileLabel) { loadFileLabel.addEventListener('click', (event) => { event.preventDefault(); loadFile(); }); }
    document.getElementById('copyMemoBtn')?.addEventListener('click', () => {
        const memoTextarea = document.getElementById('memoText');
        if (memoTextarea) { copyToClipboard(memoTextarea.value, '메모'); }
    });
    document.getElementById('closeLoadInclusionsModalBtn')?.addEventListener('click', () => document.getElementById('loadInclusionsModal').classList.add('hidden'));
    document.getElementById('cancelLoadInclusionsModalBtn')?.addEventListener('click', () => document.getElementById('loadInclusionsModal').classList.add('hidden'));
    document.getElementById('loadMemoFromDbBtn')?.addEventListener('click', openLoadMemoModal);
    document.getElementById('closeLoadMemoModalBtn')?.addEventListener('click', () => document.getElementById('loadMemoModal').classList.add('hidden'));
    document.getElementById('cancelLoadMemoModalBtn')?.addEventListener('click', () => document.getElementById('loadMemoModal').classList.add('hidden'));
    const recentFilesBtn = document.getElementById('recentFilesBtn');
    if (recentFilesBtn) { recentFilesBtn.addEventListener('click', openRecentFilesModal); }
    if (cancelRecentFilesModalButton) { cancelRecentFilesModalButton.addEventListener('click', () => { if (recentFilesModal) recentFilesModal.classList.add('hidden'); }); }
    if (closeRecentFilesModalButton) { closeRecentFilesModalButton.addEventListener('click', () => { if (recentFilesModal) recentFilesModal.classList.add('hidden'); }); }

    const ipActivityForm = document.getElementById('ipActivityForm');
    if (ipActivityForm) {
        ipActivityForm.addEventListener('submit', ip_handleActivityFormSubmit);
    }
    const ipCancelActivityBtn = document.getElementById('ipCancelActivityButton');
    if (ipCancelActivityBtn) {
        ipCancelActivityBtn.addEventListener('click', () => document.getElementById('ipActivityModal').classList.add('hidden'));
    }
    const ipCancelDeleteBtn = document.getElementById('ipCancelDeleteDayButton');
    if (ipCancelDeleteBtn) {
        ipCancelDeleteBtn.addEventListener('click', () => document.getElementById('ipConfirmDeleteDayModal').classList.add('hidden'));
    }

    const ipCloseLoadTemplateModal = document.getElementById('ipCloseLoadTemplateModal');
    if (ipCloseLoadTemplateModal) {
        ipCloseLoadTemplateModal.addEventListener('click', () => {
            document.getElementById('ipLoadTemplateModal').classList.add('hidden');
        });
    }
    const ipCancelLoadTemplateModal = document.getElementById('ipCancelLoadTemplateModal');
    if (ipCancelLoadTemplateModal) {
        ipCancelLoadTemplateModal.addEventListener('click', () => {
            document.getElementById('ipLoadTemplateModal').classList.add('hidden');
        });
    }
}
function setupKeydownListeners() {
    let isResizing = false;
    let pnrPaneToResize = null;
    let splitContainerToResize = null;
    document.addEventListener('mousedown', (e) => { if (e.target.matches('.resizer-handle')) { isResizing = true; splitContainerToResize = e.target.closest('.split-container'); if (!splitContainerToResize) return; pnrPaneToResize = splitContainerToResize.querySelector('.pnr-pane'); if (!pnrPaneToResize) return; e.preventDefault(); document.body.style.cursor = 'col-resize'; } });
    document.addEventListener('mousemove', (e) => { if (!isResizing) return; const rect = splitContainerToResize.getBoundingClientRect(); let newWidth = e.clientX - rect.left; if (newWidth < 150) newWidth = 150; if (newWidth > rect.width - 350) newWidth = rect.width - 350; pnrPaneToResize.style.width = newWidth + 'px'; });
    document.addEventListener('mouseup', () => { if (isResizing) { isResizing = false; pnrPaneToResize = null; splitContainerToResize = null; document.body.style.cursor = 'default'; } });
    document.addEventListener('keydown', (event) => {
        if (!event.shiftKey && !event.ctrlKey && !event.altKey) {
            switch (event.code) {
                case 'F2': event.preventDefault(); document.getElementById('saveBtn').click(); break;
                case 'F3': event.preventDefault(); document.getElementById('saveAsBtn').click(); break;
                case 'F4': event.preventDefault(); document.querySelector('label[for="loadFile"]').click(); break;
            }
        }
        if (event.shiftKey) {
            switch (event.code) {
                case 'KeyY': event.preventDefault(); document.getElementById('recentFilesBtn')?.click(); break;
                case 'KeyN': event.preventDefault(); document.getElementById('newWindowBtn').click(); break;
            }
        }
    });
}
document.addEventListener('DOMContentLoaded', () => {
    initDB();

    recentFilesModal = document.getElementById('recentFilesModal');
    recentFileSearchInput = document.getElementById('recentFileSearchInput');
    recentFileListUl = document.getElementById('recentFileList');
    loadingRecentFileListMsg = document.getElementById('loadingRecentFileListMsg');
    cancelRecentFilesModalButton = document.getElementById('cancelRecentFilesModalButton');
    closeRecentFilesModalButton = document.getElementById('closeRecentFilesModalButton');
    
    const urlParams = new URLSearchParams(window.location.search);
    const loadDataKey = urlParams.get('loadDataKey');
    
    if (loadDataKey) {
        const restoredDataJSON = sessionStorage.getItem(loadDataKey);
        sessionStorage.removeItem(loadDataKey);
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('loadDataKey');
        history.replaceState({}, '', newUrl);
        if (restoredDataJSON) {
            try {
                const restoredData = JSON.parse(restoredDataJSON);
                restoreState(restoredData);
            } catch(e) { console.error("세션 데이터 파싱 실패:", e); initializeNewSession(); }
        } else { initializeNewSession(); }
    } else {
        const restoredDataScript = document.getElementById('restored-data');
        let restoredData = null;
        if (restoredDataScript && restoredDataScript.textContent.trim()) {
            try { restoredData = JSON.parse(restoredDataScript.textContent); }
            catch (e) { console.error("저장 데이터 파싱 실패:", e); restoredData = null; }
        }
        if (restoredData) { restoreState(restoredData); } 
        else { initializeNewSession(); }
    }
    setupGlobalEventListeners();
    setupKeydownListeners();
});
