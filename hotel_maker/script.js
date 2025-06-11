// 전역 상태 변수
let allHotelData = [];
let currentHotelIndex = -1;
let currentHotelDocumentId = null; // 현재 작업 중인 Firestore 문서 ID
let currentHotelDocumentName = "새 호텔 정보 모음"; // 현재 작업 중인 문서의 표시 이름
let allFetchedHotelSets = []; // Firestore에서 가져온 호텔 정보 세트 목록

// DOM 요소 참조 변수 (기존 + 모달용)
let hotelTabsContainer, addHotelTabBtn, hotelEditorForm;
let hotelNameKoInput, hotelNameEnInput, hotelWebsiteInput, hotelImageInput, hotelDescriptionInput;
// 수정: 사용하는 버튼만 남김
let previewHotelBtn, loadHotelHtmlBtn, copyHtmlBtn;
let currentDocumentNameDisplay; // H2 제목 옆에 현재 문서 이름 표시용

// 모달 관련 DOM 요소
let loadHotelSetModal, hotelSetSearchInput, hotelSetListForLoad, loadingHotelSetListMsg, cancelLoadHotelSetModalButton, closeLoadHotelSetModalButton;


// Firebase 설정 (hotelinformation-app 용)
const firebaseConfig = {
  apiKey: "AIzaSyDsV5PGKMFdCDKgFfl077-DuaYv6N5kVNs",
  authDomain: "hotelinformation-app.firebaseapp.com",
  projectId: "hotelinformation-app",
  storageBucket: "hotelinformation-app.firebasestorage.app",
  messagingSenderId: "1027315001739",
  appId: "1:1027315001739:web:d7995a67062441fa93a78e",
  measurementId: "G-X889T0FZCY"
};

// Firebase 앱 초기화
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
} else {
    console.error("Firebase SDK가 로드되지 않았습니다. index.html 파일의 스크립트 로드 순서를 확인해주세요.");
    alert("Firebase SDK 로드 실패. 일부 기능이 작동하지 않을 수 있습니다.");
}

const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
if (!db && typeof firebase !== 'undefined') {
    console.error("Firestore 인스턴스를 초기화할 수 없습니다. Firebase SDK (특히 firestore.js) 로드 상태를 확인해주세요.");
    alert("Firestore 초기화 실패. 데이터 저장/불러오기 기능이 작동하지 않을 수 있습니다.");
}
const serverTimestamp = typeof firebase !== 'undefined' ? firebase.firestore.FieldValue.serverTimestamp() : null;


// Toast 메시지 함수 (간단 버전)
function showToastMessage(message, isError = false) {
    console.log(`Toast: ${message} (Error: ${isError})`);
    alert(message); // 실제 프로덕션에서는 더 나은 UI의 Toast 사용 권장
}

/**
 * 호텔 카드 1개에 대한 HTML 코드를 생성하는 헬퍼 함수
 * @param {object} hotel - 호텔 정보 객체
 * @param {object} options - 추가 옵션 (예: { forImage: true })
 * @returns {string} - 호텔 카드의 HTML 문자열
 */
function generateHotelCardHtml(hotel, options = {}) {
    const isImageOnly = hotel.image && !hotel.nameKo && !hotel.nameEn && !hotel.description && !hotel.website;

    if (isImageOnly) {
        const placeholderImage = 'https://placehold.co/640x480/e2e8f0/cbd5e0?text=Invalid+Image+URL';
        const currentHotelImage = (typeof hotel.image === 'string' && hotel.image.startsWith('http')) ? hotel.image : placeholderImage;
        return `
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 750px; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;">
            <tbody>
              <tr>
                <td style="text-align: center; padding: 24px;">
                  <img src="${currentHotelImage}" alt="제공된 이미지" style="width: 640px; max-width: 100%; height: auto; display: block; margin: 0 auto;" onerror="this.onerror=null; this.src='${placeholderImage}';">
                </td>
              </tr>
            </tbody>
          </table>
        `;
    }

    const { forImage = false } = options;
    const placeholderImage = 'https://placehold.co/400x300/e2e8f0/cbd5e0?text=No+Image';
    const currentHotelImage = (typeof hotel.image === 'string' && hotel.image.startsWith('http')) ? hotel.image : placeholderImage;

    const descriptionItems = hotel.description ? hotel.description.split('\n').filter(line => line.trim() !== '') : [];
    const descriptionHtml = descriptionItems.map(item => {
        return `
            <div style="margin-bottom: 6px; line-height: 1.6;">
                <span style="font-size: 12px; color: #34495e; vertical-align: middle;">${item.replace(/● /g, '')}</span>
            </div>
        `;
    }).join('');

    let websiteButtonHtml = '';
    if (hotel.website && !forImage) {
        websiteButtonHtml = `
            <div style="margin-top: 20px;">
                <a href="${hotel.website}" target="_blank" style="background-color: #3498db; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 12px;">
                    웹사이트 바로가기
                </a>
            </div>
        `;
    }

    return `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 750px; font-family: 'Malgun Gothic', '맑은 고딕', sans-serif; border-collapse: separate; border-spacing: 24px;">
        <tbody>
          <tr>
            <td width="320" style="width: 320px; vertical-align: top;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); overflow: hidden;">
                <tbody>
                  <tr>
                    <td>
                      <img src="${currentHotelImage}" alt="${hotel.nameKo || '호텔 이미지'}" width="320" style="width: 100%; height: auto; display: block; border: 0;" onerror="this.onerror=null; this.src='${placeholderImage}';">
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 16px 20px;">
                      <div style="font-size: 14px; font-weight: bold; color: #2c3e50; margin: 0;">${hotel.nameKo || '호텔명 없음'}</div>
                      ${hotel.nameEn ? `<div style="font-size: 12px; color: #7f8c8d; margin-top: 4px;">${hotel.nameEn}</div>` : ''}
                    </td>
                  </tr>
                </tbody>
              </table>
            </td>
            <td style="vertical-align: middle;">
              <div>
                ${descriptionHtml}
                ${websiteButtonHtml}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    `;
}

