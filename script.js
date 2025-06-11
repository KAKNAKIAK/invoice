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

// Firebase 연동 관련 변수 및 초기화
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
// 4. 핵심 기능 함수
// =======================================================================

// --- 고객 정보 ---
function createCustomerCard(initialData = { name: '', phone: '', email: '' }) {
    const container = document.getElementById('customerInfoContainer');
    if (!container) return;
    const cardId = `customer_${Date.now()}`;
    const card = document.createElement('div');
    card.className = 'p-4 border border-gray-200 rounded-lg relative flex-grow sm:flex-grow-0 sm:min-w-[300px]';
    card.id = cardId;
    card.innerHTML = `<button type="button" class="absolute top-1 right-1 text-gray-400 hover:text-red-500 text-xs remove-customer-btn p-1" title="고객 삭제"><i class="fas fa-times"></i></button><div class="space-y-3 text-sm"><div class="flex items-center gap-2"><label for="customerName_${cardId}" class="font-medium text-gray-800 w-12 text-left flex-shrink-0">고객명</label><input type="text" id="customerName_${cardId}" class="w-full flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm" data-field="name" value="${initialData.name}"></div><div class="flex items-center gap-2"><label for="customerPhone_${cardId}" class="font-medium text-gray-800 w-12 text-left flex-shrink-0">연락처</label><input type="tel" id="customerPhone_${cardId}" class="w-full flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm" data-field="phone" value="${initialData.phone}"></div><div class="flex items-center gap-2"><label for="customerEmail_${cardId}" class="font-medium text-gray-800 w-12 text-left flex-shrink-0">이메일</label><input type="email" id="customerEmail_${cardId}" class="w-full flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm" data-field="email" value="${initialData.email}"></div></div>`;
    container.appendChild(card);
    card.querySelectorAll('input').forEach(input => {
        input.addEventListener('dblclick', (event) => {
            const label = event.target.previousElementSibling ? event.target.previousElementSibling.textContent : '입력 필드';
            copyToClipboard(event.target.value, label);
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

// --- 유틸리티 ---
const evaluateMath = (expression) => { if (typeof expression !== 'string' || !expression) return 0; const s = expression.replace(/,/g, ''); if (!/^[0-9+\-*/().\s]+$/.test(s)) { return parseFloat(s) || 0; } try { return new Function('return ' + s)(); } catch (e) { return parseFloat(s) || 0; } };
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
        showToastMessage(`'${text}'\n(${fieldName}) 클립보드에 복사되었습니다.`);
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


// --- 저장 및 불러오기 ---
function saveAllCalculatorsInGroup(groupId) {
    if (!groupId || !quoteGroupsData[groupId]) return;
    const groupEl = document.getElementById(`group-content-${groupId}`);
    if (!groupEl) return;
    groupEl.querySelectorAll('.calculator-instance').forEach(instance => {
        const calcId = instance.dataset.calculatorId;
        const calculatorData = quoteGroupsData[groupId].calculators.find(c => c.id === calcId);
        if (!calculatorData) return;
        const pnr = instance.querySelector('.pnr-pane textarea').value;
        const table = instance.querySelector('.quote-table');
        if (table) {
            table.querySelectorAll('input[type="text"]').forEach(input => input.setAttribute('value', input.value));
            calculatorData.tableHTML = table.innerHTML;
        }
        calculatorData.pnr = pnr;
    });
}

async function getSaveDataBlob() {
    if (activeGroupId) saveAllCalculatorsInGroup(activeGroupId);
    Object.keys(quoteGroupsData).forEach(id => { if (id !== activeGroupId) saveAllCalculatorsInGroup(id); });
    const allData = { quoteGroupsData, groupCounter, activeGroupId, memoText: document.getElementById('memoText').value, customerInfo: getCustomerData() };
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
        await loadFileInNewWindow(fileHandle);
    } catch (err) {
        if (err.name !== 'AbortError') { console.error('파일 열기 실패:', err); showToastMessage('파일을 열지 못했습니다.', true); }
    }
}

async function loadFileInNewWindow(fileHandle) {
    try {
        if ((await fileHandle.queryPermission({ mode: 'read' })) !== 'granted') {
            if ((await fileHandle.requestPermission({ mode: 'read' })) !== 'granted') {
                showToastMessage('파일 읽기 권한이 필요합니다.', true);
                return;
            }
        }

        const file = await fileHandle.getFile();
        const contents = await file.text();

        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.document.open();
            newWindow.document.write(contents);
            newWindow.document.close();
            newWindow.focus();
        } else {
            showToastMessage('팝업이 차단되어 새 창을 열 수 없습니다. 팝업 차단을 해제해주세요.', true);
            return;
        }
        
        await saveFileHandle(fileHandle.name, fileHandle);

    } catch (err) {
         if (err.name !== 'AbortError') {
            console.error('새 창에서 파일 열기 실패:', err);
            showToastMessage('새 창에서 파일을 열지 못했습니다.', true);
        }
    }
}

// --- 최근 파일 목록 관리 ---
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
            listItem.className = 'flex justify-between items-center p-3 hover:bg-gray-50 cursor-pointer';
            const titleSpan = document.createElement('span');
            titleSpan.textContent = item.name;
            titleSpan.className = 'text-sm font-medium text-gray-900 flex-grow';
            titleSpan.title = `"${item.name}" 파일 바로 불러오기 (클릭)`;
            titleSpan.addEventListener('click', async () => {
                try {
                    const handle = await getFileHandle(item.name);
                    if (handle) {
                        await loadFileInNewWindow(handle);
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
                await deleteFileHandle(item.name);
                openRecentFilesModal();
                showToastMessage(`'${item.name}'이(가) 최근 파일 목록에서 삭제되었습니다.`);
            });
            listItem.appendChild(titleSpan);
            listItem.appendChild(deleteButton);
            recentFileListUl.appendChild(listItem);
        });
    } else {
        recentFileListUl.innerHTML = `<li class="p-3 text-sm text-gray-500 text-center">최근 파일이 없거나, 검색 결과가 없습니다.</li>`;
    }
}

// --- 범용 목록 렌더링 함수 ---
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

// --- DB 연동 함수들 ---
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
    renderFilteredList({ fullList: allSets, searchTerm: '', listElementId: 'inclusionsList', clickHandler });
    searchInput.oninput = () => {
        renderFilteredList({ fullList: allSets, searchTerm: searchInput.value, listElementId: 'inclusionsList', clickHandler });
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
    renderFilteredList({ fullList: allSnippets, searchTerm: '', listElementId: 'memoList', clickHandler });
    searchInput.oninput = () => {
        renderFilteredList({ fullList: allSnippets, searchTerm: searchInput.value, listElementId: 'memoList', clickHandler });
    };
}

// --- 견적 그룹 관리 ---
function addNewGroup() {
    groupCounter++;
    const groupId = groupCounter;
    quoteGroupsData[groupId] = {
        id: groupId,
        calculators: [{ id: `calc_${Date.now()}`, pnr: '', tableHTML: null }],
        flightSchedule: [], priceInfo: [],
        inclusionText: '● 왕복 항공권\n● 호텔\n└ 조식포함\n└ 스탠다드 더블\n└ 2025-10-01(수) ~ 2025-10-05(일) (4박)\n* 1억원 여행자보험',
        exclusionText: '● 개인경비\n● 식사 시 음료 및 주류\n● 매너팁',
        inclusionExclusionDocId: null,
        inclusionExclusionDocName: '새로운 포함/불포함 내역'
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
    showToastMessage("현재 탭의 모든 정보가 복사됩니다. (단, 호텔카드와 일정표 내용은 기술적 제약으로 인해 복사되지 않습니다.)");
    saveAllCalculatorsInGroup(activeGroupId);
    const newGroupData = JSON.parse(JSON.stringify(quoteGroupsData[activeGroupId]));
    groupCounter++;
    newGroupData.id = groupCounter;
    quoteGroupsData[groupCounter] = newGroupData;
    createGroupUI(groupCounter);
    switchTab(groupCounter);
    showToastMessage(`견적 그룹 ${activeGroupId}이(가) 복사되어 새 그룹 ${groupCounter}이(가) 생성되었습니다.`);
}

function switchTab(newGroupId) {
    if (activeGroupId && activeGroupId !== newGroupId) { saveAllCalculatorsInGroup(activeGroupId); }
    activeGroupId = String(newGroupId);
    document.querySelectorAll('.quote-tab').forEach(tab => { tab.classList.toggle('active', tab.dataset.groupId == newGroupId); });
    document.querySelectorAll('.calculation-group-content').forEach(content => { content.classList.toggle('active', content.id == `group-content-${newGroupId}`); });
    setupEnterKeyListenerForForm();
}

// --- UI 생성 및 초기화 ---
function createGroupUI(groupId) {
    const tabsContainer = document.getElementById('quoteGroupTabs');
    const tabEl = document.createElement('div');
    tabEl.className = 'quote-tab';
    tabEl.dataset.groupId = groupId;
    tabEl.innerHTML = `<span>견적 ${groupId}</span><button type="button" class="close-tab-btn" title="탭 닫기">×</button>`;
    tabsContainer.appendChild(tabEl);
    tabEl.addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') switchTab(groupId); });
    tabEl.querySelector('.close-tab-btn').addEventListener('click', () => deleteGroup(groupId));
    const contentsContainer = document.getElementById('quoteGroupContentsContainer');
    const groupEl = document.createElement('div');
    groupEl.className = 'calculation-group-content';
    groupEl.id = `group-content-${groupId}`;
    contentsContainer.appendChild(groupEl);
    initializeGroup(groupEl, groupId);
}

function initializeGroup(groupEl, groupId) {
    groupEl.innerHTML = `<div class="flex gap-6"> 
        <div class="w-1/2 flex flex-col"> 
            <div id="calculators-wrapper-${groupId}" class="space-y-4"></div> 
            <div class="mt-4"><button type="button" class="btn btn-outline add-calculator-btn w-full"><i class="fas fa-plus mr-2"></i>견적 계산 추가</button></div> 
        </div> 
        <div class="w-1/2 space-y-6 right-panel-container"> 
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50"><div class="flex justify-between items-center mb-4"><h2 class="text-xl font-semibold text-gray-800">항공 스케줄</h2><div class="flex items-center space-x-2"><button type="button" class="btn btn-sm btn-secondary copy-flight-schedule-btn" title="항공 스케줄 HTML 복사"><i class="fas fa-clipboard"></i> 복사</button><button type="button" class="btn btn-sm btn-secondary parse-gds-btn">GDS 파싱</button><button type="button" class="btn btn-sm btn-secondary add-flight-subgroup-btn"><i class="fas fa-plus mr-1"></i> 스케줄 추가</button></div></div><div class="space-y-4 flight-schedule-container"></div></section> 
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50"><div class="flex justify-between items-center mb-4"><h2 class="text-xl font-semibold text-gray-800">요금 안내</h2><div class="flex items-center space-x-2"><button type="button" class="btn btn-sm btn-secondary copy-price-info-btn" title="요금 안내 HTML 복사"><i class="fas fa-clipboard"></i> 복사</button><button type="button" class="btn btn-sm btn-secondary add-price-subgroup-btn"><i class="fas fa-plus mr-1"></i> 요금 그룹 추가</button></div></div><div class="space-y-4 price-info-container"></div></section> 
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50">
                <div class="flex justify-between items-center mb-4">
                    <div class="flex items-center">
                        <h2 class="text-xl font-semibold text-gray-800">포함/불포함 사항</h2>
                        <span class="text-sm text-gray-500 ml-2 inclusion-exclusion-doc-name-display"></span>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button type="button" class="btn btn-sm btn-outline load-inclusion-exclusion-db-btn"><i class="fas fa-database mr-1"></i> DB 불러오기</button>
                    </div>
                </div>
                <div class="flex gap-4">
                    <div class="w-1/2 flex flex-col">
                        <div class="flex items-center mb-1"><h3 class="font-medium">포함</h3><button type="button" class="ml-2 copy-inclusion-btn inline-copy-btn" title="포함 내역 복사"><i class="far fa-copy"></i></button></div>
                        <textarea class="w-full flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm inclusion-text" rows="5"></textarea>
                    </div>
                    <div class="w-1/2 flex flex-col">
                        <div class="flex items-center mb-1"><h3 class="font-medium">불포함</h3><button type="button" class="ml-2 copy-exclusion-btn inline-copy-btn" title="불포함 내역 복사"><i class="far fa-copy"></i></button></div>
                        <textarea class="w-full flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm exclusion-text" rows="5"></textarea>
                    </div>
                </div>
            </section> 
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50"><h2 class="text-xl font-semibold text-gray-800 mb-4">호텔카드 메이커</h2><iframe src="./hotel_maker/index.html" style="width: 100%; height: 480px; border: 1px solid #ccc; border-radius: 0.25rem;" allow="clipboard-write"></iframe></section> 
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50"><h2 class="text-xl font-semibold text-gray-800 mb-4">상세 일정표</h2><iframe src="./itinerary_planner/index.html" style="width: 100%; height: 800px; border: 1px solid #ccc; border-radius: 0.25rem;" allow="clipboard-write"></iframe></section> 
        </div> 
    </div>`;
    const groupData = quoteGroupsData[groupId];
    if (!groupData) return;
    const calculatorsWrapper = groupEl.querySelector(`#calculators-wrapper-${groupId}`);
    if (groupData.calculators && groupData.calculators.length > 0) { groupData.calculators.forEach(calcData => createCalculatorInstance(calculatorsWrapper, groupId, calcData)); }
    groupEl.querySelector('.add-calculator-btn').addEventListener('click', () => {
        saveAllCalculatorsInGroup(groupId);
        const newCalcData = { id: `calc_${Date.now()}`, pnr: '', tableHTML: null };
        groupData.calculators.push(newCalcData);
        createCalculatorInstance(calculatorsWrapper, groupId, newCalcData);
    });
    const flightContainer = groupEl.querySelector('.flight-schedule-container');
    if (groupData.flightSchedule) { groupData.flightSchedule.forEach(subgroup => createFlightSubgroup(flightContainer, subgroup, groupId)); }
    const priceContainer = groupEl.querySelector('.price-info-container');
    if (groupData.priceInfo) { groupData.priceInfo.forEach(subgroup => createPriceSubgroup(priceContainer, subgroup, groupId)); }
    const inclusionTextEl = groupEl.querySelector('.inclusion-text');
    const exclusionTextEl = groupEl.querySelector('.exclusion-text');
    if (inclusionTextEl) inclusionTextEl.value = groupData.inclusionText || '';
    if (exclusionTextEl) exclusionTextEl.value = groupData.exclusionText || '';
    groupEl.querySelector('.inclusion-exclusion-doc-name-display').textContent = `(${groupData.inclusionExclusionDocName || '새 내역'})`;
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
            id: `price_sub_${Date.now()}`,
            title: "",
            rows: [{ item: "성인요금", price: 0, count: 1, remarks: "" }, { item: "소아요금", price: 0, count: 1, remarks: "만2~12세미만" }, { item: "유아요금", price: 0, count: 1, remarks: "만24개월미만" }]
        };
        groupData.priceInfo.push(sg);
        createPriceSubgroup(priceContainer, sg, groupId);
    });
    groupEl.querySelector('.copy-flight-schedule-btn').addEventListener('click', () => copyHtmlToClipboard(generateFlightScheduleInlineHtml(groupData.flightSchedule)));
    groupEl.querySelector('.copy-price-info-btn').addEventListener('click', () => copyHtmlToClipboard(generatePriceInfoInlineHtml(groupData.priceInfo)));
}

