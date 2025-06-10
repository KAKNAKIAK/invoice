// =======================================================================
// 1. 전역 변수 및 설정
// =======================================================================
let quoteGroupsData = {};
let groupCounter = 0;
let activeGroupId = null;
let currentFileHandle = null;

const DB_NAME = 'QuoteAppDB';
const DB_VERSION = 2;
const STORE_NAME = 'recentFiles';
const INDEX_NAME = 'name_index';
const MAX_RECENT_FILES = 30;

const ROW_DEFINITIONS = [
    { id: 'airfare', label: '항공', type: 'costInput' }, { id: 'hotel', label: '호텔', type: 'costInput' },
    { id: 'ground', label: '지상', type: 'costInput' }, { id: 'insurance', label: '보험', type: 'costInput' },
    { id: 'commission', label: '커미션', type: 'costInput' }, { id: 'addDynamicRow', label: '+ 항목 추가', type: 'button' },
    { id: 'netCost', label: '넷가', type: 'calculated' }, { id: 'salesPrice', label: '상품가', type: 'salesInput' },
    { id: 'profitPerPerson', label: '1인수익', type: 'calculated' }, { id: 'profitMargin', label: '1인수익률', type: 'calculatedPercentage' }
];

// =======================================================================
// 2. IndexedDB 헬퍼 함수
// =======================================================================
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            let store;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            } else {
                store = event.target.transaction.objectStore(STORE_NAME);
            }
            if (!store.indexNames.contains(INDEX_NAME)) {
                store.createIndex(INDEX_NAME, 'name', { unique: true });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function addRecentFile(fileHandle) {
    if (!fileHandle) return;
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index(INDEX_NAME);

        const existingFile = await new Promise((resolve, reject) => {
            const request = index.get(fileHandle.name);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        const newItem = {
            name: fileHandle.name,
            handle: fileHandle,
            timestamp: new Date()
        };

        if (existingFile) {
            newItem.id = existingFile.id;
        }

        store.put(newItem);

        const allFiles = await new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        if (allFiles.length > MAX_RECENT_FILES) {
            allFiles.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            store.delete(allFiles[0].id);
        }

        await tx.done;
    } catch (error) {
        console.error("최근 파일 추가 실패:", error);
    }
}


async function getRecentFiles() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    
    const files = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });

    await tx.done;

    return files.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

