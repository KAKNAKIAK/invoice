// =======================================================================
// 1. 전역 변수 및 설정
// =======================================================================
let quoteGroupsData = {}; // 모든 견적 그룹의 데이터를 저장하는 핵심 객체
let groupCounter = 0;
let activeGroupId = null;

const ROW_DEFINITIONS = [
    { id: 'airfare', label: '항공', type: 'costInput' }, { id: 'hotel', label: '호텔', type: 'costInput' },
    { id: 'ground', label: '지상', type: 'costInput' }, { id: 'insurance', label: '보험', type: 'costInput' },
    { id: 'commission', label: '커미션', type: 'costInput' }, { id: 'addDynamicRow', label: '+ 항목 추가', type: 'button' },
    { id: 'netCost', label: '넷가', type: 'calculated' }, { id: 'salesPrice', label: '상품가', type: 'salesInput' },
    { id: 'profitPerPerson', label: '1인수익', type: 'calculated' }, { id: 'profitMargin', label: '1인수익률', type: 'calculatedPercentage' }
];

// =======================================================================
// 2. GDS 파서 연동 함수 (팝업창에서 직접 호출)
// =======================================================================
function addFlightsFromParser(parsedFlights) {
    if (!parsedFlights || parsedFlights.length === 0) return;
    if (!activeGroupId) {
        alert("파싱된 항공편을 추가할 활성 견적이 없습니다.");
        return;
    }
    const activeGroupData = quoteGroupsData[activeGroupId];
    const activeGroupElement = document.getElementById(`group-content-${activeGroupId}`);
    if (!activeGroupData || !activeGroupElement) return;
    const flightContainer = activeGroupElement.querySelector('.flight-schedule-container');
    const airlineCodeMap = { "VN": "베트남항공", "ZE": "이스타항공", "KE": "대한항공", "OZ": "아시아나항공" };
    const firstFlightAirlineCode = parsedFlights[0].airlineCode;
    const subgroupTitle = airlineCodeMap[firstFlightAirlineCode] || firstFlightAirlineCode;
    const newSubgroup = { id: `flight_sub_${Date.now()}`, title: subgroupTitle, rows: parsedFlights.map(flight => ({ ...flight })) };
    activeGroupData.flightSchedule.push(newSubgroup);
    createFlightSubgroup(flightContainer, newSubgroup, activeGroupId);
}

// =======================================================================
// 3. 핵심 기능 함수 (전역 스코프)
// =======================================================================

// --- 고객 정보 카드 관리 함수 ---
function createCustomerCard(initialData = { name: '', phone: '', email: '' }) {
    const container = document.getElementById('customerInfoContainer');
    if (!container) return;
    const cardId = `customer_${Date.now()}`;
    const card = document.createElement('div');
    card.className = 'p-4 border border-gray-200 rounded-lg relative flex-grow sm:flex-grow-0 sm:min-w-[300px]';
    card.id = cardId;
    card.innerHTML = `<button type="button" class="absolute top-1 right-1 text-gray-400 hover:text-red-500 text-xs remove-customer-btn p-1" title="고객 삭제"><i class="fas fa-times"></i></button><div class="space-y-3 text-sm"><div class="flex items-center gap-2"><label for="customerName_${cardId}" class="font-medium text-gray-800 w-12 text-left flex-shrink-0">고객명</label><input type="text" id="customerName_${cardId}" class="input-field customer-name" value="${initialData.name}"></div><div class="flex items-center gap-2"><label for="customerPhone_${cardId}" class="font-medium text-gray-800 w-12 text-left flex-shrink-0">연락처</label><input type="tel" id="customerPhone_${cardId}" class="input-field customer-phone" value="${initialData.phone}"></div><div class="flex items-center gap-2"><label for="customerEmail_${cardId}" class="font-medium text-gray-800 w-12 text-left flex-shrink-0">이메일</label><input type="email" id="customerEmail_${cardId}" class="input-field customer-email" value="${initialData.email}"></div></div>`;
    container.appendChild(card);
    card.querySelector('.remove-customer-btn').addEventListener('click', () => { card.remove(); });
}

// --- 유틸리티 함수 ---
const evaluateMath = (expression) => { if(typeof expression!=='string'||!expression)return 0; const s=expression.replace(/,/g,''); if(!/^[0-9+\-*/().\s]+$/.test(s)){return parseFloat(s)||0;} try{return new Function('return '+s)();}catch(e){return parseFloat(s)||0;} };
const formatCurrency = (amount) => new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + ' 원';
const formatPercentage = (value) => (isNaN(value) || !isFinite(value) ? 0 : value * 100).toFixed(2) + ' %';
const copyHtmlToClipboard = (htmlString) => { if (!htmlString || htmlString.trim()==="") { alert('복사할 내용이 없습니다.'); return; } navigator.clipboard.writeText(htmlString).then(() => alert('HTML 소스 코드가 클립보드에 복사되었습니다.')).catch(err => { console.error('클립보드 복사 실패:', err); alert('복사에 실패했습니다.'); }); };

