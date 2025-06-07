// ======== 전역 스코프 함수 및 변수 ========
let flightScheduleData = [];
let priceInfoData = [];

const ROW_DEFINITIONS = [
    { id: 'airfare', label: '항공', type: 'costInput' }, { id: 'hotel', label: '호텔', type: 'costInput' },
    { id: 'ground', label: '지상', type: 'costInput' }, { id: 'insurance', label: '보험', type: 'costInput' },
    { id: 'commission', label: '커미션', type: 'costInput' }, { id: 'addDynamicRow', label: '+ 항목 추가', type: 'button' },
    { id: 'netCost', label: '넷가', type: 'calculated' }, { id: 'salesPrice', label: '상품가', type: 'salesInput' },
    { id: 'profitPerPerson', label: '1인수익', type: 'calculated' }, { id: 'profitMargin', label: '1인수익률', type: 'calculatedPercentage' }
];


function addFlightsFromParser(parsedFlights) {
    if (!parsedFlights || parsedFlights.length === 0) return;
    const airlineCodeMap = { "VN": "베트남항공", "ZE": "이스타항공", "KE": "대한항공", "OZ": "아시아나항공" };
    const firstFlightAirlineCode = parsedFlights[0].airlineCode;
    const subgroupTitle = airlineCodeMap[firstFlightAirlineCode] || firstFlightAirlineCode;
    const newSubgroup = { id: `flight_sub_${Date.now()}`, title: subgroupTitle, rows: parsedFlights.map(flight => ({ ...flight })) };
    flightScheduleData.push(newSubgroup);
    createFlightSubgroup(newSubgroup);
}

function createFlightSubgroup(subgroupData) {
    const container = document.getElementById('flightScheduleContainer');
    if (!container) return;
    const subGroupDiv = document.createElement('div');
    subGroupDiv.className = 'dynamic-section flight-schedule-subgroup';
    subGroupDiv.id = subgroupData.id;
    subGroupDiv.innerHTML = `<button type="button" class="delete-dynamic-section-btn" title="이 스케줄 그룹 삭제"><i class="fas fa-trash-alt"></i></button><div class="mb-2"><input type="text" class="input-field" placeholder="항공사 (예: 이스타항공)" value="${subgroupData.title}"></div><div class="overflow-x-auto"><table class="flight-schedule-table"><thead><tr><th>편명</th><th>출발일</th><th>출발지</th><th>출발시간</th><th>도착일</th><th>도착지</th><th>도착시간</th><th style="width: 50px;">삭제</th></tr></thead><tbody></tbody></table></div><div class="add-row-btn-container pt-2"><button type="button" class="add-row-btn"><i class="fas fa-plus mr-1"></i> 행 추가</button></div>`;
    const tbody = subGroupDiv.querySelector('tbody');
    subgroupData.rows.forEach((rowData, index) => { addFlightRow(tbody, rowData, subgroupData.id, index); });
    subGroupDiv.querySelector('.delete-dynamic-section-btn').addEventListener('click', () => { if (confirm('이 항공 스케줄 그룹을 삭제하시겠습니까?')) { flightScheduleData = flightScheduleData.filter(group => group.id !== subgroupData.id); subGroupDiv.remove(); } });
    subGroupDiv.querySelector('input[type="text"]').addEventListener('input', (e) => { subgroupData.title = e.target.value; });
    subGroupDiv.querySelector('.add-row-btn').addEventListener('click', () => {
        const newRowData = { flightNum: "", depDate: "", originCity: "", depTime: "", arrDate: "", destCity: "", arrTime: "" };
        subgroupData.rows.push(newRowData);
        addFlightRow(tbody, newRowData, subgroupData.id, subgroupData.rows.length - 1);
    });
    container.appendChild(subGroupDiv);
}