// --- 계산기 관련 함수들 ---
function buildCalculatorDOM(calcContainer) {
    const content = document.createElement('div');
    content.innerHTML = `<div class="split-container"><div class="pnr-pane"><label class="label-text font-semibold mb-2">PNR 정보</label><textarea class="w-full flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm" placeholder="PNR 정보를 여기에 붙여넣으세요."></textarea></div><div class="resizer-handle"></div><div class="quote-pane"><div class="table-container"><table class="quote-table"><thead><tr class="header-row"><th><button type="button" class="btn btn-sm btn-primary add-person-type-btn"><i class="fas fa-plus"></i> 항목 추가</button></th></tr><tr class="count-row"><th></th></tr></thead><tbody></tbody><tfoot></tfoot></table></div></div></div>`;
    const calculatorElement = content.firstElementChild;
    calcContainer.appendChild(calculatorElement);
    calculatorElement.querySelector('.add-person-type-btn').addEventListener('click', () => addPersonTypeColumn(calculatorElement, '아동', 1));
    const tbody = calculatorElement.querySelector('tbody');
    ROW_DEFINITIONS.forEach(def => {
        const row = tbody.insertRow();
        row.dataset.rowId = def.id;
        const labelCell = row.insertCell(0);
        if (def.type === 'button') {
            labelCell.innerHTML = `<button type="button" class="btn btn-sm btn-outline add-dynamic-row-btn">${def.label}</button>`;
            labelCell.querySelector('.add-dynamic-row-btn').addEventListener('click', () => addDynamicCostRow(calculatorElement));
        } else { labelCell.innerHTML = `<span>${def.label}</span>`; }
    });
}