// --- 저장 및 불러오기 함수 ---
function saveToFile() {
    saveAllCalculatorsInGroup(activeGroupId);
    Object.keys(quoteGroupsData).forEach(id => { if (id !== activeGroupId) saveAllCalculatorsInGroup(id); });
    const allData = { quoteGroupsData, groupCounter, activeGroupId, memoText: document.getElementById('memoText').value };
    const currentHtml = document.documentElement.outerHTML;
    const parser = new DOMParser();
    const doc = parser.parseFromString(currentHtml, 'text/html');
    doc.getElementById('restored-data').textContent = JSON.stringify(allData);
    const blob = new Blob([doc.documentElement.outerHTML], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const date = new Date();
    const timestamp = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2,'0')}${date.getDate().toString().padStart(2,'0')}`;
    a.download = `견적서_${timestamp}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
}
function loadFromFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => { const newWindow = window.open(); newWindow.document.write(e.target.result); newWindow.document.close(); };
    reader.readAsText(file);
}

// --- 견적 그룹(탭) 관리 ---
function addNewGroup(dataToRestore = null) {
    groupCounter++;
    const groupId = groupCounter;
    if (dataToRestore) {
        quoteGroupsData[groupId] = JSON.parse(JSON.stringify(dataToRestore));
    } else {
        quoteGroupsData[groupId] = {
            id: groupId,
            calculators: [], 
            flightSchedule: [], priceInfo: [],
            inclusionText: '* 유류할증료\n* 각종 TAX\n* 1억원 여행자보험',
            exclusionText: '● 개인경비\n● 식사 시 음료 및 주류\n● 매너팁'
        };
    }
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
    switchTab(groupId);
}
function deleteGroup(groupId){if(Object.keys(quoteGroupsData).length<=1){alert('마지막 견적 그룹은 삭제할 수 없습니다.');return;} if(confirm(`견적 ${groupId}을(를) 삭제하시겠습니까?`)){document.querySelector(`.quote-tab[data-group-id="${groupId}"]`)?.remove();document.getElementById(`group-content-${groupId}`)?.remove();delete quoteGroupsData[groupId];if(activeGroupId==groupId){const lastTab=document.querySelector('.quote-tab:last-child');if(lastTab){switchTab(lastTab.dataset.groupId);}}}}
function deleteActiveGroup(){if(activeGroupId)deleteGroup(activeGroupId);}
function copyActiveGroup() {
    if (!activeGroupId) return;
    alert("현재 탭의 모든 정보가 복사됩니다.\n(단, 호텔카드와 일정표 내용은 기술적 제약으로 인해 복사되지 않습니다.)");
    saveAllCalculatorsInGroup(activeGroupId);
    addNewGroup(quoteGroupsData[activeGroupId]);
}
function switchTab(newGroupId) {
    if (activeGroupId && activeGroupId !== newGroupId) {
        saveAllCalculatorsInGroup(activeGroupId); 
    }
    activeGroupId = newGroupId;
    document.querySelectorAll('.quote-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.groupId == newGroupId));
    document.querySelectorAll('.calculation-group-content').forEach(content => content.classList.toggle('active', content.id == `group-content-${newGroupId}`));
}

// --- 그룹 UI 초기화 및 생성 ---
function initializeGroup(groupEl, groupId) {
    groupEl.innerHTML = `<div class="flex gap-6">
        <div class="w-1/2 flex flex-col">
            <div id="calculators-wrapper-${groupId}" class="space-y-4"></div>
            <div class="mt-4">
                <button type="button" class="btn btn-outline add-calculator-btn w-full"><i class="fas fa-plus mr-2"></i>견적 계산 추가</button>
            </div>
        </div>
        <div class="w-1/2 space-y-6 right-panel-container">
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50"><div class="flex justify-between items-center mb-4"><h2 class="text-xl font-semibold text-gray-800">항공 스케줄</h2><div class="flex items-center space-x-2"><button type="button" class="btn btn-sm btn-secondary copy-flight-schedule-btn" title="항공 스케줄 HTML 복사"><i class="fas fa-clipboard"></i> 복사</button><button type="button" class="btn btn-sm btn-secondary parse-gds-btn">GDS 파싱</button><button type="button" class="btn btn-sm btn-secondary add-flight-subgroup-btn"><i class="fas fa-plus mr-1"></i> 스케줄 추가</button></div></div><div class="space-y-4 flight-schedule-container"></div></section>
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50"><div class="flex justify-between items-center mb-4"><h2 class="text-xl font-semibold text-gray-800">요금 안내</h2><div class="flex items-center space-x-2"><button type="button" class="btn btn-sm btn-secondary copy-price-info-btn" title="요금 안내 HTML 복사"><i class="fas fa-clipboard"></i> 복사</button><button type="button" class="btn btn-sm btn-secondary add-price-subgroup-btn"><i class="fas fa-plus mr-1"></i> 요금 그룹 추가</button></div></div><div class="space-y-4 price-info-container"></div></section>
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50"><div class="flex justify-between items-center mb-4"><h2 class="text-xl font-semibold text-gray-800">포함/불포함 사항</h2><button type="button" class="btn btn-sm btn-secondary copy-inclusion-exclusion-btn" title="포함/불포함 HTML 복사"><i class="fas fa-clipboard"></i> 복사</button></div><div class="flex gap-4"><div class="w-1/2 flex flex-col"><h3 class="font-medium mb-1">포함</h3><textarea class="input-field flex-grow inclusion-text" rows="5"></textarea></div><div class="w-1/2 flex flex-col"><h3 class="font-medium mb-1">불포함</h3><textarea class="input-field flex-grow exclusion-text" rows="5"></textarea></div></div></section>
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50"><h2 class="text-xl font-semibold text-gray-800 mb-4">호텔카드 메이커</h2><iframe src="./hotel_maker/index.html" style="width: 100%; height: 480px; border: 1px solid #ccc; border-radius: 0.25rem;"></iframe></section>
            <section class="p-6 border border-gray-200 rounded-lg bg-gray-50"><h2 class="text-xl font-semibold text-gray-800 mb-4">상세 일정표</h2><iframe src="./itinerary_planner/index.html" style="width: 100%; height: 800px; border: 1px solid #ccc; border-radius: 0.25rem;"></iframe></section>
        </div>
    </div>`;

    const groupData = quoteGroupsData[groupId];
    const calculatorsWrapper = groupEl.querySelector(`#calculators-wrapper-${groupId}`);
    
    if (groupData.calculators && groupData.calculators.length > 0) {
        groupData.calculators.forEach(calcData => createCalculatorInstance(calculatorsWrapper, groupId, calcData));
    } else {
        const newCalcData = { id: `calc_${Date.now()}`, pnr: '', tableHTML: null };
        groupData.calculators.push(newCalcData);
        createCalculatorInstance(calculatorsWrapper, groupId, newCalcData);
    }

    groupEl.querySelector('.add-calculator-btn').addEventListener('click', () => {
        saveAllCalculatorsInGroup(groupId);
        const newCalcData = { id: `calc_${Date.now()}`, pnr: '', tableHTML: null };
        groupData.calculators.push(newCalcData);
        createCalculatorInstance(calculatorsWrapper, groupId, newCalcData);
    });

    const flightContainer = groupEl.querySelector('.flight-schedule-container');
    groupData.flightSchedule.forEach(subgroup => createFlightSubgroup(flightContainer, subgroup, groupId));
    const priceContainer = groupEl.querySelector('.price-info-container');
    groupData.priceInfo.forEach(subgroup => createPriceSubgroup(priceContainer, subgroup, groupId));
    const inclusionTextEl = groupEl.querySelector('.inclusion-text');
    const exclusionTextEl = groupEl.querySelector('.exclusion-text');
    inclusionTextEl.value = groupData.inclusionText;
    exclusionTextEl.value = groupData.exclusionText;
    inclusionTextEl.addEventListener('input', e => { groupData.inclusionText = e.target.value; });
    exclusionTextEl.addEventListener('input', e => { groupData.exclusionText = e.target.value; });
    groupEl.querySelector('.parse-gds-btn').addEventListener('click', () => { window.open('./gds_parser/gds_parser.html', 'GDS_Parser', `width=800,height=500,top=${(screen.height/2)-250},left=${(screen.width/2)-400}`); });
    groupEl.querySelector('.add-flight-subgroup-btn').addEventListener('click', () => { const sg = { id: `flight_sub_${Date.now()}`, title: "", rows: [{}] }; groupData.flightSchedule.push(sg); createFlightSubgroup(flightContainer, sg, groupId); });
    groupEl.querySelector('.add-price-subgroup-btn').addEventListener('click', () => { const sg = { id: `price_sub_${Date.now()}`, title: "", rows: [{ item: "성인요금", price: 0, count: 1, remarks: "" }] }; groupData.priceInfo.push(sg); createPriceSubgroup(priceContainer, sg, groupId); });
    groupEl.querySelector('.copy-flight-schedule-btn').addEventListener('click', () => copyHtmlToClipboard(generateFlightScheduleInlineHtml(groupData.flightSchedule)));
    groupEl.querySelector('.copy-price-info-btn').addEventListener('click', () => copyHtmlToClipboard(generatePriceInfoInlineHtml(groupData.priceInfo)));
    groupEl.querySelector('.copy-inclusion-exclusion-btn').addEventListener('click', () => copyHtmlToClipboard(generateInclusionExclusionInlineHtml(groupData.inclusionText, groupData.exclusionText)));
}

// --- 좌측 계산기 관련 함수 ---
function createCalculatorInstance(wrapper, groupId, calcData) {
    const instanceContainer = document.createElement('div');
    instanceContainer.className = 'calculator-instance border p-4 rounded-lg relative bg-white shadow';
    instanceContainer.dataset.calculatorId = calcData.id;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'absolute top-2 right-2 text-gray-400 hover:text-red-600 z-10';
    deleteBtn.innerHTML = '<i class="fas fa-times-circle"></i>';
    deleteBtn.title = '이 계산기 삭제';
    
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('이 견적 계산기를 삭제하시겠습니까?')) {
            const groupData = quoteGroupsData[groupId];
            if (groupData) {
                groupData.calculators = groupData.calculators.filter(c => c.id !== calcData.id);
            }
            instanceContainer.remove();
        }
    });

    instanceContainer.appendChild(deleteBtn);
    wrapper.appendChild(instanceContainer);

    buildCalculatorDOM(instanceContainer);
    if (calcData) {
        restoreCalculatorState(instanceContainer, calcData);
    }
}
function saveAllCalculatorsInGroup(groupId) {
    if (!groupId || !quoteGroupsData[groupId]) return;
    const groupEl = document.getElementById(`group-content-${groupId}`);
    if (!groupEl) return;
    const calculatorInstances = groupEl.querySelectorAll('.calculator-instance');
    const savedCalculatorsData = [];
    calculatorInstances.forEach(instance => {
        const calcId = instance.dataset.calculatorId;
        const pnr = instance.querySelector('.pnr-pane textarea').value;
        const tableHTML = instance.querySelector('.quote-table').innerHTML;
        savedCalculatorsData.push({ id: calcId, pnr, tableHTML });
    });
    quoteGroupsData[groupId].calculators = savedCalculatorsData;
}
function restoreCalculatorState(instanceContainer, calcData) {
    if (!instanceContainer || !calcData) return;
    const pnrTextarea = instanceContainer.querySelector('.pnr-pane textarea');
    if(pnrTextarea) pnrTextarea.value = calcData.pnr || '';
    const table = instanceContainer.querySelector('.quote-table');
    if (table && calcData.tableHTML) {
        table.innerHTML = calcData.tableHTML;
        rebindCalculatorEventListeners(instanceContainer);
    } else {
        addPersonTypeColumn(instanceContainer, '성인', 1);
    }
    calculateAll(instanceContainer);
}