async function clearRecentFiles() {
    if (!confirm('최근 항목 목록을 정말로 비우시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.objectStore(STORE_NAME).clear();
    await tx.done;
    alert('최근 항목 목록을 비웠습니다.');
    await populateRecentFilesModal();
}


// =======================================================================
// 3. GDS 파서 연동 함수
// =======================================================================
function addFlightsFromParser(parsedFlights) {
    if (!parsedFlights || parsedFlights.length === 0) return;
    if (!activeGroupId) { alert("파싱된 항공편을 추가할 활성 견적이 없습니다."); return; }
    const activeGroupData = quoteGroupsData[activeGroupId];
    const activeGroupElement = document.getElementById(`group-content-${activeGroupId}`);
    if (!activeGroupData || !activeGroupElement) return;
    const flightContainer = activeGroupElement.querySelector('.flight-schedule-container');
    const airlineCodeMap = { "VN": "베트남항공", "ZE": "이스타항공", "KE": "대한항공", "OZ": "아시아나항공" };
    const firstFlightAirlineCode = parsedFlights[0].airlineCode;
    const subgroupTitle = airlineCodeMap[firstFlightAirlineCode] || firstFlightAirlineCode;
    const newSubgroup = { id: `flight_sub_${Date.now()}`, title: subgroupTitle, rows: parsedFlights.map(flight => ({ ...flight })) };
    if (!activeGroupData.flightSchedule) activeGroupData.flightSchedule = [];
    activeGroupData.flightSchedule.push(newSubgroup);
    createFlightSubgroup(flightContainer, newSubgroup, activeGroupId);
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
    card.innerHTML = `<button type="button" class="absolute top-1 right-1 text-gray-400 hover:text-red-500 text-xs remove-customer-btn p-1" title="고객 삭제"><i class="fas fa-times"></i></button><div class="space-y-3 text-sm"><div class="flex items-center gap-2"><label for="customerName_${cardId}" class="font-medium text-gray-800 w-12 text-left flex-shrink-0">고객명</label><input type="text" id="customerName_${cardId}" class="input-field customer-name" data-field="name" value="${initialData.name}"></div><div class="flex items-center gap-2"><label for="customerPhone_${cardId}" class="font-medium text-gray-800 w-12 text-left flex-shrink-0">연락처</label><input type="tel" id="customerPhone_${cardId}" class="input-field customer-phone" data-field="phone" value="${initialData.phone}"></div><div class="flex items-center gap-2"><label for="customerEmail_${cardId}" class="font-medium text-gray-800 w-12 text-left flex-shrink-0">이메일</label><input type="email" id="customerEmail_${cardId}" class="input-field customer-email" data-field="email" value="${initialData.email}"></div></div>`;
    container.appendChild(card);

    card.querySelectorAll('input').forEach(input => {
        input.addEventListener('dblclick', (event) => {
            const label = event.target.previousElementSibling.textContent;
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
const copyHtmlToClipboard = (htmlString) => { if (!htmlString || htmlString.trim() === "") { alert('복사할 내용이 없습니다.'); return; } navigator.clipboard.writeText(htmlString).then(() => alert('HTML 소스 코드가 클립보드에 복사되었습니다.')).catch(err => { console.error('클립보드 복사 실패:', err); alert('복사에 실패했습니다.'); }); };

function copyToClipboard(text, fieldName = '텍스트') {
    if (!text || text.trim() === "") {
        alert('복사할 내용이 없습니다.');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        alert(`'${text}'\n(${fieldName}) 클립보드에 복사되었습니다.`);
    }).catch(err => {
        console.error('클립보드 복사 실패:', err);
        alert('복사에 실패했습니다.');
    });
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
        const styleText = await (await fetch('./style.css')).text();
        const scriptText = await (await fetch('./script.js')).text();
        
        doc.head.querySelector('link[href="style.css"]')?.replaceWith(Object.assign(document.createElement('style'), { textContent: styleText }));
        doc.body.querySelector('script[src="script.js"]')?.replaceWith(Object.assign(document.createElement('script'), { textContent: scriptText }));
        
        const dataScriptTag = doc.getElementById('restored-data');
        if (dataScriptTag) { dataScriptTag.textContent = JSON.stringify(allData); }
        
        return new Blob([doc.documentElement.outerHTML], { type: 'text/html' });
    } catch (error) {
        console.error("CSS 또는 JS 파일 포함 중 오류 발생:", error);
        alert("저장 준비 중 오류가 발생했습니다. 외부 파일을 읽을 수 없습니다.");
        return null;
    }
}

async function saveFile(isSaveAs = false, clickedButton = null) {
    const buttons = document.querySelectorAll('#header-buttons button');
    const originalBtnHTML = clickedButton ? clickedButton.innerHTML : '';
    
    buttons.forEach(btn => btn.disabled = true);
    if (clickedButton) { clickedButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i>저장 중...`; }

    try {
        const blob = await getSaveDataBlob();
        if (!blob) throw new Error("Blob 생성 실패");
        if (isSaveAs || !currentFileHandle) {
            const newHandle = await window.showSaveFilePicker({ suggestedName: `견적서_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.html`, types: [{ description: 'HTML 파일', accept: { 'text/html': ['.html'] } }] });
            currentFileHandle = newHandle;
        }
        const writableStream = await currentFileHandle.createWritable();
        await writableStream.write(blob);
        await writableStream.close();
        
        await addRecentFile(currentFileHandle);
        alert('파일이 성공적으로 저장되었습니다.');
        
    } catch (err) {
        if (err.name !== 'AbortError') { 
            console.error('파일 저장 실패:', err); 
            alert('파일 저장에 실패했습니다.'); 
        }
    } finally {
        buttons.forEach(btn => btn.disabled = false);
        if (clickedButton) { clickedButton.innerHTML = originalBtnHTML; }
    }
}


async function processFileContent(fileContents) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(fileContents, 'text/html');
    const restoredDataScript = doc.getElementById('restored-data');
    if (restoredDataScript && restoredDataScript.textContent) {
        const restoredData = JSON.parse(restoredDataScript.textContent);
        restoreState(restoredData);
        return true;
    }
    alert('유효한 데이터가 포함된 견적서 파일이 아닙니다.');
    return false;
}

async function loadFileFromHandle(fileHandle) {
    try {
        if (await fileHandle.queryPermission({mode: 'read'}) !== 'granted') {
            if (await fileHandle.requestPermission({mode: 'read'}) !== 'granted') {
                alert('파일에 접근할 수 있는 권한이 필요합니다.');
                return;
            }
        }
        const file = await fileHandle.getFile();
        const contents = await file.text();
        if (await processFileContent(contents)) {
            currentFileHandle = fileHandle;
            await addRecentFile(fileHandle);
            document.getElementById('recentFilesModal').classList.add('hidden');
        }
    } catch (err) {
        console.error("파일 불러오기 실패:", err);
        alert(`'${fileHandle.name}' 파일을 불러올 수 없습니다. 파일이 이동되었거나 삭제되었을 수 있습니다.`);
    }
}

async function browseAndLoadFile() {
    try {
        const [fileHandle] = await window.showOpenFilePicker({ types: [{ description: 'HTML 파일', accept: { 'text/html': ['.html'] } }] });
        await loadFileFromHandle(fileHandle);
    } catch (err) {
        if (err.name !== 'AbortError') { console.error('파일 열기 실패:', err); }
    }
}

async function populateRecentFilesModal() {
    const recentFiles = await getRecentFiles();
    const listElement = document.getElementById('recentFilesList');
    listElement.innerHTML = '';

    if (recentFiles.length === 0) {
        listElement.innerHTML = `<li class="p-4 text-center text-gray-500">최근에 사용한 항목이 없습니다.</li>`;
        return;
    }
    
    recentFiles.forEach(fileInfo => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="file-name">${fileInfo.name}</span><span class="file-date">마지막 사용: ${new Date(fileInfo.timestamp).toLocaleString('ko-KR')}</span>`;
        li.addEventListener('click', () => {
            loadFileFromHandle(fileInfo.handle);
        });
        listElement.appendChild(li);
    });
}

async function showRecentFilesModal() {
    await populateRecentFilesModal();
    document.getElementById('recentFilesModal').classList.remove('hidden');
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
        exclusionText: '● 개인경비\n● 식사 시 음료 및 주류\n● 매너팁'
    };
    createGroupUI(groupId);
    switchTab(groupId);
}

function deleteGroup(groupId) {
    if (Object.keys(quoteGroupsData).length <= 1) { alert('마지막 견적 그룹은 삭제할 수 없습니다.'); return; }
    if (confirm(`견적 ${groupId}을(를) 삭제하시겠습니까?`)) {
        document.querySelector(`.quote-tab[data-group-id="${groupId}"]`)?.remove();
        document.getElementById(`group-content-${groupId}`)?.remove();
        delete quoteGroupsData[groupId];
        if (activeGroupId == groupId) {
            const lastTab = document.querySelector('.quote-tab:last-child');
            if (lastTab) { switchTab(lastTab.dataset.groupId); } else { activeGroupId = null; }
        }
    }
}

function deleteActiveGroup() { if (activeGroupId) { deleteGroup(activeGroupId); } }

function copyActiveGroup() {
    if (!activeGroupId) return;
    alert("현재 탭의 모든 정보가 복사됩니다.\n(단, 호텔카드와 일정표 내용은 기술적 제약으로 인해 복사되지 않습니다.)");
    saveAllCalculatorsInGroup(activeGroupId);
    const newGroupData = JSON.parse(JSON.stringify(quoteGroupsData[activeGroupId]));
    groupCounter++;
    newGroupData.id = groupCounter;
    quoteGroupsData[groupCounter] = newGroupData;
    createGroupUI(groupCounter);
    switchTab(groupCounter);
}

function switchTab(newGroupId) {
    if (activeGroupId && activeGroupId !== newGroupId) { saveAllCalculatorsInGroup(activeGroupId); }
    activeGroupId = String(newGroupId);
    document.querySelectorAll('.quote-tab').forEach(tab => { tab.classList.toggle('active', tab.dataset.groupId == newGroupId); });
    document.querySelectorAll('.calculation-group-content').forEach(content => { content.classList.toggle('active', content.id == `group-content-${newGroupId}`); });
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
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50"><div class="flex justify-between items-center mb-4"><h3 class="text-xl font-semibold text-gray-800">항공 스케줄</h3><div class="flex items-center space-x-2"><button type="button" class="btn btn-sm btn-secondary copy-flight-schedule-btn" title="항공 스케줄 HTML 복사"><i class="fas fa-clipboard"></i> 복사</button><button type="button" class="btn btn-sm btn-secondary parse-gds-btn">GDS 파싱</button><button type="button" class="btn btn-sm btn-secondary add-flight-subgroup-btn"><i class="fas fa-plus mr-1"></i> 스케줄 추가</button></div></div><div class="space-y-4 flight-schedule-container"></div></section> 
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50"><div class="flex justify-between items-center mb-4"><h3 class="text-xl font-semibold text-gray-800">요금 안내</h3><div class="flex items-center space-x-2"><button type="button" class="btn btn-sm btn-secondary copy-price-info-btn" title="요금 안내 HTML 복사"><i class="fas fa-clipboard"></i> 복사</button><button type="button" class="btn btn-sm btn-secondary add-price-subgroup-btn"><i class="fas fa-plus mr-1"></i> 요금 그룹 추가</button></div></div><div class="space-y-4 price-info-container"></div></section> 
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50"><div class="flex justify-between items-center mb-4"><h3 class="text-xl font-semibold text-gray-800">포함/불포함 사항</h3><button type="button" class="btn btn-sm btn-secondary copy-inclusion-exclusion-btn" title="포함/불포함 HTML 복사"><i class="fas fa-clipboard"></i> 복사</button></div><div class="flex gap-4"><div class="w-1/2 flex flex-col"><h3 class="font-medium mb-1">포함</h3><textarea class="input-field flex-grow inclusion-text" rows="5"></textarea></div><div class="w-1/2 flex flex-col"><h3 class="font-medium mb-1">불포함</h3><textarea class="input-field flex-grow exclusion-text" rows="5"></textarea></div></div></section> 
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50"><h3 class="text-xl font-semibold text-gray-800 mb-4">호텔카드 메이커</h3><iframe src="./hotel_maker/index.html" style="width: 100%; height: 480px; border: 1px solid #ccc; border-radius: 0.25rem;" allow="clipboard-write"></iframe></section> 
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50"><h3 class="text-xl font-semibold text-gray-800 mb-4">상세 일정표</h3><iframe src="./itinerary_planner/index.html" style="width: 100%; height: 800px; border: 1px solid #ccc; border-radius: 0.25rem;" allow="clipboard-write"></iframe></section> 
        </div> 
    </div>`;

    const groupData = quoteGroupsData[groupId];
    if (!groupData) return;

    const calculatorsWrapper = groupEl.querySelector(`#calculators-wrapper-${groupId}`);
    if (groupData.calculators && groupData.calculators.length > 0) { 
        groupData.calculators.forEach(calcData => createCalculatorInstance(calculatorsWrapper, groupId, calcData)); 
    }
    groupEl.querySelector('.add-calculator-btn').addEventListener('click', () => { 
        saveAllCalculatorsInGroup(groupId); 
        const newCalcData = { id: `calc_${Date.now()}`, pnr: '', tableHTML: null }; 
        groupData.calculators.push(newCalcData); 
        createCalculatorInstance(calculatorsWrapper, groupId, newCalcData); 
    });

    const flightContainer = groupEl.querySelector('.flight-schedule-container');
    if (groupData.flightSchedule) {
        groupData.flightSchedule.forEach(subgroup => createFlightSubgroup(flightContainer, subgroup, groupId));
    }
    
    const priceContainer = groupEl.querySelector('.price-info-container');
    if (groupData.priceInfo) {
        groupData.priceInfo.forEach(subgroup => createPriceSubgroup(priceContainer, subgroup, groupId));
    }
    
    const inclusionTextEl = groupEl.querySelector('.inclusion-text');
    const exclusionTextEl = groupEl.querySelector('.exclusion-text');
    if (inclusionTextEl) inclusionTextEl.value = groupData.inclusionText || '';
    if (exclusionTextEl) exclusionTextEl.value = groupData.exclusionText || '';
    
    inclusionTextEl.addEventListener('input', e => { groupData.inclusionText = e.target.value; });
    exclusionTextEl.addEventListener('input', e => { groupData.exclusionText = e.target.value; });

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
            rows: [
                { item: "성인요금", price: 0, count: 1, remarks: "" },
                { item: "소아요금", price: 0, count: 1, remarks: "만2~12세미만" },
                { item: "유아요금", price: 0, count: 1, remarks: "만24개월미만" }
            ] 
        }; 
        groupData.priceInfo.push(sg); 
        createPriceSubgroup(priceContainer, sg, groupId); 
    });

    groupEl.querySelector('.copy-flight-schedule-btn').addEventListener('click', () => copyHtmlToClipboard(generateFlightScheduleInlineHtml(groupData.flightSchedule)));
    groupEl.querySelector('.copy-price-info-btn').addEventListener('click', () => copyHtmlToClipboard(generatePriceInfoInlineHtml(groupData.priceInfo)));
    groupEl.querySelector('.copy-inclusion-exclusion-btn').addEventListener('click', () => copyHtmlToClipboard(generateInclusionExclusionInlineHtml(groupData.inclusionText, groupData.exclusionText)));
}