function createCalculatorInstance(wrapper, groupId, calcData) {
    const instanceContainer = document.createElement('div');
    instanceContainer.className = 'calculator-instance border p-4 rounded-lg relative bg-white shadow';
    instanceContainer.dataset.calculatorId = calcData.id;
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'absolute top-2 right-2 text-gray-400 hover:text-red-600 z-10';
    deleteBtn.innerHTML = '<i class="fas fa-times-circle"></i>';
    deleteBtn.title = '이 계산기 삭제';
    deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); if (confirm('이 견적 계산기를 삭제하시겠습니까?')) { const groupData = quoteGroupsData[groupId]; if (groupData) { groupData.calculators = groupData.calculators.filter(c => c.id !== calcData.id); } instanceContainer.remove(); } });
    instanceContainer.appendChild(deleteBtn);
    wrapper.appendChild(instanceContainer);
    buildCalculatorDOM(instanceContainer);
    if (calcData && calcData.tableHTML) { restoreCalculatorState(instanceContainer, calcData); }
    else { addPersonTypeColumn(instanceContainer, '성인', 1); }
}

function restoreCalculatorState(instanceContainer, calcData) {
    if (!instanceContainer || !calcData) return;
    const pnrTextarea = instanceContainer.querySelector('.pnr-pane textarea');
    if (pnrTextarea) pnrTextarea.value = calcData.pnr || '';
    const table = instanceContainer.querySelector('.quote-table');
    if (table && calcData.tableHTML) { table.innerHTML = calcData.tableHTML; rebindCalculatorEventListeners(instanceContainer); }
    else { addPersonTypeColumn(instanceContainer, '성인', 1); }
    calculateAll(instanceContainer);
}