function generateFullPreviewHtml(data) {
    const hotelName = data.length > 0 ? data[0].nameKo : '호텔';
    const sliderHead = `
        <link rel="stylesheet" href="https://unpkg.com/swiper/swiper-bundle.min.css" />
        <script src="https://unpkg.com/swiper/swiper-bundle.min.js"></script>
    `;
    const sliderBodyScript = `
        <script>
            if (typeof Swiper !== 'undefined') {
                const swiper = new Swiper('.swiper', {
                    loop: true,
                    pagination: { el: '.swiper-pagination', clickable: true },
                    navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
                });
            } else {
                console.warn('Swiper library not loaded for preview. Make sure Swiper JS is included in index.html.');
            }
        </script>
    `;
    let bodyContent;
    if (data.length > 1) {
        const slides = data.map(hotel => `<div class="swiper-slide">${generateHotelCardHtml(hotel)}</div>`).join('');
        bodyContent = `
            <div class="swiper" style="max-width: 800px; margin: auto;">
                <div class="swiper-wrapper">${slides}</div>
                <div class="swiper-pagination"></div>
                <div class="swiper-button-prev"></div>
                <div class="swiper-button-next"></div>
            </div>
            ${sliderBodyScript}
        `;
    } else if (data.length === 1) {
        bodyContent = generateHotelCardHtml(data[0]);
    } else {
        bodyContent = '<h1 style="text-align: center;">표시할 호텔 정보가 없습니다.</h1>';
    }
    return `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>호텔 안내: ${hotelName}</title>
            ${data.length > 1 ? sliderHead : ''}
            <style>
                body {
                    font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
                    background-color: #f0f2f5;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    padding: 2rem;
                    box-sizing: border-box;
                    margin: 0;
                }
                .swiper-slide {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
            </style>
        </head>
        <body>
            ${bodyContent}
        </body>
        </html>
    `;
}

function copyOptimizedHtml() {
    if (currentHotelIndex === -1 || currentHotelIndex >= allHotelData.length) {
        alert('먼저 복사할 호텔 탭을 선택해주세요.');
        return;
    }
    const hotel = allHotelData[currentHotelIndex];
    const htmlToCopy = generateHotelCardHtml(hotel, { forImage: false });
    navigator.clipboard.writeText(htmlToCopy).then(() => {
        alert('호텔 카드 HTML 코드가 클립보드에 복사되었습니다.');
    }).catch(err => {
        console.error('클립보드 복사 실패:', err);
        alert('오류가 발생하여 복사하지 못했습니다. 브라우저 개발자 콘솔을 확인해주세요.');
    });
}

function previewHotelInfo() {
    syncCurrentHotelData();
    if (allHotelData.length === 0) {
        alert('미리보기할 호텔 정보가 없습니다.');
        return;
    }
    const previewHtml = generateFullPreviewHtml(allHotelData);
    const previewWindow = window.open('', '_blank', 'width=900,height=600,scrollbars=yes,resizable=yes');
    if (previewWindow) {
        previewWindow.document.open();
        previewWindow.document.write(previewHtml);
        previewWindow.document.close();
        previewWindow.focus();
    } else {
        alert('팝업 차단 기능이 활성화되어 미리보기를 열 수 없습니다.');
    }
}