// --- 계산기 관련 함수들 ---

function buildCalculatorDOM(calcContainer) {
    const content = document.createElement('div');
    content.innerHTML = `<div class="split-container"><div class="pnr-pane"><label class="label-text font-semibold mb-2">PNR 정보</label><textarea class="w-full flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm resize-none" placeholder="PNR 정보를 여기에 붙여넣으세요."></textarea></div><div class="resizer-handle"></div><div class="quote-pane"><div class="table-container"><table class="quote-table"><thead><tr class="header-row"><th><button type="button" class="btn btn-sm btn-primary add-person-type-btn"><i class="fas fa-plus"></i> 항목 추가</button></th></tr><tr class="count-row"><th></th></tr></thead><tbody></tbody><tfoot></tfoot></table></div></div></div>`;
    const calculatorElement = content.firstElementChild;
    calcContainer.appendChild(calculatorElement);
    calculatorElement.querySelector('.add-person-type-btn').addEventListener('click', () => addPersonTypeColumn(calcContainer, '아동', 1));
    const tbody = calculatorElement.querySelector('tbody');
    ROW_DEFINITIONS.forEach(def => {
        const row = tbody.insertRow();
        row.dataset.rowId = def.id;
        const labelCell = row.insertCell(0);
        if (def.type === 'button') {
            labelCell.innerHTML = `<button type="button" class="btn btn-sm btn-outline add-dynamic-row-btn">${def.label}</button>`;
            labelCell.querySelector('.add-dynamic-row-btn').addEventListener('click', () => addDynamicCostRow(calcContainer));
        } else {
            labelCell.innerHTML = `<span>${def.label}</span>`;
        }
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
    if (table && calcData.tableHTML) {
        table.innerHTML = calcData.tableHTML;
        rebindCalculatorEventListeners(instanceContainer);
    } else {
        addPersonTypeColumn(instanceContainer, '성인', 1);
    }
    calculateAll(instanceContainer);
}

function rebindCalculatorEventListeners(calcContainer) {
    const calcAll = () => calculateAll(calcContainer);

    calcContainer.querySelectorAll('input').forEach(el => {
        el.addEventListener('input', calcAll);
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

    calcContainer.querySelectorAll('th .remove-col-btn').forEach((btn) => {
        const headerCell = btn.closest('th');
        if (!headerCell) return;
        const colIndex = Array.from(headerCell.parentNode.children).indexOf(headerCell);
        btn.addEventListener('click', () => { 
            if (!confirm('해당 항목을 삭제하시겠습니까?')) return; 
            calcContainer.querySelectorAll('.quote-table tr').forEach(row => row.cells[colIndex]?.remove()); 
            updateSummaryRow(calcContainer); 
            calcAll(); 
        });
    });
    calcContainer.querySelectorAll('.dynamic-row-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => { 
            if (confirm('해당 항목을 삭제하시겠습니까?')) { 
                btn.closest('tr').remove(); 
                calcAll(); 
            } 
        });
    });

    const addPersonBtn = calcContainer.querySelector('.add-person-type-btn');
    if (addPersonBtn) {
        addPersonBtn.addEventListener('click', () => addPersonTypeColumn(calcContainer, '아동', 1));
    }
    const addRowBtn = calcContainer.querySelector('.add-dynamic-row-btn');
    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => addDynamicCostRow(calcContainer));
    }
    
    calcContainer.querySelectorAll('.cost-item, .sales-price').forEach(input => {
        const updateTooltip = () => {
            const expression = input.value;
            if (expression && /[+\-*/]/.test(expression)) {
                const result = evaluateMath(expression);
                input.title = ` ${new Intl.NumberFormat('ko-KR').format(Math.round(result))}`;
            } else {
                input.title = '';
            }
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
        input.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); });
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
    for (let i = 1; i < numCols; i++) {
        newRow.insertCell(i).innerHTML = getCellContent(rowId, i, 'costInput');
    }
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
    summaryCell.innerHTML = `<div class="totals-summary-section flex items-center justify-around p-1"><div class="text-center mx-2"><span class="text-xs font-medium text-gray-600">전체상품가 </span><span class="text-base font-bold text-indigo-700 totalSalesPrice">0 원</span></div><div class="text-center mx-2"><span class="text-xs font-medium text-gray-600">전체수익 </span><span class="text-base font-bold text-indigo-700 totalProfit">0 원</span></div><div class="text-center mx-2"><span class="text-xs font-medium text-gray-600">전체수익률 </span><span class="text-base font-bold text-indigo-700 totalProfitMargin">0.00 %</span></div></div>`;
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
function createFlightSubgroup(container, subgroupData, groupId) {
    const subGroupDiv = document.createElement('div');
    subGroupDiv.className = 'dynamic-section flight-schedule-subgroup';
    subGroupDiv.id = subgroupData.id;
    subGroupDiv.innerHTML = `<button type="button" class="delete-dynamic-section-btn" title="이 스케줄 그룹 삭제"><i class="fas fa-trash-alt"></i></button><div class="mb-2"><input type="text" class="input-field" placeholder="항공사 (예: 이스타항공)" value="${subgroupData.title || ''}"></div><div class="overflow-x-auto"><table class="flight-schedule-table"><thead><tr><th>편명</th><th>출발일</th><th>출발지</th><th>출발시간</th><th>도착일</th><th>도착지</th><th>도착시간</th><th style="width: 50px;">삭제</th></tr></thead><tbody></tbody></table></div><div class="add-row-btn-container pt-2"><button type="button" class="add-row-btn"><i class="fas fa-plus mr-1"></i> 행 추가</button></div>`;
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
    subGroupDiv.innerHTML = `<button type="button" class="delete-dynamic-section-btn" title="이 요금 그룹 삭제"><i class="fas fa-trash-alt"></i></button><input type="text" class="input-field mb-2" placeholder="견적설명 (예: 인천출발, A객실)" value="${subgroupData.title || ''}"><table class="price-table"><thead><tr><th style="width:25%">내역</th><th>1인당금액</th><th>인원</th><th>총금액</th><th style="width:30%">비고</th><th style="width:50px">삭제</th></tr></thead><tbody></tbody><tfoot><tr><td colspan="3" class="text-right font-bold pr-2">총 합계</td><td class="grand-total">0</td><td colspan="2"><button type="button" class="add-row-btn"><i class="fas fa-plus mr-1"></i>행 추가</button></td></tr></tfoot></table>`;
    const tbody = subGroupDiv.querySelector('tbody');
    subgroupData.rows.forEach(rowData => addPriceRow(tbody, rowData, subgroupData, subGroupDiv, groupId));
    updateGrandTotal(subGroupDiv, groupId);
    subGroupDiv.querySelector('.delete-dynamic-section-btn').addEventListener('click', () => { if (confirm('이 요금 그룹을 삭제하시겠습니까?')) { quoteGroupsData[groupId].priceInfo = quoteGroupsData[groupId].priceInfo.filter(g => g.id !== subgroupData.id); subGroupDiv.remove(); } });
    subGroupDiv.querySelector('input.input-field').addEventListener('input', e => { subgroupData.title = e.target.value; });
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
    tr.querySelector('.delete-row-btn').addEventListener('click', () => { if (subgroupData.rows.length > 1) { const rowIndex = Array.from(tbody.children).indexOf(tr); subgroupData.rows.splice(rowIndex, 1); tr.remove(); updateGrandTotal(subGroupDiv, groupId); } else { alert('최소 한 개의 요금 항목은 유지해야 합니다.'); } });
    updateRow();
}