function rebindCalculatorEventListeners(calcContainer) {
    const calcAll = () => calculateAll(calcContainer);
    calcContainer.querySelectorAll('input').forEach(el => { el.addEventListener('input', calcAll); });
    calcContainer.querySelectorAll('.person-type-name-span').forEach(span => { makeEditable(span, 'text', calcAll); });
    calcContainer.querySelectorAll('.person-count-span').forEach(span => { makeEditable(span, 'number', calcAll); });
    calcContainer.querySelectorAll('.dynamic-row-label-span').forEach(span => { makeEditable(span, 'text', () => { }); });
    calcContainer.querySelectorAll('th .remove-col-btn').forEach((btn) => {
        const headerCell = btn.closest('th');
        if (!headerCell) return;
        const colIndex = Array.from(headerCell.parentNode.children).indexOf(headerCell);
        btn.addEventListener('click', () => {
            if (!confirm('해당 항목을 삭제하시겠습니까?')) return;
            calcContainer.querySelectorAll('.quote-table tr').forEach(row => row.cells[colIndex]?.remove());
            updateSummaryRow(calcContainer); calcAll();
        });
    });
    calcContainer.querySelectorAll('.dynamic-row-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => { if (confirm('해당 항목을 삭제하시겠습니까?')) { btn.closest('tr').remove(); calcAll(); } });
    });
    const addPersonBtn = calcContainer.querySelector('.add-person-type-btn');
    if (addPersonBtn) { addPersonBtn.addEventListener('click', () => addPersonTypeColumn(calcContainer, '아동', 1)); }
    const addRowBtn = calcContainer.querySelector('.add-dynamic-row-btn');
    if (addRowBtn) { addRowBtn.addEventListener('click', () => addDynamicCostRow(calcContainer)); }
    calcContainer.querySelectorAll('.cost-item, .sales-price').forEach(input => {
        const updateTooltip = () => {
            const expression = input.value;
            if (expression && /[+\-*/]/.test(expression)) {
                const result = evaluateMath(expression);
                input.title = ` ${new Intl.NumberFormat('ko-KR').format(Math.round(result))}`;
            } else { input.title = ''; }
        };
        input.addEventListener('mouseover', updateTooltip);
        input.addEventListener('focus', updateTooltip);
    });
    calcContainer.querySelectorAll('.sales-price').forEach(input => {
        input.addEventListener('dblclick', (event) => {
            const calculatedValue = evaluateMath(event.target.value).toString();
            copyToClipboard(calculatedValue, '상품가');
        });
    });
    updateSummaryRow(calcContainer);
}