function renderTabs() {
    if (!hotelTabsContainer || !addHotelTabBtn) return;
    const existingTabs = hotelTabsContainer.querySelectorAll('.hotel-tab-button:not(#addHotelTabBtn)');
    existingTabs.forEach(tab => tab.remove());

    if (currentDocumentNameDisplay) {
        currentDocumentNameDisplay.textContent = `(${currentHotelDocumentName || "저장되지 않음"})`;
    }

    allHotelData.forEach((hotel, index) => {
        const tabButton = document.createElement('button');
        tabButton.className = 'hotel-tab-button';
        tabButton.dataset.index = index;
        if (index === currentHotelIndex) {
            tabButton.classList.add('active');
        }
        tabButton.innerHTML = `<span class="tab-title">${hotel.nameKo || `새 호텔 ${index + 1}`}</span><i class="fas fa-times tab-delete-icon" title="이 호텔 정보 삭제"></i>`;
        hotelTabsContainer.insertBefore(tabButton, addHotelTabBtn);
        const deleteIcon = tabButton.querySelector('.tab-delete-icon');
        if (deleteIcon) {
            deleteIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteHotel(index);
            });
        }
        tabButton.addEventListener('click', () => switchTab(index));
    });
}

function renderEditorForCurrentHotel() {
    if (!hotelEditorForm || !hotelNameKoInput || !hotelNameEnInput || !hotelWebsiteInput || !hotelImageInput || !hotelDescriptionInput) return;
    if (currentHotelIndex === -1 || currentHotelIndex >= allHotelData.length || !allHotelData[currentHotelIndex] ) {
        hotelEditorForm.classList.add('disabled');
        hotelNameKoInput.value = '';
        hotelNameEnInput.value = '';
        hotelWebsiteInput.value = '';
        hotelImageInput.value = '';
        hotelDescriptionInput.value = '';
        document.querySelectorAll('#hotelEditorForm input, #hotelEditorForm textarea').forEach(el => {
            el.placeholder = ' '; // Ensure labels float correctly if inputs are empty
            if (el.id === 'hotelNameKo') el.placeholder = '호텔명 (한글)'; // Restore original placeholder for key fields if desired
            // Add more specific placeholders if needed, or keep generic ' '
        });
        return;
    }
    hotelEditorForm.classList.remove('disabled');
    const hotel = allHotelData[currentHotelIndex];
    hotelNameKoInput.value = hotel.nameKo || '';
    hotelNameEnInput.value = hotel.nameEn || '';
    hotelWebsiteInput.value = hotel.website || '';
    const imageUrl = (typeof hotel.image === 'string' && (hotel.image.startsWith('http://') || hotel.image.startsWith('https://'))) ? hotel.image : '';
    hotelImageInput.value = imageUrl;
    hotelDescriptionInput.value = hotel.description || '';
    document.querySelectorAll('#hotelEditorForm input, #hotelEditorForm textarea').forEach(el => {
        if (el.value !== '') el.placeholder = ' ';
        else { // Restore original-like behavior for empty fields for floating labels
            if (el.id === 'hotelNameKo' && !el.value) el.placeholder = '호텔명 (한글)';
            else if (el.id === 'hotelNameEn' && !el.value) el.placeholder = '호텔명 (영문)';
            else if (el.id === 'hotelWebsite' && !el.value) el.placeholder = '호텔 웹사이트';
            else if (el.id === 'hotelImage' && !el.value) el.placeholder = '대표 이미지 URL';
            else if (el.id === 'hotelDescription' && !el.value) el.placeholder = '간단 설명 (줄바꿈으로 항목 구분)';
            else if (!el.value) el.placeholder = ' ';
        }
    });
}

function switchTab(index) {
    if (allHotelData.length === 0) {
        currentHotelIndex = -1;
    } else if (index < 0 || index >= allHotelData.length) {
        currentHotelIndex = 0; // Default to first tab if index is invalid but data exists
    } else {
        currentHotelIndex = index;
    }
    renderTabs();
    renderEditorForCurrentHotel();
}

function addHotel() {
    syncCurrentHotelData();
    const newHotel = { nameKo: `새 호텔 ${allHotelData.length + 1}`, nameEn: "", website: "", image: "", description: "" };
    allHotelData.push(newHotel);
    switchTab(allHotelData.length - 1);
}

function deleteHotel(indexToDelete) {
    if (indexToDelete < 0 || indexToDelete >= allHotelData.length) return;
    const hotelName = allHotelData[indexToDelete].nameKo || '이 호텔';
    if (!confirm(`'${hotelName}' 정보를 현재 목록에서 삭제하시겠습니까? (저장된 내용은 Firebase에서 별도 삭제 필요)`)) return;

    allHotelData.splice(indexToDelete, 1);

    let newActiveIndex = -1;
    if (allHotelData.length > 0) {
        if (currentHotelIndex === indexToDelete) {
            newActiveIndex = Math.max(0, indexToDelete - 1);
        } else if (currentHotelIndex > indexToDelete) {
            newActiveIndex = currentHotelIndex - 1;
        } else {
            newActiveIndex = currentHotelIndex;
        }
        newActiveIndex = Math.min(newActiveIndex, allHotelData.length - 1);
    }

    switchTab(newActiveIndex);
}

