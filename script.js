// =======================================================================
// 1. 전역 변수 및 설정
// =======================================================================
let quoteGroupsData = {}; // 모든 견적 그룹의 데이터를 저장하는 핵심 객체
let groupCounter = 0;
let activeGroupId = null;
let currentFileHandle = null;
let isDirty = false; // [추가] 데이터 변경 여부 추적 플래그

// ... (기존 코드 생략) ...

// [수정] 데이터 변경을 감지하고 isDirty 플래그를 설정하는 함수
function setDataDirty() {
    if (!isDirty) {
        isDirty = true;
        document.title = "*" + document.title.replace(/^\*/, ''); // 제목에 '*' 추가하여 변경 표시
    }
}

// =======================================================================
// 6. 핵심 기능 함수 (메인 앱 함수들)
// =======================================================================

// ... (기존 createCustomerCard, getCustomerData 등 함수 생략) ...

async function saveFile(isSaveAs = false, clickedButton = null) {
    // ... (기존 저장 로직 시작) ...
    try {
        // ... (blob 생성 로직) ...
        // [수정] 저장 성공 후 isDirty 플래그 초기화
        if (isSaveAs || !currentFileHandle) {
            // ... (다른 이름으로 저장 로직) ...
            currentFileHandle = newHandle;
            document.title = newHandle.name; // '*' 제거된 새 이름으로 설정
            isDirty = false; // 저장 후 플래그 false로 변경
            showToastMessage('파일이 성공적으로 저장되었습니다.');
            await saveFileHandle(newHandle.name, newHandle);
        } else {
            // ... (덮어쓰기 저장 로직) ...
            document.title = currentFileHandle.name; // '*' 제거
            isDirty = false; // 저장 후 플래그 false로 변경
            showToastMessage('변경사항이 성공적으로 저장되었습니다.');
            await saveFileHandle(currentFileHandle.name, currentFileHandle);
        }
    } catch (err) {
        // ... (에러 처리) ...
    } finally {
        // ... (버튼 상태 복원) ...
    }
}


async function loadFile() {
    // [수정] 파일을 불러오기 전에 변경 사항 확인
    if (isDirty && !confirm("저장하지 않은 변경사항이 있습니다. 변경사항을 무시하고 새 파일을 불러오시겠습니까?")) {
        showToastMessage("파일 불러오기가 취소되었습니다.");
        return;
    }

    try {
        const [fileHandle] = await window.showOpenFilePicker({ types: [{ description: 'HTML 파일', accept: { 'text/html': ['.html'] } }] });
        const openInNew = confirm("파일을 새 창에서 여시겠습니까?\n'확인' = 새 창, '취소' = 현재 창");
        await loadDataIntoWindow(fileHandle, openInNew);
    } catch (err) {
        if (err.name !== 'AbortError') { console.error('파일 열기 실패:', err); showToastMessage('파일을 열지 못했습니다.', true); }
    }
}

// ... (loadDataIntoWindow 함수는 거의 동일하나, 상태 복원 후 isDirty 플래그를 false로 설정) ...

function restoreState(data) {
    // ... (기존 상태 복원 로직) ...
    if (Object.keys(quoteGroupsData).length > 0) {
        Object.keys(quoteGroupsData).forEach(id => createGroupUI(id));
        const groupIdToSelect = (data.activeGroupId && quoteGroupsData[data.activeGroupId]) ? data.activeGroupId : Object.keys(quoteGroupsData)[0];
        switchTab(groupIdToSelect);
    }
    else {
        addNewGroup();
    }
    // [추가] 파일 로드 후에는 '깨끗한' 상태로 간주
    isDirty = false;
    document.title = document.title.replace(/^\*/, ''); // 제목의 '*' 제거
}

// ... (기타 함수들) ...

// =======================================================================
// 9. 이벤트 리스너 중앙 관리 (Event Delegation)
// =======================================================================
function setupEventListeners() {
    // ... (기존 이벤트 리스너) ...

    // [수정] 데이터 변경을 감지하는 모든 곳에 setDataDirty() 호출 추가
    // 예시: 고객 정보 입력 시
    customerInfoContainer.addEventListener('input', (event) => {
        if (event.target.matches('input')) {
            setDataDirty();
        }
    });

    // 예시: 견적 계산기 내용 변경 시
    contentsContainer.addEventListener('input', (event) => {
        if (event.target.matches('.cost-item, .sales-price, .pnr-pane textarea, .flight-schedule-input, .price-table input, .inclusion-text, .exclusion-text')) {
             setDataDirty();
        }
    });
    
    // 예시: 항목 추가/삭제 버튼 클릭 시
     contentsContainer.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button) return;
        
        // 항목을 변경하는 거의 모든 버튼 클릭 시 isDirty 플래그 설정
        if(button.classList.contains('add-calculator-btn') ||
           button.classList.contains('copy-last-calculator-btn') ||
           button.classList.contains('delete-calculator-btn') ||
           button.classList.contains('add-person-type-btn') ||
           button.classList.contains('add-dynamic-row-btn') ||
           button.classList.contains('remove-col-btn') ||
           button.classList.contains('dynamic-row-delete-btn') ||
           button.classList.contains('add-flight-subgroup-btn') ||
           button.classList.contains('add-price-subgroup-btn') ||
           button.classList.contains('delete-dynamic-section-btn') ||
           button.classList.contains('add-row-btn') ||
           button.classList.contains('delete-row-btn') ||
           button.id.startsWith('hm-addHotelTabBtn-') ||
           button.matches('.tab-delete-icon') ||
           button.id.startsWith('ip-addDayButton') ||
           button.classList.contains('delete-day-button') ||
           button.classList.contains('add-activity-button')
           ) {
            setDataDirty();
        }
        
        // ... (기존 click 이벤트 핸들러 로직) ...
    });
    
    // ... (기타 모든 데이터 변경 지점에 setDataDirty() 추가) ...
}