// ▼▼▼ [수정됨] rebindCalculatorEventListeners 함수, 이벤트 바인딩 방식 개선 ▼▼▼
function rebindCalculatorEventListeners(calcContainer) {
    const calcAll = () => calculateAll(calcContainer);
    // data-bound 속성을 사용하여 이벤트 중복 바인딩 방지
    const addListener = (selector, event, handler) => {
        calcContainer.querySelectorAll(selector).forEach(el => {
            if (el.dataset.bound) return;
            el.dataset.bound = "true";
            el.addEventListener(event, handler);
        });
    };

    addListener('input', 'input', calcAll);
    calcContainer.querySelectorAll('.person-type-name-span:not([data-bound])').forEach(span => { span.dataset.bound = "true"; makeEditable(span, 'text', calcAll); });
    calcContainer.querySelectorAll('.person-count-span:not([data-bound])').forEach(span => { span.dataset.bound = "true"; makeEditable(span, 'number', calcAll); });
    calcContainer.querySelectorAll('.dynamic-row-label-span:not([data-bound])').forEach(span => { span.dataset.bound = "true"; makeEditable(span, 'text', () => {}); });

    calcContainer.querySelectorAll('th .remove-col-btn:not([data-bound])').forEach((btn) => {
        btn.dataset.bound = "true";
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

    calcContainer.querySelectorAll('.dynamic-row-delete-btn:not([data-bound])').forEach(btn => {
        btn.dataset.bound = "true";
        btn.addEventListener('click', () => {
            if (confirm('해당 항목을 삭제하시겠습니까?')) {
                btn.closest('tr').remove();
                calcAll();
            }
        });
    });

    updateSummaryRow(calcContainer);
}
// ▼▼▼ [수정됨] buildCalculatorDOM 함수, 버튼 이벤트 리스너 직접 할당 ▼▼▼
function buildCalculatorDOM(calcContainer) {
    const content = document.createElement('div');
    content.innerHTML = `<div class="split-container"><div class="pnr-pane"><label class="label-text font-semibold mb-2">PNR 정보</label><textarea class="w-full flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm resize-none" placeholder="PNR 정보를 여기에 붙여넣으세요."></textarea></div><div class="resizer-handle"></div><div class="quote-pane"><div class="table-container"><table class="quote-table"><thead><tr class="header-row"><th><button type="button" class="btn btn-sm btn-primary add-person-type-btn"><i class="fas fa-plus"></i> 항목 추가</button></th></tr><tr class="count-row"><th></th></tr></thead><tbody></tbody><tfoot></tfoot></table></div></div></div>`;
    
    const calculatorElement = content.firstElementChild;
    calcContainer.appendChild(calculatorElement);
    
    initializeSplitView(calculatorElement.querySelector('.split-container'));

    // 버튼에 이벤트 리스너를 여기서 직접 할당
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
function updateSummaryRow(calcContainer) {
    const table = calcContainer.querySelector('.quote-table');
    let tfoot = table.querySelector('tfoot');
    if (!tfoot) { tfoot = document.createElement('tfoot'); table.appendChild(tfoot); }
    tfoot.innerHTML = '';
    const headerRow = table.querySelector('.header-row');
    if (!headerRow) return;
    const colCount = headerRow.cells.length;
    if (colCount <= 1) return;
    const summaryRow = tfoot.insertRow();
    const labelCell = summaryRow.insertCell(0);
    labelCell.innerHTML = '<div class="p-2 font-bold text-center">전체 합계</div>';
    const summaryCell = summaryRow.insertCell(1);
    summaryCell.colSpan = colCount - 1;
    summaryCell.innerHTML = `<div class="totals-summary-section flex items-center justify-around p-1"><div class="text-center mx-2"><span class="text-base font-medium text-gray-600">전체상품가 </span><span class="text-lg font-bold text-indigo-700 totalSalesPrice">0 원</span></div><div class="text-center mx-2"><span class="text-base font-medium text-gray-600">전체수익 </span><span class="text-lg font-bold text-indigo-700 totalProfit">0 원</span></div><div class="text-center mx-2"><span class="text-base font-medium text-gray-600">전체수익률 </span><span class="text-lg font-bold text-indigo-700 totalProfitMargin">0.00 %</span></div></div>`;
    labelCell.style.borderTop = "2px solid #a0aec0";
    summaryCell.style.borderTop = "2px solid #a0aec0";
}
function calculateAll(calcContainer){if(!calcContainer)return;const table=calcContainer.querySelector('.quote-table');if(!table)return;const headerRow=table.querySelector('.header-row');if(!headerRow)return;const numCols=headerRow.cells.length;let grandTotalSales=0,grandTotalProfit=0;for(let i=1;i<numCols;i++){const countCell=table.querySelector(`.count-row th:nth-child(${i+1})`);if(!countCell)continue;const count=parseInt(countCell.textContent.replace(/,/g,''),10)||0;let netCost=0;table.querySelectorAll(`tbody tr td:nth-child(${i+1}) .cost-item`).forEach(input=>{netCost+=evaluateMath(input.value);});const salesPriceInput=table.querySelector(`tbody tr td:nth-child(${i+1}) .sales-price`);const salesPrice=salesPriceInput?evaluateMath(salesPriceInput.value):0;const profitPerPerson=salesPrice-netCost;const profitMargin=salesPrice>0?(profitPerPerson/salesPrice):0;updateCalculatedCell(table,i,'netCost',formatCurrency(netCost));updateCalculatedCell(table,i,'profitPerPerson',formatCurrency(profitPerPerson));updateCalculatedCell(table,i,'profitMargin',formatPercentage(profitMargin));grandTotalSales+=salesPrice*count;grandTotalProfit+=profitPerPerson*count;}const grandTotalProfitMargin=grandTotalSales>0?(grandTotalProfit/grandTotalSales):0;const summarySection=calcContainer.querySelector('.totals-summary-section');if(!summarySection)return;summarySection.querySelector('.totalSalesPrice').textContent=formatCurrency(grandTotalSales);summarySection.querySelector('.totalProfit').textContent=formatCurrency(grandTotalProfit);summarySection.querySelector('.totalProfitMargin').textContent=formatPercentage(grandTotalProfitMargin);}
function updateCalculatedCell(table,colIndex,rowId,value){const row=table.querySelector(`tbody tr[data-row-id="${rowId}"]`);if(row&&row.cells[colIndex]){const div=row.cells[colIndex].querySelector('div');if(div)div.textContent=value;}}
function getCellContent(rowId,colIndex,type){const name=`group[${colIndex}][${rowId}]`;switch(type){case'costInput':return`<input type="text" class="input-field-sm cost-item" name="${name}" value="0" placeholder="0">`;case'salesInput':return`<input type="text" class="input-field-sm sales-price" name="${name}" value="0" placeholder="0">`;case'calculated':return`<div class="calculated-field" data-row-id="${rowId}">0 원</div>`;case'calculatedPercentage':return`<div class="calculated-field" data-row-id="${rowId}">0.00 %</div>`;default:return'';}}
function makeEditable(element,inputType,onBlurCallback){if(!element||element.querySelector('input'))return;const clickHandler=()=>{if(element.style.display==='none')return;const currentText=element.textContent;const input=document.createElement('input');input.type=inputType;input.value=inputType==='number'?parseInt(currentText.replace(/,/g,''),10)||0:currentText;input.className='person-type-input';element.style.display='none';element.parentNode.insertBefore(input,element.nextSibling);input.focus();const finishEditing=()=>{element.textContent=input.value;element.style.display='';if(input.parentNode)input.parentNode.removeChild(input);if(onBlurCallback)onBlurCallback();};input.addEventListener('blur',finishEditing);input.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='Escape')e.target.blur();});};element.addEventListener('click',clickHandler);}
function initializeSplitView(calcContainer){if(!calcContainer)return;const pnrPane=calcContainer.querySelector('.pnr-pane');const resizer=calcContainer.querySelector('.resizer-handle');if(!pnrPane||!resizer)return;resizer.addEventListener('mousedown',(e)=>{e.preventDefault();document.body.style.cursor='col-resize';const doDrag=(dragEvent)=>{const rect=calcContainer.getBoundingClientRect();let newWidth=dragEvent.clientX-rect.left;if(newWidth<150)newWidth=150;if(newWidth>rect.width-350)newWidth=rect.width-350;pnrPane.style.width=newWidth+'px';};const stopDrag=()=>{document.removeEventListener('mousemove',doDrag);document.removeEventListener('mouseup',stopDrag);document.body.style.cursor='default';};document.addEventListener('mousemove',doDrag);document.addEventListener('mouseup',stopDrag);});}
function setupColumnEventListeners(calcContainer,colIndex,headerCell,countCell){if(!headerCell||!countCell)return;const calcAllForGroup=()=>calculateAll(calcContainer);makeEditable(headerCell.querySelector('.person-type-name-span'),'text',calcAllForGroup);makeEditable(countCell.querySelector('.person-count-span'),'number',calcAllForGroup);const removeBtn=headerCell.querySelector('.remove-col-btn');if(removeBtn){removeBtn.addEventListener('click',()=>{if(!confirm(`'${headerCell.textContent.trim()}' 항목을 삭제하시겠습니까?`))return;calcContainer.querySelectorAll('.quote-table tr').forEach(row=>{if(row.cells.length>colIndex)row.deleteCell(colIndex);});updateSummaryRow(calcContainer);calcAllForGroup();});}calcContainer.querySelectorAll('tbody tr').forEach(tr=>{const cell=tr.cells[colIndex];if(cell){const input=cell.querySelector('input');if(input)input.addEventListener('input',calcAllForGroup);}});}
function addPersonTypeColumn(calcContainer,typeName='성인',count=1){const table=calcContainer.querySelector('.quote-table');if(!table)return;const headerRow=table.querySelector('thead .header-row');const colIndex=headerRow.cells.length;const headerCell=document.createElement('th');headerCell.innerHTML=`<div class="relative"><span class="person-type-name-span">${typeName}</span><button type="button" class="remove-col-btn" title="이 항목 삭제"><i class="fas fa-times"></i></button></div>`;headerRow.appendChild(headerCell);const countCell=document.createElement('th');countCell.innerHTML=`<span class="person-count-span">${count}</span>`;table.querySelector('thead .count-row').appendChild(countCell);table.querySelectorAll('tbody tr').forEach(tr=>{const rowId=tr.dataset.rowId;const rowDef=ROW_DEFINITIONS.find(r=>r.id===rowId)||{type:'costInput'};tr.insertCell(-1).innerHTML=getCellContent(rowId,colIndex,rowDef.type);});setupColumnEventListeners(calcContainer,colIndex,headerCell,countCell);updateSummaryRow(calcContainer);calculateAll(calcContainer);}
function addDynamicCostRow(calcContainer,label='신규 항목'){const table=calcContainer.querySelector('.quote-table');if(!table)return;const tbody=table.querySelector('tbody');const numCols=table.querySelector('thead .header-row').cells.length;const rowId=`dynamic_${Date.now()}`;const buttonRow=tbody.querySelector('tr[data-row-id="addDynamicRow"]');if(!buttonRow)return;const insertionIndex=Array.from(tbody.rows).indexOf(buttonRow);const newRow=tbody.insertRow(insertionIndex);newRow.dataset.rowId=rowId;newRow.insertCell(0).innerHTML=`<div class="flex items-center"><button type="button" class="dynamic-row-delete-btn"><i class="fas fa-trash-alt"></i></button><span class="dynamic-row-label-span ml-2">${label}</span></div>`;for(let i=1;i<numCols;i++){newRow.insertCell(i).innerHTML=getCellContent(rowId,i,'costInput');}const calcAllForGroup=()=>calculateAll(calcContainer);newRow.querySelectorAll('.cost-item').forEach(input=>input.addEventListener('input',calcAllForGroup));makeEditable(newRow.querySelector('.dynamic-row-label-span'),'text',calcAllForGroup);newRow.querySelector('.dynamic-row-delete-btn').addEventListener('click',()=>{if(confirm(`'${newRow.querySelector('.dynamic-row-label-span').textContent}' 항목을 삭제하시겠습니까?`)){newRow.remove();calcAllForGroup();}});calcAllForGroup();}
function createFlightSubgroup(container,subgroupData,groupId){const subGroupDiv=document.createElement('div');subGroupDiv.className='dynamic-section flight-schedule-subgroup';subGroupDiv.id=subgroupData.id;subGroupDiv.innerHTML=`<button type="button" class="delete-dynamic-section-btn" title="이 스케줄 그룹 삭제"><i class="fas fa-trash-alt"></i></button><div class="mb-2"><input type="text" class="input-field" placeholder="항공사 (예: 이스타항공)" value="${subgroupData.title||''}"></div><div class="overflow-x-auto"><table class="flight-schedule-table"><thead><tr><th>편명</th><th>출발일</th><th>출발지</th><th>출발시간</th><th>도착일</th><th>도착지</th><th>도착시간</th><th style="width: 50px;">삭제</th></tr></thead><tbody></tbody></table></div><div class="add-row-btn-container pt-2"><button type="button" class="add-row-btn"><i class="fas fa-plus mr-1"></i> 행 추가</button></div>`;const tbody=subGroupDiv.querySelector('tbody');subgroupData.rows.forEach(rowData=>addFlightRow(tbody,rowData,subgroupData));subGroupDiv.querySelector('.delete-dynamic-section-btn').addEventListener('click',()=>{if(confirm('이 항공 스케줄 그룹을 삭제하시겠습니까?')){quoteGroupsData[groupId].flightSchedule=quoteGroupsData[groupId].flightSchedule.filter(g=>g.id!==subgroupData.id);subGroupDiv.remove();}});subGroupDiv.querySelector('input[type="text"]').addEventListener('input',e=>{subgroupData.title=e.target.value;});subGroupDiv.querySelector('.add-row-btn').addEventListener('click',()=>{const newRowData={};subgroupData.rows.push(newRowData);addFlightRow(tbody,newRowData,subgroupData);});container.appendChild(subGroupDiv);}
function addFlightRow(tbody,rowData,subgroupData){const tr=document.createElement('tr');const fields=[{key:'flightNum',placeholder:'ZE561'},{key:'depDate',placeholder:'07/09'},{key:'originCity',placeholder:'ICN'},{key:'depTime',placeholder:'20:55'},{key:'arrDate',placeholder:'07/09'},{key:'destCity',placeholder:'CXR'},{key:'arrTime',placeholder:'23:55'}];tr.innerHTML=fields.map(f=>`<td><input type="text" class="flight-schedule-input" data-field="${f.key}" value="${rowData[f.key]||''}" placeholder="${f.placeholder}"></td>`).join('')+`<td class="text-center"><button type="button" class="delete-row-btn" title="이 행 삭제"><i class="fas fa-trash"></i></button></td>`;tbody.appendChild(tr);tr.querySelectorAll('input').forEach(input=>input.addEventListener('input',e=>{const field=e.target.dataset.field;rowData[field]=e.target.value;}));tr.querySelector('.delete-row-btn').addEventListener('click',()=>{const rowIndex=Array.from(tbody.children).indexOf(tr);subgroupData.rows.splice(rowIndex,1);tr.remove();});}
function createPriceSubgroup(container,subgroupData,groupId){const subGroupDiv=document.createElement('div');subGroupDiv.className='dynamic-section price-subgroup';subGroupDiv.id=subgroupData.id;subGroupDiv.innerHTML=`<button type="button" class="delete-dynamic-section-btn" title="이 요금 그룹 삭제"><i class="fas fa-trash-alt"></i></button><input type="text" class="input-field mb-2" placeholder="견적설명 (예: 인천출발, A객실)" value="${subgroupData.title||''}"><table class="price-table"><thead><tr><th style="width:25%">내역</th><th>1인당금액</th><th>인원</th><th>총금액</th><th style="width:30%">비고</th><th style="width:50px">삭제</th></tr></thead><tbody></tbody><tfoot><tr><td colspan="3" class="text-right font-bold pr-2">총 합계</td><td class="grand-total">0</td><td colspan="2"><button type="button" class="add-row-btn"><i class="fas fa-plus mr-1"></i>행 추가</button></td></tr></tfoot></table>`;const tbody=subGroupDiv.querySelector('tbody');subgroupData.rows.forEach(rowData=>addPriceRow(tbody,rowData,subgroupData,subGroupDiv,groupId));updateGrandTotal(subGroupDiv,groupId);subGroupDiv.querySelector('.delete-dynamic-section-btn').addEventListener('click',()=>{if(confirm('이 요금 그룹을 삭제하시겠습니까?')){quoteGroupsData[groupId].priceInfo=quoteGroupsData[groupId].priceInfo.filter(g=>g.id!==subgroupData.id);subGroupDiv.remove();}});subGroupDiv.querySelector('input.input-field').addEventListener('input',e=>{subgroupData.title=e.target.value;});subGroupDiv.querySelector('.add-row-btn').addEventListener('click',()=>{const newRow={item:"",price:0,count:1,remarks:""};subgroupData.rows.push(newRow);addPriceRow(tbody,newRow,subgroupData,subGroupDiv,groupId);});container.appendChild(subGroupDiv);}
function addPriceRow(tbody,rowData,subgroupData,subGroupDiv,groupId){const tr=document.createElement('tr');const fields=[{key:'item',align:'left'},{key:'price',align:'right'},{key:'count',align:'center'},{key:'total',align:'right',readonly:true},{key:'remarks',align:'left'}];tr.innerHTML=fields.map(f=>`<td><input type="text" class="text-${f.align}" data-field="${f.key}" value="${rowData[f.key]||''}" ${f.readonly?'readonly':''}></td>`).join('')+`<td><button type="button" class="delete-row-btn"><i class="fas fa-trash"></i></button></td>`;tbody.appendChild(tr);const updateRow=()=>{const price=parseFloat(rowData.price)||0;const count=parseInt(rowData.count)||0;const total=price*count;rowData.total=total;tr.querySelector('[data-field="total"]').value=total.toLocaleString();updateGrandTotal(subGroupDiv,groupId);};tr.querySelectorAll('input:not([readonly])').forEach(input=>input.addEventListener('input',e=>{rowData[e.target.dataset.field]=e.target.value.replace(/,/g,'');updateRow();}));tr.querySelector('.delete-row-btn').addEventListener('click',()=>{if(subgroupData.rows.length>1){const rowIndex=Array.from(tbody.children).indexOf(tr);subgroupData.rows.splice(rowIndex,1);tr.remove();updateGrandTotal(subGroupDiv,groupId);}else{alert('최소 한 개의 요금 항목은 유지해야 합니다.');}});updateRow();}
function updateGrandTotal(subGroupDiv,groupId){const subgroupData=quoteGroupsData[groupId]?.priceInfo.find(g=>g.id===subGroupDiv.id);if(!subgroupData)return;const grandTotal=subgroupData.rows.reduce((sum,row)=>(sum+(parseFloat(row.price)||0)*(parseInt(row.count)||0)),0);subGroupDiv.querySelector('.grand-total').textContent=grandTotal.toLocaleString();}
function generateInclusionExclusionInlineHtml(inclusionText,exclusionText){const i=inclusionText.replace(/\n/g,'<br>');const e=exclusionText.replace(/\n/g,'<br>');return`<table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:12px"><tbody><tr><td style="vertical-align:top;width:50%;padding-right:10px"><h3 style="font-size:16px;font-weight:600;margin-bottom:8px">포함</h3><div style="padding:8px;border:1px solid #eee;min-height:100px">${i}</div></td><td style="vertical-align:top;width:50%;padding-left:10px"><h3 style="font-size:16px;font-weight:600;margin-bottom:8px">불포함</h3><div style="padding:8px;border:1px solid #eee;min-height:100px">${e}</div></td></tr></tbody></table>`;}
function generatePriceInfoInlineHtml(priceData){let html='';priceData.forEach(subgroup=>{html+=`<h4 style="font-size:14px;font-weight:600;margin-bottom:8px">${subgroup.title||'요금 안내'}</h4><table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:12px;margin-bottom:16px"><thead><tr style="background-color:#f9fafb"><th style="border:1px solid #ddd;padding:8px;text-align:center">내역</th><th style="border:1px solid #ddd;padding:8px;text-align:center">1인당 금액</th><th style="border:1px solid #ddd;padding:8px;text-align:center">인원</th><th style="border:1px solid #ddd;padding:8px;text-align:center">총 금액</th><th style="border:1px solid #ddd;padding:8px;text-align:center">비고</th></tr></thead><tbody>`;let grandTotal=0;subgroup.rows.forEach(row=>{const p=parseFloat(row.price)||0;const c=parseInt(row.count)||0;const t=p*c;grandTotal+=t;html+=`<tr><td style="border:1px solid #ddd;padding:8px">${row.item||''}</td><td style="border:1px solid #ddd;padding:8px;text-align:right">${p.toLocaleString()}</td><td style="border:1px solid #ddd;padding:8px;text-align:center">${c}</td><td style="border:1px solid #ddd;padding:8px;text-align:right">${t.toLocaleString()}</td><td style="border:1px solid #ddd;padding:8px">${row.remarks||''}</td></tr>`;});html+=`</tbody><tfoot><tr style="font-weight:bold"><td colspan="3" style="border:1px solid #ddd;padding:8px;text-align:right">총 합계</td><td style="border:1px solid #ddd;padding:8px;text-align:right">${grandTotal.toLocaleString()}</td><td style="border:1px solid #ddd;padding:8px"></td></tr></tfoot></table>`;});return html;}
function generateFlightScheduleInlineHtml(flightData){let html='';flightData.forEach(subgroup=>{html+=`<h4 style="font-size:14px;font-weight:600;margin-bottom:8px">${subgroup.title||'항공 스케줄'}</h4><table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:12px;margin-bottom:16px"><thead><tr style="background-color:#f9fafb"><th style="border:1px solid #ddd;padding:8px;text-align:left">편명</th><th style="border:1px solid #ddd;padding:8px;text-align:left">출발일</th><th style="border:1px solid #ddd;padding:8px;text-align:left">출발지</th><th style="border:1px solid #ddd;padding:8px;text-align:left">출발시간</th><th style="border:1px solid #ddd;padding:8px;text-align:left">도착일</th><th style="border:1px solid #ddd;padding:8px;text-align:left">도착지</th><th style="border:1px solid #ddd;padding:8px;text-align:left">도착시간</th></tr></thead><tbody>`;subgroup.rows.forEach(row=>{html+=`<tr><td style="border:1px solid #ddd;padding:8px">${row.flightNum||''}</td><td style="border:1px solid #ddd;padding:8px">${row.depDate||''}</td><td style="border:1px solid #ddd;padding:8px">${row.originCity||''}</td><td style="border:1px solid #ddd;padding:8px">${row.depTime||''}</td><td style="border:1px solid #ddd;padding:8px">${row.arrDate||''}</td><td style="border:1px solid #ddd;padding:8px">${row.destCity||''}</td><td style="border:1px solid #ddd;padding:8px">${row.arrTime||''}</td></tr>`;});html+=`</tbody></table>`;});return html;}