function makeEditable(element, inputType, onBlurCallback) {
    if (!element || element.querySelector('input')) return;
    const clickHandler = () => {
        if (element.style.display === 'none') return;
        const currentText = element.textContent;
        const input = document.createElement('input');
        input.type = inputType;
        input.value = inputType === 'number' ? parseInt(currentText.replace(/,/g, ''), 10) || 0 : currentText;
        input.className = 'person-type-input';
        element.style.display = 'none';
        element.parentNode.insertBefore(input, element.nextSibling);
        input.focus();
        input.select();
        const finishEditing = () => {
            element.textContent = input.value;
            element.style.display = '';
            if (input.parentNode) input.parentNode.removeChild(input);
            if (onBlurCallback) onBlurCallback();
        };
        input.addEventListener('blur', finishEditing);
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const formElements = Array.from(document.getElementById('quoteForm').querySelectorAll('input, textarea, button, select'));
                const currentIndex = formElements.indexOf(e.target);
                const nextElement = formElements[currentIndex + 1];
                if (nextElement) { nextElement.focus(); }
                else { e.target.blur(); }
            } else if (e.key === 'Escape') { e.target.blur(); }
        });
    };
    element.addEventListener('click', clickHandler);
}

function getCellContent(rowId, colIndex, type) {
    const name = `group[${colIndex}][${rowId}]`;
    switch (type) {
        case 'costInput': return `<input type="text" class="input-field-sm cost-item" name="${name}" value="${rowId === 'insurance' ? '5000' : ''}" placeholder="0">`;
        case 'salesInput': return `<input type="text" class="input-field-sm sales-price" name="${name}" value="0" placeholder="0">`;
        case 'calculated': return `<div class="calculated-field" data-row-id="${rowId}">0 원</div>`;
        case 'calculatedPercentage': return `<div class="calculated-field" data-row-id="${rowId}">0.00 %</div>`;
        default: return '';
    }
}

function setupColumnEventListeners(calcContainer, colIndex, headerCell, countCell) {
    if (!headerCell || !countCell) return;
    const calcAllForGroup = () => calculateAll(calcContainer);
    makeEditable(headerCell.querySelector('.person-type-name-span'), 'text', calcAllForGroup);
    makeEditable(countCell.querySelector('.person-count-span'), 'number', calcAllForGroup);
    const removeBtn = headerCell.querySelector('.remove-col-btn');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            if (!confirm(`'${headerCell.textContent.trim()}' 항목을 삭제하시겠습니까?`)) return;
            calcContainer.querySelectorAll('.quote-table tr').forEach(row => { if (row.cells.length > colIndex) row.deleteCell(colIndex); });
            updateSummaryRow(calcContainer);
            calcAllForGroup();
        });
    }
    calcContainer.querySelectorAll('tbody tr').forEach(tr => {
        const cell = tr.cells[colIndex];
        if (cell) {
            const input = cell.querySelector('input');
            if (input) input.addEventListener('input', calcAllForGroup);
        }
    });
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
    updateSummaryRow(calcContainer);
    setupColumnEventListeners(calcContainer, colIndex, headerCell, countCell);
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
        table.querySelectorAll(`tbody tr td:nth-child(${i + 1}) .cost-item`).forEach(input => { netCost += evaluateMath(input.value); });
        const salesPriceInput = table.querySelector(`tbody tr td:nth-child(${i + 1}) .sales-price`);
        const salesPrice = salesPriceInput ? evaluateMath(salesPriceInput.value) : 0;
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