function syncCurrentHotelData() {
    if (currentHotelIndex === -1 || currentHotelIndex >= allHotelData.length || !allHotelData[currentHotelIndex]) {
        return;
    }
    if (!hotelNameKoInput || !hotelNameEnInput || !hotelWebsiteInput || !hotelImageInput || !hotelDescriptionInput) {
        return;
    }

    const hotel = allHotelData[currentHotelIndex];
    hotel.nameKo = hotelNameKoInput.value.trim();
    hotel.nameEn = hotelNameEnInput.value.trim();
    hotel.website = hotelWebsiteInput.value.trim();
    hotel.image = hotelImageInput.value.trim();
    hotel.description = hotelDescriptionInput.value.trim();
}

function splitTsvRows(text) {
    const rows = [];
    let currentRowStart = 0;
    let inQuotes = false;
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    for (let i = 0; i < normalizedText.length; i++) {
        const char = normalizedText[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        }
        if (char === '\n' && !inQuotes) {
            rows.push(normalizedText.substring(currentRowStart, i).trim());
            currentRowStart = i + 1;
        }
    }
    rows.push(normalizedText.substring(currentRowStart).trim());
    return rows.filter(row => row.length > 0);
}

function importHotelsFromTSV(tsvData) {
    const lines = splitTsvRows(tsvData);
    if (lines.length === 0) {
        return { importedCount: 0, errors: [], affectedIndex: currentHotelIndex };
    }
    let importedCount = 0;
    const errors = [];
    let affectedIndex = currentHotelIndex;
    function cleanFieldValue(value) {
        if (typeof value !== 'string') return "";
        let cleanedValue = value.trim();
        if (cleanedValue.startsWith('"') && cleanedValue.endsWith('"')) {
            cleanedValue = cleanedValue.substring(1, cleanedValue.length - 1);
        }
        return cleanedValue;
    }

    syncCurrentHotelData();

    if (currentHotelIndex !== -1 && allHotelData[currentHotelIndex] && lines.length > 0) {
        const firstLineColumnsRaw = lines[0].split('\t');
        const firstLineColumns = firstLineColumnsRaw.map(cleanFieldValue);
        const hotelToUpdate = allHotelData[currentHotelIndex];
        hotelToUpdate.nameKo = firstLineColumns[0] || "";
        hotelToUpdate.nameEn = firstLineColumns[1] || "";
        hotelToUpdate.website = firstLineColumns[2] || "";
        hotelToUpdate.image = firstLineColumns[3] || "";
        hotelToUpdate.description = firstLineColumns[4] || "";
        importedCount++;
        affectedIndex = currentHotelIndex;
        if (lines.length > 1) {
            const remainingLines = lines.slice(1);
            const newHotelsToInsert = [];
            remainingLines.forEach((line) => {
                const columnsRaw = line.split('\t');
                const columns = columnsRaw.map(cleanFieldValue);
                newHotelsToInsert.push({
                    nameKo: columns[0] || "",
                    nameEn: columns[1] || "",
                    website: columns[2] || "",
                    image: columns[3] || "",
                    description: columns[4] || ""
                });
            });
            allHotelData.splice(currentHotelIndex + 1, 0, ...newHotelsToInsert);
            importedCount += newHotelsToInsert.length;
        }
    } else {
        const newHotelsFromTsv = [];
        lines.forEach((line) => {
            const columnsRaw = line.split('\t');
            const columns = columnsRaw.map(cleanFieldValue);
            newHotelsFromTsv.push({
                nameKo: columns[0] || "",
                nameEn: columns[1] || "",
                website: columns[2] || "",
                image: columns[3] || "",
                description: columns[4] || ""
            });
            importedCount++;
        });
        allHotelData.push(...newHotelsFromTsv);
        affectedIndex = (allHotelData.length > 0) ? Math.max(0, allHotelData.length - newHotelsFromTsv.length) : -1;
        if (allHotelData.length === 0) affectedIndex = -1;
    }
    return { importedCount, errors, affectedIndex };
}


// --- Firestore 연동 함수 ---