function addFlightRow(tbody, rowData, subgroupId, rowIndex) {
    const tr = document.createElement('tr');
    tr.dataset.rowIndex = rowIndex;
    const fields = [{ key: 'flightNum', placeholder: 'ZE 561' }, { key: 'depDate', placeholder: '07월 09일' }, { key: 'originCity', placeholder: '인천' }, { key: 'depTime', placeholder: '20:55' }, { key: 'arrDate', placeholder: '07월 09일' }, { key: 'destCity', placeholder: '나트랑' }, { key: 'arrTime', placeholder: '23:55' }];
    let cellsHTML = '';
    fields.forEach(field => { cellsHTML += `<td><input type="text" class="flight-schedule-input" data-field="${field.key}" value="${rowData[field.key] || ''}" placeholder="${field.placeholder}"></td>`; });
    cellsHTML += `<td class="text-center"><button type="button" class="delete-row-btn" title="이 행 삭제"><i class="fas fa-trash"></i></button></td>`;
    tr.innerHTML = cellsHTML;
    tbody.appendChild(tr);
    tr.querySelectorAll('.flight-schedule-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const field = e.target.dataset.field;
            const subgroup = flightScheduleData.find(g => g.id === subgroupId);
            if (subgroup && subgroup.rows[rowIndex]) { subgroup.rows[rowIndex][field] = e.target.value; }
        });
    });
    tr.querySelector('.delete-row-btn').addEventListener('click', () => {
        const subgroup = flightScheduleData.find(g => g.id === subgroupId);
        if (subgroup) {
            subgroup.rows.splice(rowIndex, 1);
            tr.remove();
            tbody.querySelectorAll('tr').forEach((row, newIndex) => { row.dataset.rowIndex = newIndex; });
        }
    });
}

// --- 인라인 HTML 생성 및 복사 함수들 ---
function copyHtmlToClipboard(htmlString) {
    if (!htmlString || htmlString.trim() === "") {
        alert('복사할 내용이 없습니다.');
        return;
    }
    navigator.clipboard.writeText(htmlString).then(() => {
        alert('HTML 소스 코드가 클립보드에 복사되었습니다.');
    }).catch(err => {
        console.error('클립보드 복사 실패:', err);
        alert('복사에 실패했습니다. 브라우저 개발자 콘솔을 확인해주세요.');
    });
}

/**
 * 항공 스케줄 데이터를 인라인 스타일 HTML로 변환
 */
function generateFlightScheduleInlineHtml() {
    let html = '';
    flightScheduleData.forEach(subgroup => {
        html += `<table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 12px; margin-bottom: 16px;">`;
        html += `<thead><tr style="background-color: #f9fafb;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">편명</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">출발일</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">출발지</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">출발시간</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">도착일</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">도착지</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">도착시간</th>
                 </tr></thead><tbody>`;
        subgroup.rows.forEach(row => {
            html += `<tr>
                        <td style="border: 1px solid #ddd; padding: 8px;">${row.flightNum || ''}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${row.depDate || ''}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${row.originCity || ''}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${row.depTime || ''}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${row.arrDate || ''}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${row.destCity || ''}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${row.arrTime || ''}</td>
                     </tr>`;
        });
        html += `</tbody></table>`;
    });
    return html;
}

/**
 * 요금 안내 데이터를 인라인 스타일 HTML로 변환
 */
function generatePriceInfoInlineHtml() {
    let html = '';
    priceInfoData.forEach(subgroup => {
        html += `<table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 12px; margin-bottom: 16px;">`;
        html += `<thead><tr style="background-color: #f9fafb;">
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">내역</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">1인당 금액</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">인원</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">총 금액</th>
                    <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">비고</th>
                 </tr></thead><tbody>`;
        let grandTotal = 0;
        subgroup.rows.forEach(row => {
            const price = parseFloat(row.price) || 0;
            const count = parseInt(row.count) || 0;
            const total = price * count;
            grandTotal += total;
            html += `<tr>
                        <td style="border: 1px solid #ddd; padding: 8px;">${row.item || ''}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${price.toLocaleString()}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${count}</td>
                        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${total.toLocaleString()}</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${row.remarks || ''}</td>
                     </tr>`;
        });
        html += `</tbody><tfoot><tr style="font-weight: bold;">
                    <td colspan="3" style="border: 1px solid #ddd; padding: 8px; text-align: right;">총 합계</td>
                    <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${grandTotal.toLocaleString()}</td>
                    <td style="border: 1px solid #ddd; padding: 8px;"></td>
                 </tr></tfoot></table>`;
    });
    return html;
}

function generateInclusionExclusionInlineHtml() {
    const inclusionText = document.getElementById('inclusionText').value.replace(/\n/g, '<br>');
    const exclusionText = document.getElementById('exclusionText').value.replace(/\n/g, '<br>');
    let html = `<table style="width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 12px;"><tbody><tr>`;
    html += `<td style="vertical-align: top; width: 50%; padding-right: 10px;">
                <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">포함</h3>
                <div style="padding: 8px; border: 1px solid #eee; min-height: 100px;">${inclusionText}</div>
             </td>`;
    html += `<td style="vertical-align: top; width: 50%; padding-left: 10px;">
                <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">불포함</h3>
                <div style="padding: 8px; border: 1px solid #eee; min-height: 100px;">${exclusionText}</div>
             </td>`;
    html += `</tr></tbody></table>`;
    return html;
}