function updateCalculatedCell(table, colIndex, rowId, value) {
    const row = table.querySelector(`tbody tr[data-row-id="${rowId}"]`);
    if (row && row.cells[colIndex]) {
        const div = row.cells[colIndex].querySelector('div');
        if (div) div.textContent = value;
    }
}

// --- 오른쪽 패널 관련 함수들 ---
function createFlightSubgroup(container, subgroupData, groupId) {
    const subGroupDiv = document.createElement('div');
    subGroupDiv.className = 'dynamic-section flight-schedule-subgroup';
    subGroupDiv.id = subgroupData.id;
    subGroupDiv.innerHTML = `<button type="button" class="delete-dynamic-section-btn" title="이 스케줄 그룹 삭제"><i class="fas fa-trash-alt"></i></button><div class="mb-2"><input type="text" class="w-full flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm" placeholder="항공사 (예: 이스타항공)" value="${subgroupData.title || ''}"></div><div class="overflow-x-auto"><table class="flight-schedule-table"><thead><tr><th>편명</th><th>출발일</th><th>출발지</th><th>출발시간</th><th>도착일</th><th>도착지</th><th>도착시간</th><th style="width: 50px;">삭제</th></tr></thead><tbody></tbody></table></div><div class="add-row-btn-container pt-2"><button type="button" class="add-row-btn"><i class="fas fa-plus mr-1"></i> 행 추가</button></div>`;
    const tbody = subGroupDiv.querySelector('tbody');
    subgroupData.rows.forEach(rowData => addFlightRow(tbody, rowData, subgroupData));
    subGroupDiv.querySelector('.delete-dynamic-section-btn').addEventListener('click', () => { if (confirm('이 항공 스케줄 그룹을 삭제하시겠습니까?')) { quoteGroupsData[groupId].flightSchedule = quoteGroupsData[groupId].flightSchedule.filter(g => g.id !== subgroupData.id); subGroupDiv.remove(); } });
    subGroupDiv.querySelector('input[type="text"]').addEventListener('input', e => { subgroupData.title = e.target.value; });
    subGroupDiv.querySelector('.add-row-btn').addEventListener('click', () => { const newRowData = {}; subgroupData.rows.push(newRowData); addFlightRow(tbody, newRowData, subgroupData); });
    container.appendChild(subGroupDiv);
}

function addFlightRow(tbody, rowData, subgroupData) {
    const tr = document.createElement('tr');
    const fields = [{ key: 'flightNum', placeholder: 'ZE561' }, { key: 'depDate', placeholder: '07/09' }, { key: 'originCity', placeholder: 'ICN' }, { key: 'depTime', placeholder: '20:55' }, { key: 'arrDate', placeholder: '07/09' }, { key: 'destCity', placeholder: 'CXR' }, { key: 'arrTime', placeholder: '23:55' }];
    tr.innerHTML = fields.map(f => `<td><input type="text" class="flight-schedule-input" data-field="${f.key}" value="${rowData[f.key] || ''}" placeholder="${f.placeholder}"></td>`).join('') + `<td class="text-center"><button type="button" class="delete-row-btn" title="이 행 삭제"><i class="fas fa-trash"></i></button></td>`;
    tbody.appendChild(tr);
    tr.querySelectorAll('input').forEach(input => input.addEventListener('input', e => { const field = e.target.dataset.field; rowData[field] = e.target.value; }));
    tr.querySelector('.delete-row-btn').addEventListener('click', () => { const rowIndex = Array.from(tbody.children).indexOf(tr); subgroupData.rows.splice(rowIndex, 1); tr.remove(); });
}

function createPriceSubgroup(container, subgroupData, groupId) {
    const subGroupDiv = document.createElement('div');
    subGroupDiv.className = 'dynamic-section price-subgroup';
    subGroupDiv.id = subgroupData.id;
    subGroupDiv.innerHTML = `<button type="button" class="delete-dynamic-section-btn" title="이 요금 그룹 삭제"><i class="fas fa-trash-alt"></i></button><input type="text" class="w-full flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm" placeholder="견적설명 (예: 인천출발, A객실)" value="${subgroupData.title || ''}"><table class="price-table"><thead><tr><th style="width:25%">내역</th><th>1인당금액</th><th>인원</th><th>총금액</th><th style="width:30%">비고</th><th style="width:50px">삭제</th></tr></thead><tbody></tbody><tfoot><tr><td colspan="3" class="text-right font-bold pr-2">총 합계</td><td class="grand-total">0</td><td colspan="2"><button type="button" class="add-row-btn"><i class="fas fa-plus mr-1"></i>행 추가</button></td></tr></tfoot></table>`;
    const tbody = subGroupDiv.querySelector('tbody');
    subgroupData.rows.forEach(rowData => addPriceRow(tbody, rowData, subgroupData, subGroupDiv, groupId));
    updateGrandTotal(subGroupDiv, groupId);
    subGroupDiv.querySelector('.delete-dynamic-section-btn').addEventListener('click', () => { if (confirm('이 요금 그룹을 삭제하시겠습니까?')) { quoteGroupsData[groupId].priceInfo = quoteGroupsData[groupId].priceInfo.filter(g => g.id !== subgroupData.id); subGroupDiv.remove(); } });
    subGroupDiv.querySelector('input.w-full').addEventListener('input', e => { subgroupData.title = e.target.value; });
    subGroupDiv.querySelector('.add-row-btn').addEventListener('click', () => { const newRow = { item: "", price: 0, count: 1, remarks: "" }; subgroupData.rows.push(newRow); addPriceRow(tbody, newRow, subgroupData, subGroupDiv, groupId); });
    container.appendChild(subGroupDiv);
}