// =======================================================================
// 4. 시스템 시작 (DOM 로드 후 실행)
// =======================================================================
document.addEventListener('DOMContentLoaded', () => {
    const restoredDataScript = document.getElementById('restored-data');
    let restoredData = null;
    if (restoredDataScript && restoredDataScript.textContent.trim()) {
        try { restoredData = JSON.parse(restoredDataScript.textContent); } 
        catch (e) { console.error("저장된 데이터를 파싱하는 데 실패했습니다.", e); alert("데이터를 불러오는 데 실패했습니다. 새 견적으로 시작합니다."); }
    }

    if (restoredData) {
        quoteGroupsData = restoredData.quoteGroupsData || {};
        groupCounter = restoredData.groupCounter || 0;
        document.getElementById('memoText').value = restoredData.memoText || '';
        if (Object.keys(quoteGroupsData).length === 0) {
            addNewGroup();
        } else {
            Object.keys(quoteGroupsData).forEach(id => {
                if (!quoteGroupsData[id].calculators) {
                    quoteGroupsData[id].calculators = [quoteGroupsData[id].calculatorState || { id: `calc_${Date.now()}`, pnr: '', tableHTML: null }];
                    delete quoteGroupsData[id].calculatorState;
                }
                addNewGroup(quoteGroupsData[id]); 
            });
        }
        switchTab(restoredData.activeGroupId || (Object.keys(quoteGroupsData).length > 0 ? Object.keys(quoteGroupsData)[0] : null));
    } else {
        addNewGroup();
    }
    
    const addCustomerBtn = document.getElementById('addCustomerBtn');
    if(addCustomerBtn) { addCustomerBtn.addEventListener('click', () => createCustomerCard()); }
    createCustomerCard({ name: '', phone: '', email: '' });
    
    document.getElementById('newGroupBtn').addEventListener('click', () => addNewGroup());
    document.getElementById('copyGroupBtn').addEventListener('click', copyActiveGroup);
    document.getElementById('deleteGroupBtn').addEventListener('click', deleteActiveGroup);
    document.getElementById('saveBtn').addEventListener('click', saveToFile);
    document.getElementById('saveAsBtn').addEventListener('click', saveToFile);
    document.getElementById('loadFile').addEventListener('change', (e) => { if (e.target.files.length > 0) { loadFromFile(e.target.files[0]); } });
    document.getElementById('quoteForm').addEventListener('reset', (e) => { e.preventDefault(); if (confirm("작성중인 모든 내용을 삭제하고 새로 시작하시겠습니까?")) { window.location.reload(); } });
});