async function saveHotelSetToFirestore(isSaveAsNew = false) {
    if (!db || !serverTimestamp) { showToastMessage("Firestore가 초기화되지 않았거나 서버 시간 기능을 사용할 수 없습니다.", true); return; }
    syncCurrentHotelData();

    if (allHotelData.length === 0) {
        showToastMessage("저장할 호텔 정보가 없습니다.", true);
        return;
    }

    let docName = currentHotelDocumentName;
    let promptDefaultName = currentHotelDocumentName === "새 호텔 정보 모음" ? "내 호텔 정보" : currentHotelDocumentName;

    if (isSaveAsNew || !currentHotelDocumentId) {
        if (currentHotelIndex !== -1 && currentHotelIndex < allHotelData.length && allHotelData[currentHotelIndex] && allHotelData[currentHotelIndex].nameKo) {
            promptDefaultName = allHotelData[currentHotelIndex].nameKo;
        } else if (allHotelData.length > 0 && allHotelData[0] && allHotelData[0].nameKo) {
            promptDefaultName = allHotelData[0].nameKo;
        }

        const newName = prompt("이 호텔 정보 모음을 어떤 이름으로 저장하시겠습니까?", promptDefaultName);
        if (!newName || newName.trim() === "") {
            showToastMessage("이름이 입력되지 않아 저장이 취소되었습니다.", true);
            return;
        }
        docName = newName.trim();
    }


    const dataToSave = {
        name: docName,
        hotels: JSON.parse(JSON.stringify(allHotelData)),
        timestamp: serverTimestamp
    };

    try {
        if (currentHotelDocumentId && !isSaveAsNew) {
            await db.collection("hotels").doc(currentHotelDocumentId).set(dataToSave, { merge: true });
            currentHotelDocumentName = docName;
            renderTabs();
            showToastMessage(`'${docName}' 정보가 Firestore에 업데이트되었습니다.`);
        } else {
            const docRef = await db.collection("hotels").add(dataToSave);
            currentHotelDocumentId = docRef.id;
            currentHotelDocumentName = docName;
            renderTabs();
            showToastMessage(`'${docName}' 정보가 새롭게 Firestore에 저장되었습니다.`);
        }
    } catch (error) {
        console.error("Error saving hotel set to Firestore: ", error);
        showToastMessage("정보 저장 중 오류 발생: " + error.message, true);
    }
}

async function handleSaveHotelSetAsNew() {
    await saveHotelSetToFirestore(true);
}

// 수정 1: 불러오기 시 데이터 누적
async function loadHotelSetFromFirestore(docId) {
    if (!db) { showToastMessage("Firestore가 초기화되지 않았습니다.", true); return; }
    if (!docId) { showToastMessage("불러올 문서 ID가 없습니다.", true); return; }

    try {
        const doc = await db.collection("hotels").doc(docId).get();
        if (doc.exists) {
            const loadedData = doc.data();
            const newHotels = loadedData.hotels || [];

            // 불러온 문서의 ID와 이름으로 현재 작업 상태를 업데이트 (선택적)
            // 사용자가 여러 문서를 계속 누적 로드할 경우, 마지막으로 로드한 문서의 정보가 currentXXX 변수에 남게 됨.
            currentHotelDocumentId = doc.id;
            currentHotelDocumentName = loadedData.name || "이름 없는 정보";

            if (newHotels.length > 0) {
                const firstNewHotelIndex = allHotelData.length; // 기존 데이터의 끝, 즉 새 데이터의 시작 인덱스
                allHotelData.push(...newHotels); // 기존 데이터 뒤에 새 호텔 데이터 추가
                renderTabs(); // 탭 목록 업데이트
                switchTab(firstNewHotelIndex); // 새로 추가된 첫 번째 탭으로 이동
                showToastMessage(`'${currentHotelDocumentName}'의 호텔 ${newHotels.length}개를 현재 목록 끝에 추가했습니다.`);
            } else {
                // 불러온 문서에 호텔 데이터가 없는 경우
                if (allHotelData.length === 0) { // 현재 앱에도 데이터가 없었다면
                    addHotel(); // 기본 빈 호텔 하나 추가
                    showToastMessage(`'${currentHotelDocumentName}'은(는) 비어있어 새 호텔 탭을 시작합니다.`);
                } else {
                    // 이미 데이터가 있는데 빈 세트를 불러오려고 하면, 그냥 메시지만 표시
                    showToastMessage(`'${currentHotelDocumentName}'에 추가할 호텔 정보가 없습니다.`);
                }
                renderTabs(); // 현재 문서 이름 표시 업데이트를 위해 호출
            }
            if(loadHotelSetModal) loadHotelSetModal.classList.add('hidden'); // 모달 닫기
        } else {
            showToastMessage("해당 ID의 문서를 찾을 수 없습니다.", true);
        }
    } catch (error) {
        console.error("Error loading hotel set from Firestore: ", error);
        showToastMessage("정보 불러오기 중 오류 발생: " + error.message, true);
    }
}