function addPriceRow(tbody, rowData, subgroupData, subGroupDiv, groupId) {
    const tr = document.createElement('tr');
    const fields = [{ key: 'item', align: 'center' }, { key: 'price', align: 'center' }, { key: 'count', align: 'center' }, { key: 'total', align: 'center', readonly: true }, { key: 'remarks', align: 'center' }];
    tr.innerHTML = fields.map(f => `<td><input type="text" class="text-${f.align}" data-field="${f.key}" value="${rowData[f.key] || ''}" ${f.readonly ? 'readonly' : ''}></td>`).join('') + `<td><button type="button" class="delete-row-btn"><i class="fas fa-trash"></i></button></td>`;
    tbody.appendChild(tr);
    const updateRow = () => {
        const price = parseFloat(rowData.price) || 0;
        const count = parseInt(rowData.count) || 0;
        const total = price * count;
        rowData.total = total;
        const totalInput = tr.querySelector('[data-field="total"]');
        if (totalInput) totalInput.value = total.toLocaleString();
        updateGrandTotal(subGroupDiv, groupId);
    };
    tr.querySelectorAll('input:not([readonly])').forEach(input => input.addEventListener('input', e => { rowData[e.target.dataset.field] = e.target.value.replace(/,/g, ''); updateRow(); }));
    tr.querySelector('.delete-row-btn').addEventListener('click', () => { if (subgroupData.rows.length > 1) { const rowIndex = Array.from(tbody.children).indexOf(tr); subgroupData.rows.splice(rowIndex, 1); tr.remove(); updateGrandTotal(subGroupDiv, groupId); } else { showToastMessage('최소 한 개의 요금 항목은 유지해야 합니다.', true); } });
    updateRow();
}

function updateGrandTotal(subGroupDiv, groupId) {
    const subgroupData = quoteGroupsData[groupId]?.priceInfo.find(g => g.id === subGroupDiv.id);
    if (!subgroupData) return;
    const grandTotal = subgroupData.rows.reduce((sum, row) => (sum + (parseFloat(row.price) || 0) * (parseInt(row.count) || 0)), 0);
    subGroupDiv.querySelector('.grand-total').textContent = grandTotal.toLocaleString();
}

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
            subgroup.rows.forEach(row => { const p = parseFloat(row.price) || 0; const c = parseInt(row.count) || 0; const t = p * c; grandTotal += t; html += `<tr><td style="border:1px solid #ddd;padding:8px">${row.item || ''}</td><td style="border:1px solid #ddd;padding:8px;text-align:right">${p.toLocaleString()}</td><td style="border:1px solid #ddd;padding:8px;text-align:center">${c}</td><td style="border:1px solid #ddd;padding:8px;text-align:right">${t.toLocaleString()}</td><td style="border:1px solid #ddd;padding:8px">${row.remarks || ''}</td></tr>`; });
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

function setupEnterKeyListenerForForm() {
    const form = document.getElementById('quoteForm');
    if (!form) return;
    const focusableElements = form.querySelectorAll('input, textarea, button:not([type="submit"]):not([type="reset"]), select');
    focusableElements.forEach((element, index) => {
        element.removeEventListener('keydown', handleEnterKey);
        element.addEventListener('keydown', handleEnterKey);
    });
}

function handleEnterKey(e) {
    if (e.key === 'Enter') {
        if (e.target.tagName === 'TEXTAREA') { return; }
        e.preventDefault();
        const formElements = Array.from(document.getElementById('quoteForm').querySelectorAll('input, textarea, button:not([type="submit"]):not([type="reset"]), select'));
        const currentIndex = formElements.indexOf(e.target);
        let nextIndex = currentIndex + 1;
        let nextElement = formElements[nextIndex];
        while (nextElement && (nextElement.disabled || nextElement.readOnly || nextElement.offsetParent === null)) {
            nextIndex++;
            nextElement = formElements[nextIndex];
        }
        if (nextElement) {
            nextElement.focus();
            if (nextElement.tagName === 'INPUT' || nextElement.tagName === 'TEXTAREA') { nextElement.select(); }
        } else { e.target.blur(); }
    }
}