// ======== 페이지 로드 후 실행될 코드 ========
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('quoteForm');
    const quoteGroupContentsContainer = document.getElementById('quoteGroupContentsContainer');

    // ======== 왼쪽 패널: 견적 계산기 관련 ========
    
    // --- 유틸리티 함수 ---
    function evaluateMath(expression) { if(typeof expression!=='string'||!expression)return 0; const sanitizedExpression=expression.replace(/,/g,''); if(!/^[0-9+\-*/().\s]+$/.test(sanitizedExpression)){return parseFloat(sanitizedExpression)||0;} try{return new Function('return '+sanitizedExpression)();}catch(e){return parseFloat(sanitizedExpression)||0;} }
    function formatCurrency(amount) { return new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + ' 원'; }
    function formatPercentage(value) { return (isNaN(value) || !isFinite(value) ? 0 : value * 100).toFixed(2) + ' %'; }

    function makeEditable(element, inputType, onBlurCallback) {
        if (!element || element.querySelector('input')) return;
        element.addEventListener('click', () => {
            if (element.style.display === 'none') return;
            const currentText = element.textContent;
            const input = document.createElement('input');
            input.type = inputType;
            input.value = inputType === 'number' ? parseInt(currentText.replace(/,/g,''), 10) || 0 : currentText;
            input.className = 'person-type-input';
            
            element.style.display = 'none';
            element.parentNode.insertBefore(input, element.nextSibling);
            input.focus();
            const finishEditing = () => {
                element.textContent = input.value;
                element.style.display = '';
                if(input.parentNode) input.parentNode.removeChild(input);
                if (onBlurCallback) onBlurCallback();
            };
            input.addEventListener('blur', finishEditing);
            input.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); });
        });
    }

    // --- 계산 및 업데이트 함수 ---
    function calculateAll() {
        const calcGroupElement = document.getElementById('singleCalcGroup');
        const table = calcGroupElement.querySelector('.quote-table');
        if (!table) return;
        const numCols = table.querySelector('.header-row').cells.length;
        let grandTotalSales = 0, grandTotalProfit = 0;
        for (let i = 1; i < numCols; i++) {
            const countCell = table.querySelector(`.count-row th:nth-child(${i + 1})`);
            if (!countCell) continue;
            const count = parseInt(countCell.textContent.replace(/,/g, ''), 10) || 0;
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
        const summarySection = calcGroupElement.querySelector('.totals-summary-section');
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

    // --- 테이블 구조 관련 함수 ---
    function getCellContent(rowId, colIndex, type) {
        const name = `group[${colIndex}][${rowId}]`;
        switch(type){
            case 'costInput': return `<input type="text" class="input-field-sm cost-item" name="${name}" value="0" placeholder="0">`;
            case 'salesInput': return `<input type="text" class="input-field-sm sales-price" name="${name}" value="0" placeholder="0">`;
            case 'calculated': return `<div class="calculated-field" data-row-id="${rowId}">0 원</div>`;
            case 'calculatedPercentage': return `<div class="calculated-field" data-row-id="${rowId}">0.00 %</div>`;
            default: return '';
        }
    }

    function addPersonTypeColumn(typeName = '성인', count = 1) {
        const calcGroupElement = document.getElementById('singleCalcGroup');
        const table = calcGroupElement.querySelector('.quote-table');
        if (!table) return;
        const colIndex = table.querySelector('thead .header-row').cells.length;
        const headerCell = document.createElement('th');
        headerCell.innerHTML = `<div class="relative"><span class="person-type-name-span">${typeName}</span><button type="button" class="remove-col-btn" title="이 항목 삭제"><i class="fas fa-times"></i></button></div>`;
        table.querySelector('thead .header-row').appendChild(headerCell);
        const countCell = document.createElement('th');
        countCell.innerHTML = `<span class="person-count-span">${count}</span>`;
        table.querySelector('thead .count-row').appendChild(countCell);
        table.querySelectorAll('tbody tr').forEach(tr => {
            const rowId = tr.dataset.rowId;
            const rowDef = ROW_DEFINITIONS.find(r => r.id === rowId) || {type: 'costInput'};
            tr.insertCell(-1).innerHTML = getCellContent(rowId, colIndex, rowDef.type);
        });
        setupColumnEventListeners(colIndex, headerCell, countCell);
        calculateAll();
    }
    
    function addDynamicCostRow(label = '신규 항목') {
        const calcGroupElement = document.getElementById('singleCalcGroup');
        const table = calcGroupElement.querySelector('.quote-table');
        if (!table) return;
        const tbody = table.querySelector('tbody');
        const numCols = table.querySelector('thead .header-row').cells.length;
        const rowId = `dynamic_${Date.now()}`;
        const buttonRow = tbody.querySelector('tr[data-row-id="addDynamicRow"]');
        if (!buttonRow) return;
        const insertionIndex = Array.from(tbody.rows).indexOf(buttonRow);
        const newRow = tbody.insertRow(insertionIndex);
        newRow.dataset.rowId = rowId;
        newRow.insertCell(0).innerHTML = `<span class="dynamic-row-label-span">${label}</span>`;
        for (let i = 1; i < numCols; i++) {
            newRow.insertCell(i).innerHTML = getCellContent(rowId, i, 'costInput');
        }
        newRow.querySelectorAll('.cost-item').forEach(input => {
            input.addEventListener('input', () => calculateAll());
        });
        makeEditable(newRow.querySelector('.dynamic-row-label-span'), 'text', () => {});
        calculateAll();
    }

    function setupColumnEventListeners(colIndex, headerCell, countCell) {
        if (!headerCell || !countCell) return;
        const calcGroupElement = document.getElementById('singleCalcGroup');
        makeEditable(headerCell.querySelector('.person-type-name-span'), 'text', () => calculateAll());
        makeEditable(countCell.querySelector('.person-count-span'), 'number', () => calculateAll());
        headerCell.querySelector('.remove-col-btn').addEventListener('click', () => {
            if (!confirm(`'${headerCell.textContent.trim()}' 항목을 삭제하시겠습니까?`)) return;
            calcGroupElement.querySelectorAll('.quote-table tr').forEach(row => {
                if (row.cells.length > colIndex) row.deleteCell(colIndex);
            });
            calculateAll();
        });
        calcGroupElement.querySelectorAll('tbody tr').forEach(tr => {
            const cell = tr.cells[colIndex];
            if (cell) {
                const input = cell.querySelector('input');
                if (input) input.addEventListener('input', () => calculateAll());
            }
        });
    }
    
    function initializeSplitView(groupElement) {
        const pnrPane = groupElement.querySelector('.pnr-pane');
        const resizer = groupElement.querySelector('.resizer-handle');
        const splitContainer = groupElement.querySelector('.split-container');
        if (!pnrPane || !resizer || !splitContainer) return;
        resizer.addEventListener('mousedown', (e) => {
            e.preventDefault();
            document.body.style.cursor = 'col-resize';
            const doDrag = (e) => {
                const rect = splitContainer.getBoundingClientRect();
                let newWidth = e.clientX - rect.left;
                if (newWidth < 150) newWidth = 150;
                if (newWidth > rect.width - 350) newWidth = rect.width - 350;
                pnrPane.style.width = newWidth + 'px';
            };
            const stopDrag = () => {
                document.removeEventListener('mousemove', doDrag);
                document.removeEventListener('mouseup', stopDrag);
                document.body.style.cursor = 'default';
            };
            document.addEventListener('mousemove', doDrag);
            document.addEventListener('mouseup', stopDrag);
        });
    }

    // --- 초기화 함수들 ---
    function initializeCalculator() {
        quoteGroupContentsContainer.innerHTML = `
            <div class="calculation-group-content active" id="singleCalcGroup">
                <div class="split-container">
                    <div class="pnr-pane">
                        <label class="label-text font-semibold mb-2">PNR 정보</label>
                        <textarea class="w-full flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm resize-none" placeholder="PNR 정보를 여기에 붙여넣으세요."></textarea>
                    </div>
                    <div class="resizer-handle"></div>
                    <div class="quote-pane">
                        <div class="table-container">
                            <table class="quote-table">
                                <thead>
                                    <tr class="header-row">
                                        <th><button type="button" class="btn btn-sm btn-primary add-person-type-btn"><i class="fas fa-plus"></i> 항목 추가</button></th>
                                    </tr>
                                    <tr class="count-row"><th></th></tr>
                                </thead>
                                <tbody></tbody>
                            </table>
                        </div>
                        <div class="totals-summary-section">
                            <div><label class="label-text">전체상품가</label><div class="calculated-field totalSalesPrice">0 원</div></div>
                            <div><label class="label-text">전체수익</label><div class="calculated-field totalProfit">0 원</div></div>
                            <div><label class="label-text">전체수익률</label><div class="calculated-field totalProfitMargin">0.00 %</div></div>
                        </div>
                    </div>
                </div>
            </div>`;

        const calcGroupElement = document.getElementById('singleCalcGroup');
        initializeSplitView(calcGroupElement);

        const tbody = calcGroupElement.querySelector('tbody');
        ROW_DEFINITIONS.forEach(def => {
            const row = tbody.insertRow();
            row.dataset.rowId = def.id;
            const labelCell = row.insertCell(0);
            if (def.type === 'button') {
                labelCell.innerHTML = `<button type="button" class="btn btn-sm btn-outline add-dynamic-row-btn">${def.label}</button>`;
                labelCell.querySelector('.add-dynamic-row-btn').addEventListener('click', () => addDynamicCostRow());
            } else {
                labelCell.textContent = def.label;
            }
        });

        addPersonTypeColumn('성인', 1);
        calcGroupElement.querySelector('.add-person-type-btn').addEventListener('click', () => addPersonTypeColumn('아동', 0));
    }


    function initFlightSchedule() {
        const addBtn = document.getElementById('addFlightSubgroupBtn');
        const parseBtn = document.getElementById('parseGdsBtn');
        if (addBtn) { addBtn.addEventListener('click', () => { const newSubgroup = { id: `flight_sub_${Date.now()}`, title: "", rows: [{ flightNum: "", depDate: "", originCity: "", depTime: "", arrDate: "", destCity: "", arrTime: "" }] }; flightScheduleData.push(newSubgroup); createFlightSubgroup(newSubgroup); }); }
        if (parseBtn) { parseBtn.addEventListener('click', () => { const popupWidth = 800; const popupHeight = 500; const left = (window.screen.width / 2) - (popupWidth / 2); const top = (window.screen.height / 2) - (popupHeight / 2); window.open('./gds_parser/gds_parser.html', 'GDS_Parser', `width=${popupWidth},height=${popupHeight},top=${top},left=${left}`); }); }
    }
    
    function initPriceSection() {
        const addBtn = document.getElementById('addPriceSubgroupBtn');
        addBtn.addEventListener('click', () => {
            const newSubgroup = { id: `price_sub_${Date.now()}`, title: "", rows: [{ item: "성인요금", price: 0, count: 1, remarks: "" }, { item: "소아요금", price: 0, count: 0, remarks: "2~12세미만(좌석점유)" }, { item: "유아요금", price: 0, count: 0, remarks: "24개월미만(좌석미점유)" }] };
            priceInfoData.push(newSubgroup);
            createPriceSubgroup(newSubgroup);
        });
    }

    function createPriceSubgroup(subgroupData) { const container=document.getElementById('priceInfoContainer');const subGroupDiv=document.createElement('div');subGroupDiv.className='dynamic-section price-subgroup';subGroupDiv.id=subgroupData.id;subGroupDiv.innerHTML=`<button type="button" class="delete-dynamic-section-btn" title="이 요금 그룹 삭제"><i class="fas fa-trash-alt"></i></button><input type="text" class="input-field mb-2" placeholder="견적설명 (예: 인천출발, A객실)" value="${subgroupData.title}"><table class="price-table"><thead><tr><th style="width: 25%;">내역</th><th>1인당 금액</th><th>인원</th><th>총 금액</th><th style="width: 30%;">비고</th><th style="width: 50px;">삭제</th></tr></thead><tbody></tbody><tfoot><tr><td colspan="3" class="text-right font-bold pr-2">총 합계</td><td class="grand-total">0</td><td colspan="2"><button type="button" class="add-row-btn"><i class="fas fa-plus mr-1"></i>행 추가</button></td></tr></tfoot></table>`;container.appendChild(subGroupDiv);const tbody=subGroupDiv.querySelector('tbody');subgroupData.rows.forEach((rowData,index)=>{addPriceRow(tbody,rowData,subgroupData.id,index);});updateGrandTotal(subGroupDiv);subGroupDiv.querySelector('.delete-dynamic-section-btn').addEventListener('click',()=>{if(confirm('이 요금 그룹을 삭제하시겠습니까?')){priceInfoData=priceInfoData.filter(g=>g.id!==subgroupData.id);subGroupDiv.remove();}});subGroupDiv.querySelector('input.input-field').addEventListener('input',e=>{subgroupData.title=e.target.value;});subGroupDiv.querySelector('.add-row-btn').addEventListener('click',()=>{const newRow={item:"",price:0,count:1,remarks:""};subgroupData.rows.push(newRow);addPriceRow(tbody,newRow,subgroupData.id,subgroupData.rows.length-1);});}
    function addPriceRow(tbody, rowData, subgroupId, rowIndex) { const tr=document.createElement('tr');const fields=[{key:'item',align:'text-left'},{key:'price',align:'text-right'},{key:'count',align:'text-center'},{key:'total',align:'text-right',readonly:true},{key:'remarks',align:'text-left'}];let cellsHTML='';fields.forEach(field=>{cellsHTML+=`<td><input type="text" class="${field.align}" data-field="${field.key}" value="${rowData[field.key]||''}" ${field.readonly?'readonly':''}></td>`;});cellsHTML+=`<td><button type="button" class="delete-row-btn"><i class="fas fa-trash"></i></button></td>`;tr.innerHTML=cellsHTML;tbody.appendChild(tr);tr.querySelectorAll('input:not([readonly])').forEach(input=>{input.addEventListener('input',e=>{const field=e.target.dataset.field;const subgroup=priceInfoData.find(g=>g.id===subgroupId);if(!subgroup)return;subgroup.rows[rowIndex][field]=e.target.value;if(field==='price'||field==='count'){const price=parseFloat(subgroup.rows[rowIndex].price)||0;const count=parseInt(subgroup.rows[rowIndex].count)||0;subgroup.rows[rowIndex].total=price*count;tr.querySelector('input[data-field="total"]').value=subgroup.rows[rowIndex].total.toLocaleString();updateGrandTotal(tbody.closest('.dynamic-section'));}});});tr.querySelector('.delete-row-btn').addEventListener('click',()=>{const subgroup=priceInfoData.find(g=>g.id===subgroupId);if(subgroup.rows.length>1){subgroup.rows.splice(rowIndex,1);tr.remove();tbody.querySelectorAll('tr').forEach((row,i)=>row.dataset.rowIndex=i);updateGrandTotal(tbody.closest('.dynamic-section'));}else{alert('최소 한 개의 요금 항목은 유지해야 합니다.');}});}
    function updateGrandTotal(subGroupDiv) { const subgroupId=subGroupDiv.id;const subgroup=priceInfoData.find(g=>g.id===subgroupId);if(!subgroup)return;const grandTotal=subgroup.rows.reduce((sum,row)=>sum+(row.total||0),0);subGroupDiv.querySelector('.grand-total').textContent=grandTotal.toLocaleString();}
    
    // --- 복사 버튼 이벤트 리스너 등록 ---
    const copyFlightScheduleBtn = document.getElementById('copyFlightScheduleBtn');
    const copyPriceInfoBtn = document.getElementById('copyPriceInfoBtn');
    const copyInclusionExclusionBtn = document.getElementById('copyInclusionExclusionBtn');
    if(copyFlightScheduleBtn) { copyFlightScheduleBtn.addEventListener('click', () => { copyHtmlToClipboard(generateFlightScheduleInlineHtml()); }); }
    if(copyPriceInfoBtn) { copyPriceInfoBtn.addEventListener('click', () => { copyHtmlToClipboard(generatePriceInfoInlineHtml()); }); }
    if(copyInclusionExclusionBtn) { copyInclusionExclusionBtn.addEventListener('click', () => { copyHtmlToClipboard(generateInclusionExclusionInlineHtml()); }); }

    // ======== 모든 기능 초기화 실행 ========
    initializeCalculator();
    initFlightSchedule();
    initPriceSection();

    form.addEventListener('reset', (e) => {
        e.preventDefault();
        if (!confirm("작성중인 모든 내용을 삭제하고 새로 시작하시겠습니까?")) return;
        initializeCalculator();
        document.getElementById('flightScheduleContainer').innerHTML = ''; 
        document.getElementById('priceInfoContainer').innerHTML = '';
        document.getElementById('inclusionText').value = ''; 
        document.getElementById('exclusionText').value = '';
        flightScheduleData = []; priceInfoData = [];
    });
});