// 수정 3: 모달 클릭 동작 변경을 위한 함수
async function renameHotelSetInFirestore(docId, currentName) {
    if (!db || !serverTimestamp) { showToastMessage("Firestore에 연결할 수 없습니다.", true); return; }
    if (!docId) { showToastMessage("수정할 문서 ID가 없습니다.", true); return; }

    const newName = prompt(`"${currentName}"의 새 이름을 입력하세요:`, currentName);
    if (newName && newName.trim() !== "" && newName.trim() !== currentName) {
        const updatedName = newName.trim();
        try {
            await db.collection("hotels").doc(docId).update({
                name: updatedName,
                timestamp: serverTimestamp // 수정 시간도 업데이트
            });
            showToastMessage(`이름이 "${updatedName}"으로 변경되었습니다.`);
            // 로컬 목록(allFetchedHotelSets)도 업데이트하고 모달 다시 렌더링
            const setToUpdate = allFetchedHotelSets.find(set => set.id === docId);
            if (setToUpdate) {
                setToUpdate.name = updatedName;
            }
            renderFilteredHotelSetList(); // 모달 목록 새로고침
            if (currentHotelDocumentId === docId) { // 현재 작업중인 문서의 이름이 변경된 경우
                currentHotelDocumentName = updatedName;
                renderTabs(); // UI (문서 제목 등) 업데이트
            }
        } catch (error) {
            console.error("Error renaming hotel set: ", error);
            showToastMessage("이름 변경 중 오류 발생: " + error.message, true);
        }
    } else if (newName && newName.trim() === currentName) {
        // 이름 변경 없음
    } else {
        showToastMessage("이름 변경이 취소되었습니다.");
    }
}