function updateGrandTotal(subGroupDiv, groupId) {
    const subgroupData = quoteGroupsData[groupId]?.priceInfo.find(g => g.id === subGroupDiv.id);
    if (!subgroupData) return;
    const grandTotal = subgroupData.rows.reduce((sum, row) => (sum + (parseFloat(row.price) || 0) * (parseInt(row.count) || 0)), 0);
    subGroupDiv.querySelector('.grand-total').textContent = grandTotal.toLocaleString();
}

function generateInclusionExclusionInlineHtml(inclusionText, exclusionText) { const i = inclusionText ? inclusionText.replace(/\n/g, '<br>') : ''; const e = exclusionText ? exclusionText.replace(/\n/g, '<br>') : ''; return `<table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:12px"><tbody><tr><td style="vertical-align:top;width:50%;padding-right:10px"><h3 style="font-size:16px;font-weight:600;margin-bottom:8px">포함</h3><div style="padding:8px;border:1px solid #eee;min-height:100px">${i}</div></td><td style="vertical-align:top;width:50%;padding-left:10px"><h3 style="font-size:16px;font-weight:600;margin-bottom:8px">불포함</h3><div style="padding:8px;border:1px solid #eee;min-height:100px">${e}</div></td></tr></tbody></table>`; }

function generatePriceInfoInlineHtml(priceData) {
    let html = '';
    if (priceData) {
        priceData.forEach(subgroup => {
            // ▼▼▼ [추가된 부분] 견적설명이 있을 경우 제목(h4)으로 추가 ▼▼▼
            if (subgroup.title && subgroup.title.trim() !== '') {
                html += `<h4 style="font-family:sans-serif;font-size:14px;font-weight:bold;margin:16px 0 8px 0;">${subgroup.title}</h4>`;
            }
            // ▲▲▲

            html += `<table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:12px;margin-bottom:16px"><thead><tr style="background-color:#f9fafb"><th style="border:1px solid #ddd;padding:8px;text-align:center">내역</th><th style="border:1px solid #ddd;padding:8px;text-align:center">1인당 금액</th><th style="border:1px solid #ddd;padding:8px;text-align:center">인원</th><th style="border:1px solid #ddd;padding:8px;text-align:center">총 금액</th><th style="border:1px solid #ddd;padding:8px;text-align:center">비고</th></tr></thead><tbody>`;
            let grandTotal = 0;
            subgroup.rows.forEach(row => {
                const p = parseFloat(row.price) || 0;
                const c = parseInt(row.count) || 0;
                const t = p * c;
                grandTotal += t;
                html += `<tr><td style="border:1px solid #ddd;padding:8px">${row.item || ''}</td><td style="border:1px solid #ddd;padding:8px;text-align:right">${p.toLocaleString()}</td><td style="border:1px solid #ddd;padding:8px;text-align:center">${c}</td><td style="border:1px solid #ddd;padding:8px;text-align:right">${t.toLocaleString()}</td><td style="border:1px solid #ddd;padding:8px">${row.remarks || ''}</td></tr>`;
            });
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
    if (data.customerInfo && data.customerInfo.length > 0) {
        data.customerInfo.forEach(customer => createCustomerCard(customer));
    } else { createCustomerCard(); }
    if (Object.keys(quoteGroupsData).length > 0) {
        Object.keys(quoteGroupsData).forEach(id => createGroupUI(id));
    } else { addNewGroup(); }
    switchTab(data.activeGroupId || (Object.keys(quoteGroupsData).length > 0 ? Object.keys(quoteGroupsData)[0] : null));
}

function initializeNewSession() {
    createCustomerCard();
    addNewGroup();
}

document.addEventListener('DOMContentLoaded', () => {
    const restoredDataScript = document.getElementById('restored-data');
    let restoredData = null;
    if (restoredDataScript && restoredDataScript.textContent.trim()) {
        try { restoredData = JSON.parse(restoredDataScript.textContent); }
        catch (e) { console.error("저장된 데이터를 파싱하는 데 실패했습니다.", e); restoredData = null; }
    }
    if (restoredData) {
        restoreState(restoredData);
    } else {
        initializeNewSession();
    }
    
    document.getElementById('addCustomerBtn').addEventListener('click', () => createCustomerCard());
    document.getElementById('newGroupBtn').addEventListener('click', addNewGroup);
    document.getElementById('copyGroupBtn').addEventListener('click', copyActiveGroup);
    document.getElementById('deleteGroupBtn').addEventListener('click', deleteActiveGroup);
    
    document.getElementById('recentFilesBtn').addEventListener('click', showRecentFilesModal);
    document.getElementById('openFileBtn').addEventListener('click', browseAndLoadFile);
    document.getElementById('saveBtn').addEventListener('click', (event) => saveFile(false, event.currentTarget));
    document.getElementById('saveAsBtn').addEventListener('click', (event) => saveFile(true, event.currentTarget));
    
    document.getElementById('closeRecentFilesModal').addEventListener('click', () => document.getElementById('recentFilesModal').classList.add('hidden'));
    document.getElementById('browseFileBtn').addEventListener('click', browseAndLoadFile);
    document.getElementById('clearRecentListBtn').addEventListener('click', clearRecentFiles);

    document.getElementById('quoteForm').addEventListener('reset', (e) => { e.preventDefault(); if (confirm("작성중인 모든 내용을 삭제하고 새로 시작하시겠습니까?")) { window.location.reload(); } });
    
    let isResizing = false;
    let pnrPaneToResize = null;
    let splitContainerToResize = null;
    document.addEventListener('mousedown', (e) => { if (e.target.matches('.resizer-handle')) { isResizing = true; splitContainerToResize = e.target.closest('.split-container'); if (!splitContainerToResize) return; pnrPaneToResize = splitContainerToResize.querySelector('.pnr-pane'); if (!pnrPaneToResize) return; e.preventDefault(); document.body.style.cursor = 'col-resize'; } });
    document.addEventListener('mousemove', (e) => { if (!isResizing) return; const rect = splitContainerToResize.getBoundingClientRect(); let newWidth = e.clientX - rect.left; if (newWidth < 150) newWidth = 150; if (newWidth > rect.width - 350) newWidth = rect.width - 350; pnrPaneToResize.style.width = newWidth + 'px'; });
    document.addEventListener('mouseup', () => { if (isResizing) { isResizing = false; pnrPaneToResize = null; splitContainerToResize = null; document.body.style.cursor = 'default'; } });

    document.addEventListener('keydown', (event) => {

        if (event.shiftKey) {
            switch (event.code) {
                case 'KeyR':
                    event.preventDefault();
                    showRecentFilesModal();
                    break;
                case 'KeyF':
                    event.preventDefault();
                    document.getElementById('openFileBtn').click();
                    break;
                case 'KeyS':
                    event.preventDefault();
                    document.getElementById('saveBtn').click();
                    break;
                case 'KeyW':
                    event.preventDefault();
                    document.getElementById('saveAsBtn').click();
                    break;
            }
        }
    });
});S