// =======================================================================
// 5. 시스템 시작 (DOM 로드 후 실행)
// =======================================================================
function restoreState(data) {
    document.getElementById('customerInfoContainer').innerHTML = '';
    document.getElementById('quoteGroupTabs').innerHTML = '';
    document.getElementById('quoteGroupContentsContainer').innerHTML = '';
    quoteGroupsData = data.quoteGroupsData || {};
    groupCounter = data.groupCounter || 0;
    document.getElementById('memoText').value = data.memoText || '';
    if (data.customerInfo && data.customerInfo.length > 0) { data.customerInfo.forEach(customer => createCustomerCard(customer)); }
    else { createCustomerCard(); }
    if (Object.keys(quoteGroupsData).length > 0) { Object.keys(quoteGroupsData).forEach(id => createGroupUI(id)); }
    else { addNewGroup(); }
    switchTab(data.activeGroupId || (Object.keys(quoteGroupsData).length > 0 ? Object.keys(quoteGroupsData)[0] : null));
    setupEnterKeyListenerForForm();
}

function initializeNewSession() {
    createCustomerCard();
    addNewGroup();
    setupEnterKeyListenerForForm();
}

document.addEventListener('DOMContentLoaded', () => {
    initDB();

    recentFilesModal = document.getElementById('recentFilesModal');
    recentFileSearchInput = document.getElementById('recentFileSearchInput');
    recentFileListUl = document.getElementById('recentFileList');
    loadingRecentFileListMsg = document.getElementById('loadingRecentFileListMsg');
    cancelRecentFilesModalButton = document.getElementById('cancelRecentFilesModalButton');
    closeRecentFilesModalButton = document.getElementById('closeRecentFilesModalButton');

    const restoredDataScript = document.getElementById('restored-data');
    let restoredData = null;
    if (restoredDataScript && restoredDataScript.textContent.trim()) {
        try { restoredData = JSON.parse(restoredDataScript.textContent); }
        catch (e) { console.error("저장된 데이터를 파싱하는 데 실패했습니다.", e); restoredData = null; }
    }
    if (restoredData) { restoreState(restoredData); }
    else { initializeNewSession(); }

    document.getElementById('addCustomerBtn').addEventListener('click', () => createCustomerCard());
    document.getElementById('newGroupBtn').addEventListener('click', addNewGroup);
    document.getElementById('copyGroupBtn').addEventListener('click', copyActiveGroup);
    document.getElementById('deleteGroupBtn').addEventListener('click', deleteActiveGroup);
    document.getElementById('newWindowBtn').addEventListener('click', () => {
        window.open(window.location.href, '_blank');
    });
    document.getElementById('saveBtn').addEventListener('click', (event) => saveFile(false, event.currentTarget));
    document.getElementById('saveAsBtn').addEventListener('click', (event) => saveFile(true, event.currentTarget));
    const loadFileLabel = document.querySelector('label[for="loadFile"]');
    if (loadFileLabel) { loadFileLabel.addEventListener('click', (event) => { event.preventDefault(); loadFile(); }); }
    document.getElementById('quoteForm').addEventListener('reset', (e) => { e.preventDefault(); if (confirm("작성중인 모든 내용을 삭제하고 새로 시작하시겠습니까?")) { window.location.reload(); } });

    document.getElementById('copyMemoBtn')?.addEventListener('click', () => {
        const memoTextarea = document.getElementById('memoText');
        if (memoTextarea) {
            copyToClipboard(memoTextarea.value, '메모');
        }
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
    if (recentFileSearchInput) { recentFileSearchInput.addEventListener('input', renderRecentFileList); }

    let isResizing = false;
    let pnrPaneToResize = null;
    let splitContainerToResize = null;
    document.addEventListener('mousedown', (e) => { if (e.target.matches('.resizer-handle')) { isResizing = true; splitContainerToResize = e.target.closest('.split-container'); if (!splitContainerToResize) return; pnrPaneToResize = splitContainerToResize.querySelector('.pnr-pane'); if (!pnrPaneToResize) return; e.preventDefault(); document.body.style.cursor = 'col-resize'; } });
    document.addEventListener('mousemove', (e) => { if (!isResizing) return; const rect = splitContainerToResize.getBoundingClientRect(); let newWidth = e.clientX - rect.left; if (newWidth < 150) newWidth = 150; if (newWidth > rect.width - 350) newWidth = rect.width - 350; pnrPaneToResize.style.width = newWidth + 'px'; });
    document.addEventListener('mouseup', () => { if (isResizing) { isResizing = false; pnrPaneToResize = null; splitContainerToResize = null; document.body.style.cursor = 'default'; } });

    document.addEventListener('keydown', (event) => {
        if (event.shiftKey) {
            switch (event.code) {
                case 'KeyN': event.preventDefault(); document.getElementById('newWindowBtn').click(); break;
                case 'KeyS': event.preventDefault(); document.getElementById('saveBtn').click(); break;
                case 'KeyW': event.preventDefault(); document.getElementById('saveAsBtn').click(); break;
                case 'KeyF': event.preventDefault(); document.querySelector('label[for="loadFile"]').click(); break;
                case 'KeyR': event.preventDefault(); if (recentFilesBtn) { recentFilesBtn.click(); } break;
            }
        }
    });
});