function renderFilteredHotelSetList() {
    if (!hotelSetListForLoad || !hotelSetSearchInput) return;

    const searchTerm = hotelSetSearchInput.value.toLowerCase();
    hotelSetListForLoad.innerHTML = '';

    const filteredSets = allFetchedHotelSets.filter(set =>
        set.name.toLowerCase().includes(searchTerm)
    );

    if (filteredSets.length > 0) {
        filteredSets.forEach(set => {
            const listItem = document.createElement('li');
            listItem.className = 'flex justify-between items-center p-3 hover:bg-gray-50 cursor-pointer';

            const titleSpan = document.createElement('span');
            titleSpan.textContent = set.name;
            titleSpan.className = 'text-sm font-medium text-gray-900 flex-grow';
            titleSpan.title = `"${set.name}" 정보 불러오기 (클릭) / 이름 수정 (더블클릭)`;
            titleSpan.dataset.docId = set.id;
            titleSpan.dataset.docName = set.name;

            // --- 수정된 클릭 및 더블클릭 이벤트 핸들러 ---
            let clickTimer = null;
            const clickDelay = 250;

            titleSpan.addEventListener('click', () => {
                if (clickTimer === null) {
                    clickTimer = setTimeout(() => {
                        clickTimer = null;
                        loadHotelSetFromFirestore(set.id);
                    }, clickDelay);
                } else {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                }
            });

            titleSpan.addEventListener('dblclick', () => {
                if (clickTimer) {
                    clearTimeout(clickTimer);
                    clickTimer = null;
                }
                renameHotelSetInFirestore(set.id, set.name);
            });
            // --- 수정된 클릭 및 더블클릭 이벤트 핸들러 끝 ---


            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = `<svg class="w-5 h-5 text-gray-400 hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
            deleteButton.className = 'p-1 rounded-full hover:bg-red-100 ml-2';
            deleteButton.title = `"${set.name}" 정보 삭제`;
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteHotelSetFromFirestore(set.id, set.name);
            });

            listItem.appendChild(titleSpan);
            listItem.appendChild(deleteButton);
            hotelSetListForLoad.appendChild(listItem);
        });
    } else {
        const isLoading = loadingHotelSetListMsg && loadingHotelSetListMsg.style.display !== 'none';
        if (!isLoading) {
             if (searchTerm && allFetchedHotelSets.length > 0) {
                hotelSetListForLoad.innerHTML = `<li class="p-3 text-sm text-gray-500 text-center">"'${hotelSetSearchInput.value}'" 검색 결과가 없습니다.</li>`;
            } else if (allFetchedHotelSets.length === 0) {
                hotelSetListForLoad.innerHTML = '<li class="p-3 text-sm text-gray-500 text-center">저장된 호텔 정보가 없습니다.</li>';
            }
        }
    }
}

async function openLoadHotelSetModal() {
    if (!db) { showToastMessage("Firestore가 초기화되지 않았습니다.", true); return; }
    if (!loadHotelSetModal || !hotelSetListForLoad || !loadingHotelSetListMsg || !hotelSetSearchInput) {
        console.error("호텔 정보 불러오기 모달 관련 DOM 요소를 찾을 수 없습니다.");
        showToastMessage("UI가 준비되지 않았습니다.", true);
        return;
    }

    loadingHotelSetListMsg.textContent = "목록을 불러오는 중...";
    loadingHotelSetListMsg.style.display = 'block';
    hotelSetListForLoad.innerHTML = '';
    hotelSetSearchInput.value = '';

    loadHotelSetModal.classList.remove('hidden');
    allFetchedHotelSets = [];

    try {
        const querySnapshot = await db.collection("hotels").orderBy("timestamp", "desc").get();
        querySnapshot.forEach((doc) => {
            allFetchedHotelSets.push({ id: doc.id, name: doc.data().name || "이름 없는 정보" });
        });
        loadingHotelSetListMsg.style.display = 'none';
        renderFilteredHotelSetList();
    } catch (error) {
        console.error("Error loading hotel set list from Firestore: ", error);
        showToastMessage("목록 불러오기 중 오류 발생: " + error.message, true);
        if (loadingHotelSetListMsg) loadingHotelSetListMsg.textContent = "목록 불러오기 중 오류가 발생했습니다.";
        allFetchedHotelSets = [];
        if (loadingHotelSetListMsg) loadingHotelSetListMsg.style.display = 'none';
        renderFilteredHotelSetList();
    }
}

async function deleteHotelSetFromFirestore(docId, docName) {
    if (!db) { showToastMessage("Firestore가 초기화되지 않았습니다.", true); return; }
    if (!docId) { showToastMessage("삭제할 문서 ID가 없습니다.", true); return; }

    if (!confirm(`"${docName}" 정보를 정말로 Firestore에서 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }

    try {
        await db.collection("hotels").doc(docId).delete();
        showToastMessage(`"${docName}" 정보가 Firestore에서 삭제되었습니다.`);

        if (currentHotelDocumentId === docId) { // 현재 작업중인 문서가 삭제된 경우
            currentHotelDocumentId = null;
            currentHotelDocumentName = "새 호텔 정보 모음";
            allHotelData = []; // 현재 데이터 초기화
            // addHotel(); // 삭제 후 자동으로 새 호텔을 추가하지 않고, 사용자가 직접 추가하도록 변경
            renderTabs();
            renderEditorForCurrentHotel(); // 편집기 비활성화
        }

        // 모달이 열려있다면 목록 새로고침
        if (loadHotelSetModal && !loadHotelSetModal.classList.contains('hidden')) {
            allFetchedHotelSets = allFetchedHotelSets.filter(set => set.id !== docId);
            renderFilteredHotelSetList();
        }

    } catch (error) {
        console.error("Error deleting hotel set from Firestore: ", error);
        showToastMessage(`"${docName}" 정보 삭제 중 오류 발생: ${error.message, true}`);
    }
}

// [추가] 부모 창과 통신하기 위한 이벤트 리스너
window.addEventListener('message', (event) => {
    // 보안을 위해 실제 프로덕션에서는 event.origin을 확인해야 합니다.
    // 예: if (event.origin !== 'https://expected-parent-origin.com') return;

    const { action, payload, port } = event.data;

    if (action === 'getHotelData') {
        // 1. 현재 편집기의 데이터를 동기화합니다.
        syncCurrentHotelData();
        
        // 2. 부모 창으로 보낼 데이터를 준비합니다.
        const dataToSend = {
            allHotelData,
            currentHotelIndex,
            currentHotelDocumentId,
            currentHotelDocumentName
        };
        
        // 3. MessagePort를 통해 응답을 보냅니다.
        if (port) {
            port.postMessage({ payload: dataToSend });
            port.close();
        }
    } else if (action === 'loadHotelData') {
        // 1. 부모 창으로부터 받은 데이터로 내부 상태를 복원합니다.
        const receivedData = payload;
        if (receivedData) {
            allHotelData = receivedData.allHotelData || [];
            currentHotelIndex = receivedData.currentHotelIndex !== undefined ? receivedData.currentHotelIndex : -1;
            currentHotelDocumentId = receivedData.currentHotelDocumentId || null;
            currentHotelDocumentName = receivedData.currentHotelDocumentName || "새 호텔 정보 모음";
        } else {
            // 전달된 데이터가 없으면 초기화
            allHotelData = [];
            currentHotelIndex = -1;
            currentHotelDocumentId = null;
            currentHotelDocumentName = "새 호텔 정보 모음";
        }
        
        // 2. 복원된 데이터로 UI를 다시 렌더링합니다.
        // 데이터가 없는 경우, 빈 탭을 하나 추가해줍니다.
        if (allHotelData.length === 0) {
            addHotel();
        } else {
            renderTabs();
            renderEditorForCurrentHotel();
        }
    }
});


// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', function () {
    hotelTabsContainer = document.getElementById('hotelTabsContainer');
    addHotelTabBtn = document.getElementById('addHotelTabBtn');
    hotelEditorForm = document.getElementById('hotelEditorForm');
    hotelNameKoInput = document.getElementById('hotelNameKo');
    hotelNameEnInput = document.getElementById('hotelNameEn');
    hotelWebsiteInput = document.getElementById('hotelWebsite');
    hotelImageInput = document.getElementById('hotelImage');
    hotelDescriptionInput = document.getElementById('hotelDescription');
    previewHotelBtn = document.getElementById('previewHotelBtn');
    loadHotelHtmlBtn = document.getElementById('loadHotelHtmlBtn');
    copyHtmlBtn = document.getElementById('copyHtmlBtn');
    currentDocumentNameDisplay = document.getElementById('currentDocumentNameDisplay');


    loadHotelSetModal = document.getElementById('loadHotelSetModal');
    hotelSetSearchInput = document.getElementById('hotelSetSearchInput');
    hotelSetListForLoad = document.getElementById('hotelSetListForLoad');
    loadingHotelSetListMsg = document.getElementById('loadingHotelSetListMsg');
    cancelLoadHotelSetModalButton = document.getElementById('cancelLoadHotelSetModalButton');
    closeLoadHotelSetModalButton = document.getElementById('closeLoadHotelSetModalButton');

    // 수정: 사용하는 버튼에만 이벤트 리스너 연결
    if (addHotelTabBtn) addHotelTabBtn.addEventListener('click', addHotel);
    if (previewHotelBtn) previewHotelBtn.addEventListener('click', previewHotelInfo);
    if (copyHtmlBtn) copyHtmlBtn.addEventListener('click', copyOptimizedHtml);
    if (loadHotelHtmlBtn) loadHotelHtmlBtn.addEventListener('click', openLoadHotelSetModal);


    [hotelNameKoInput, hotelNameEnInput, hotelWebsiteInput, hotelImageInput, hotelDescriptionInput].forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                syncCurrentHotelData();
                if (input.id === 'hotelNameKo' && currentHotelIndex !== -1 && currentHotelIndex < allHotelData.length) {
                    renderTabs();
                }
                // Handle placeholder for floating labels
                if (input.value !== '') {
                    input.placeholder = ' ';
                } else {
                    // Restore original-like placeholder if field is cleared
                    if (input.id === 'hotelNameKo') input.placeholder = '호텔명 (한글)';
                    else if (input.id === 'hotelNameEn') input.placeholder = '호텔명 (영문)';
                    else if (input.id === 'hotelWebsite') input.placeholder = '호텔 웹사이트';
                    else if (input.id === 'hotelImage') input.placeholder = '대표 이미지 URL';
                    else if (input.id === 'hotelDescription') input.placeholder = '간단 설명 (줄바꿈으로 항목 구분)';
                    // No need for a generic ' ' here as the CSS handles it with :not(:placeholder-shown)
                }
            });
             // Ensure labels float correctly on load if there's pre-filled data (e.g. from a load operation later)
            if (input.value !== '') {
                input.placeholder = ' ';
            }
        }
    });

    if (cancelLoadHotelSetModalButton) {
        cancelLoadHotelSetModalButton.addEventListener('click', () => {
            if(loadHotelSetModal) loadHotelSetModal.classList.add('hidden');
        });
    }
    if (closeLoadHotelSetModalButton) {
        closeLoadHotelSetModalButton.addEventListener('click', () => {
            if(loadHotelSetModal) loadHotelSetModal.classList.add('hidden');
        });
    }

    if (hotelSetSearchInput) {
        hotelSetSearchInput.addEventListener('input', renderFilteredHotelSetList);
    }

    if (hotelEditorForm) {
        hotelEditorForm.addEventListener('paste', function(event) {
            const pastedText = (event.clipboardData || window.clipboardData).getData('text/plain');
            const isTSVLike = pastedText.includes('\t');

            if (isTSVLike) {
                if (confirm('엑셀/표 형식의 데이터를 붙여넣어 호텔 정보를 처리하시겠습니까?\n(선택된 호텔이 있으면 첫 줄로 덮어쓰고 나머지는 뒤에 추가, 없으면 모두 새 호텔로 추가됩니다.)\n주의: 이 작업은 현재 편집 중인 목록에만 적용되며, Firebase에 저장하려면 별도로 "저장" 또는 "다른 이름으로 저장"을 해야 합니다.')) {
                    event.preventDefault();
                    const result = importHotelsFromTSV(pastedText);

                    if (result.importedCount > 0) {
                        alert(`${result.importedCount}개의 호텔 정보가 현재 목록에 처리되었습니다.`);
                        renderTabs();
                        if (result.affectedIndex !== -1 && result.affectedIndex < allHotelData.length) {
                            switchTab(result.affectedIndex);
                        } else if (allHotelData.length > 0) {
                            switchTab(0);
                        } else {
                            switchTab(-1);
                        }
                    } else {
                        alert('붙여넣은 데이터에서 유효한 호텔 정보를 찾을 수 없거나, 형식이 맞지 않습니다.');
                    }
                    if (result.errors.length > 0) {
                        console.warn("Import errors:\n" + result.errors.join("\n"));
                        alert(`가져오기 중 ${result.errors.length}개의 항목에서 오류가 발생했습니다. 개발자 콘솔을 확인하세요.`);
                    }
                }
            }
        });
    }
    
    // 수정된 초기화: 처음에는 아무것도 없는 상태로 시작
    renderTabs(); 
    renderEditorForCurrentHotel();
});
