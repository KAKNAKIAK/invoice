// --- Predefined Emojis ---
const travelEmojis = [
    { value: "", display: "아이콘 없음" }, { value: "💆🏻", display: "💆🏻 마사지" }, { value: "✈️", display: "✈️ 항공" }, { value: "🏨", display: "🏨 숙소" }, { value: "🍽️", display: "🍽️ 식사" }, { value: "🏛️", display: "🏛️ 관광(실내)" }, { value: "🏞️", display: "🏞️ 관광(야외)" }, { value: "🚶", display: "🚶 이동(도보)" }, { value: "🚌", display: "🚌 이동(버스)" }, { value: "🚆", display: "🚆 이동(기차)" }, { value: "🚢", display: "🚢 이동(배)" }, { value: "🚕", display: "🚕 이동(택시)" }, { value: "🛍️", display: "🛍️ 쇼핑" }, { value: "📷", display: "📷 사진촬영" }, { value: "🗺️", display: "🗺️ 계획/지도" }, { value: "📌", display: "📌 중요장소" }, { value: "☕", display: "☕ 카페/휴식" }, { value: "🎭", display: "🎭 공연/문화" }, { value: "💼", display: "💼 업무" }, { value: "ℹ️", display: "ℹ️ 정보" }
];

// ▼▼▼ Firebase 초기화 ▼▼▼
const firebaseConfig = {
  apiKey: "AIzaSyAGULxdnWWnSc5eMCsqHeKGK9tmyHsxlv0",
  authDomain: "trip-planner-app-cc72c.firebaseapp.com",
  projectId: "trip-planner-app-cc72c",
  storageBucket: "trip-planner-app-cc72c.appspot.com",
  messagingSenderId: "1063594141232",
  appId: "1:1063594141232:web:1dbba9b9722b20ff602ff5",
  measurementId: "G-2G3Z6WMLF6"
};

if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
} else {
    console.error("Firebase SDK가 로드되지 않았습니다.");
}

const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;
if (!db && typeof firebase !== 'undefined') {
    console.error("Firestore 인스턴스를 초기화할 수 없습니다.");
}
// ▲▲▲ Firebase 초기화 끝 ▲▲▲


// --- Data ---
let currentTripId = null;
let tripData = {
    title: "새 여행 일정표",
    editingTitle: false,
    days: [
        { date: dateToYyyyMmDd(new Date()), activities: [], isCollapsed: false, editingDate: false }
    ]
};
let allFetchedTrips = [];

// --- DOM Elements ---
const headerTitleSection = document.getElementById('headerTitleSection');
const daysContainer = document.getElementById('daysContainer');
const addDayButton = document.getElementById('addDayButton');
const activityModal = document.getElementById('activityModal');
const modalTitle = document.getElementById('modalTitle');
const activityForm = document.getElementById('activityForm');
const activityIdInput = document.getElementById('activityId');
const dayIndexInput = document.getElementById('dayIndex');
const activityTimeInput = document.getElementById('activityTimeInput');
const activityIconSelect = document.getElementById('activityIconSelect');
const copyInlineHtmlButton = document.getElementById('copyInlineHtmlButton');
const inlinePreviewButton = document.getElementById('inlinePreviewButton');
const loadHtmlButtonTrigger = document.getElementById('loadHtmlButtonTrigger');
const loadDayAtIndexHtmlInput = document.getElementById('loadDayAtIndexHtmlInput');
const toast = document.getElementById('toast');
const confirmDeleteDayModal = document.getElementById('confirmDeleteDayModal');
const confirmDeleteDayMessage = document.getElementById('confirmDeleteDayMessage');
const cancelDeleteDayButton = document.getElementById('cancelDeleteDayButton');
const confirmDeleteDayActionButton = document.getElementById('confirmDeleteDayActionButton');
const loadTripModal = document.getElementById('loadTripModal');
const tripListForLoadUl = document.getElementById('tripListForLoad');
const cancelLoadTripModalButton = document.getElementById('cancelLoadTripModalButton');
const loadingTripListMsg = document.getElementById('loadingTripListMsg');
const tripSearchInput = document.getElementById('tripSearchInput');


let dayIndexToDelete = -1;
let insertDayAtIndex = -1;

// --- Utility Functions ---
function generateId() { return 'id_' + Math.random().toString(36).substr(2, 9); }
function formatDate(dateString, dayNumber) { const date = new Date(dateString + "T00:00:00Z"); const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }; return `DAY ${dayNumber}: ${date.toLocaleDateString('ko-KR', options)}`; }

function formatTimeToHHMM(timeStr) {
    if (timeStr && timeStr.length === 4 && /^\d{4}$/.test(timeStr)) {
        const hours = timeStr.substring(0, 2);
        const minutes = timeStr.substring(2, 4);
        if (parseInt(hours, 10) >= 0 && parseInt(hours, 10) <= 23 &&
            parseInt(minutes, 10) >= 0 && parseInt(minutes, 10) <= 59) {
            return `${hours}:${minutes}`;
        }
    }
    return "";
}

function populateIconDropdown() { if(activityIconSelect) {activityIconSelect.innerHTML = ''; travelEmojis.forEach(emoji => { const option = document.createElement('option'); option.value = emoji.value; option.textContent = emoji.display; activityIconSelect.appendChild(option); });} }
function dateToYyyyMmDd(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let dayVal = '' + d.getDate();
    const year = d.getFullYear();
    if (month.length < 2) month = '0' + month;
    if (dayVal.length < 2) dayVal = '0' + dayVal;
    return [year, month, dayVal].join('-');
}

function showToastMessage(message, isError = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.style.backgroundColor = isError ? 'red' : '';
    toast.classList.remove('opacity-0');
    setTimeout(() => {
        toast.classList.add('opacity-0');
        if (isError) toast.style.backgroundColor = '';
    }, 3000);
}

// --- Icon SVGs ---
const editIconSVG = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>`;
const saveIconSVG = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
const cancelIconSVG = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
const duplicateIconSVG = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`;
const deleteIconSVG = `<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
const saveDayIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><path d="M17 21 L17 13 H7 v8"></path><path d="M7 3 L7 8 H3"></path></svg>`;
const loadDayAtIndexIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l.001-.001 8.49-8.48"></path><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>`;

// --- Rendering Functions for Main App ---
function renderHeaderTitle() {
    if (!headerTitleSection) return;
    headerTitleSection.innerHTML = '';
    if (tripData.editingTitle) {
        const input = document.createElement('input'); input.type = 'text'; input.className = 'header-title-input'; input.value = tripData.title; input.id = 'tripTitleInput';
        const saveButton = document.createElement('button'); saveButton.className = 'icon-button save-trip-title-button'; saveButton.title = '제목 저장'; saveButton.innerHTML = saveIconSVG; saveButton.addEventListener('click', handleSaveTripTitle);
        const cancelButton = document.createElement('button'); cancelButton.className = 'icon-button cancel-trip-title-edit-button'; cancelButton.title = '취소'; cancelButton.innerHTML = cancelIconSVG; cancelButton.addEventListener('click', handleCancelTripTitleEdit);
        headerTitleSection.appendChild(input); headerTitleSection.appendChild(saveButton); headerTitleSection.appendChild(cancelButton);
        input.focus(); input.select();
    } else {
        const titleH1 = document.createElement('h1'); titleH1.className = 'text-2xl font-bold'; titleH1.textContent = tripData.title; titleH1.id = 'tripTitleDisplay';
        const editButton = document.createElement('button'); editButton.className = 'icon-button edit-trip-title-button'; editButton.title = '여행 제목 수정'; editButton.innerHTML = editIconSVG; editButton.addEventListener('click', handleEditTripTitle);
        headerTitleSection.appendChild(titleH1); headerTitleSection.appendChild(editButton);
    }
}

function renderTrip() {
    renderHeaderTitle();
    if (!daysContainer) return;
    daysContainer.innerHTML = '';
    if (!tripData.days) tripData.days = [];

    tripData.days.forEach((day, dayIndex) => {
        const daySection = document.createElement('div'); daySection.className = 'day-section bg-white shadow-sm rounded-md'; daySection.dataset.dayId = `day-${dayIndex}`;
        const expandedIcon = `<svg class="toggle-icon w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`;
        const collapsedIcon = `<svg class="toggle-icon w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`;
        let dateDisplayHTML = day.editingDate ? `<input type="text" class="date-edit-input-text" value="${day.date}" data-day-index="${dayIndex}" placeholder="YYYY-MM-DD 또는 YYMMDD"><button class="save-date-button icon-button" data-day-index="${dayIndex}" title="날짜 저장">${saveIconSVG}</button><button class="cancel-date-edit-button icon-button" data-day-index="${dayIndex}" title="취소">${cancelIconSVG}</button>` : `<h2 class="day-header-title" data-day-index="${dayIndex}">${formatDate(day.date, dayIndex + 1)}</h2><button class="edit-date-button icon-button" data-day-index="${dayIndex}" title="날짜 수정">${editIconSVG}</button>`;
        daySection.innerHTML = `<div class="day-header-container"><div class="day-header-main">${dateDisplayHTML}</div><div class="day-header-controls"><button class="save-day-button icon-button" data-day-index="${dayIndex}" title="이 날짜 HTML로 저장 (로컬 백업용)">${saveDayIconSVG}</button><button class="load-day-at-index-button icon-button" data-day-index="${dayIndex}" title="이 날짜에 덮어쓰기 (로컬 파일)">${loadDayAtIndexIconSVG}</button><button class="delete-day-button icon-button" data-day-index="${dayIndex}" title="이 날짜 전체 삭제">${deleteIconSVG}</button><button class="day-toggle-button p-1 rounded hover:bg-gray-200" data-day-index="${dayIndex}">${day.isCollapsed ? collapsedIcon : expandedIcon}</button></div></div><div class="day-content-wrapper ${day.isCollapsed ? 'hidden' : ''}"><div class="activities-list pt-3" data-day-index="${dayIndex}"></div><button class="add-activity-button mt-2 mb-4 ml-2 action-button bg-teal-500 text-white hover:bg-teal-600" data-day-index="${dayIndex}"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>이 날짜에 새 일정 추가</button></div>`;
        daysContainer.appendChild(daySection);
        const activitiesList = daySection.querySelector('.activities-list');
        renderActivities(activitiesList, day.activities || [], dayIndex);
        if (day.editingDate) { daySection.querySelector('.save-date-button').addEventListener('click', handleSaveDate); daySection.querySelector('.cancel-date-edit-button').addEventListener('click', handleCancelDateEdit); } else { daySection.querySelector('.edit-date-button').addEventListener('click', handleEditDate); }
        daySection.querySelector('.day-header-container').addEventListener('click', (e) => { if (!e.target.closest('input') && !e.target.closest('button')) { handleToggleDayCollapse(e); } });
        daySection.querySelector('.save-day-button').addEventListener('click', (e) => { const dayIdx = parseInt(e.currentTarget.dataset.dayIndex); handleSaveDayAsHtml(dayIdx); });
        daySection.querySelector('.load-day-at-index-button').addEventListener('click', (e) => { insertDayAtIndex = parseInt(e.currentTarget.dataset.dayIndex); if(loadDayAtIndexHtmlInput) loadDayAtIndexHtmlInput.click(); });
        daySection.querySelector('.delete-day-button').addEventListener('click', (e) => { const dayIdx = parseInt(e.currentTarget.dataset.dayIndex); showConfirmDeleteDayModal(dayIdx); });
        daySection.querySelector('.day-toggle-button').addEventListener('click', handleToggleDayCollapse);
        daySection.querySelector('.add-activity-button').addEventListener('click', handleOpenActivityModalForNew);
        if (typeof Sortable !== 'undefined' && activitiesList) { new Sortable(activitiesList, { group: 'shared-activities', animation: 150, ghostClass: 'sortable-ghost', dragClass: 'sortable-drag', handle: '.activity-card', onEnd: function (evt) { const fromDayIndex = parseInt(evt.from.dataset.dayIndex); const toDayIndex = parseInt(evt.to.dataset.dayIndex); const oldActivityIndex = evt.oldDraggableIndex; const newActivityIndex = evt.newDraggableIndex; if (oldActivityIndex !== undefined && newActivityIndex !== undefined) { const movedActivity = tripData.days[fromDayIndex].activities.splice(oldActivityIndex, 1)[0]; tripData.days[toDayIndex].activities.splice(newActivityIndex, 0, movedActivity); renderTrip(); } } }); }
    });
    if (typeof Sortable !== 'undefined' && daysContainer) { if (daysContainer.children.length > 0 && !daysContainer.sortableInstance) { daysContainer.sortableInstance = new Sortable(daysContainer, { animation: 200, ghostClass: 'day-section.sortable-ghost', handle: '.day-header-container', onEnd: function(evt) { const oldIndex = evt.oldDraggableIndex; const newIndex = evt.newDraggableIndex; if (oldIndex !== undefined && newIndex !== undefined && oldIndex !== newIndex) { const movedDay = tripData.days.splice(oldIndex, 1)[0]; tripData.days.splice(newIndex, 0, movedDay); recalculateAllDates(); renderTrip(); } } }); } else if (daysContainer.children.length === 0 && daysContainer.sortableInstance) { daysContainer.sortableInstance.destroy(); daysContainer.sortableInstance = null; } }
}

function renderActivities(activitiesListElement, activities, dayIndex) {
    if (!activitiesListElement) return;
    activitiesListElement.innerHTML = '';
    (activities || []).forEach((activity) => {
        const card = document.createElement('div'); card.className = 'activity-card'; card.setAttribute('data-activity-id', activity.id);
        let imageHTML = activity.imageUrl ? `<img src="${activity.imageUrl}" alt="${activity.title || '활동 이미지'}" class="card-image" onerror="this.style.display='none';">` : '';
        card.innerHTML = `<div class="card-time-icon-area">${activity.icon ? `<div class="card-icon">${activity.icon}</div>` : '<div class="card-icon" style="height: 28.8px;"></div>'}<div class="card-time">${formatTimeToHHMM(activity.time)}</div></div><div class="card-details-area"><div class="card-title">${activity.title || ''}</div>${activity.description ? `<div class="card-description">${activity.description}</div>` : ''}${imageHTML}${activity.locationLink ? `<div class="card-location">📍 <a href="${activity.locationLink}" target="_blank" rel="noopener noreferrer">${activity.locationLink.length > 30 ? activity.locationLink.substring(0,27) + '...' : activity.locationLink}</a></div>` : ''}${activity.cost ? `<div class="card-cost">💰 ${activity.cost}</div>` : ''}${activity.notes ? `<div class="card-notes">📝 ${activity.notes}</div>` : ''}</div><div class="card-actions-direct"><button class="icon-button card-action-icon-button edit-activity-button" data-day-index="${dayIndex}" data-activity-id="${activity.id}" title="수정">${editIconSVG}</button><button class="icon-button card-action-icon-button duplicate-activity-button" data-day-index="${dayIndex}" data-activity-id="${activity.id}" title="복제">${duplicateIconSVG}</button><button class="icon-button card-action-icon-button delete-activity-button" data-day-index="${dayIndex}" data-activity-id="${activity.id}" title="삭제">${deleteIconSVG}</button></div>`;
        activitiesListElement.appendChild(card);
    });
    activitiesListElement.querySelectorAll('.edit-activity-button').forEach(button => { button.addEventListener('click', handleOpenActivityModalForEdit); });
    activitiesListElement.querySelectorAll('.delete-activity-button').forEach(button => button.addEventListener('click', handleDeleteActivity));
    activitiesListElement.querySelectorAll('.duplicate-activity-button').forEach(button => button.addEventListener('click', handleDuplicateActivity));
}

// --- Trip Title Editing Handlers ---
function handleEditTripTitle() { tripData.editingTitle = true; renderHeaderTitle(); }
function handleSaveTripTitle() { const titleInput = document.getElementById('tripTitleInput'); tripData.title = (titleInput && titleInput.value.trim() !== "") ? titleInput.value.trim() : "제목 없음"; tripData.editingTitle = false; renderHeaderTitle(); }
function handleCancelTripTitleEdit() { tripData.editingTitle = false; renderHeaderTitle(); }

// --- Date Editing and Recalculation ---
function isValidDateString(dateString) { if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false; const parts = dateString.split("-"); const year = parseInt(parts[0], 10); const month = parseInt(parts[1], 10); const day = parseInt(parts[2], 10); if (year < 1000 || year > 3000 || month === 0 || month > 12) return false; const monthLength = [31, (year % 400 === 0 || (year % 100 !== 0 && year % 4 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; return !(day === 0 || day > monthLength[month - 1]); }
function parseAndValidateDateInput(inputValue) { let dateStr = inputValue.trim(); if (/^\d{8}$/.test(dateStr)) { dateStr = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`; } else if (/^\d{6}$/.test(dateStr)) { const currentYearPrefix = new Date().getFullYear().toString().substring(0, 2); dateStr = `${currentYearPrefix}${dateStr.substring(0, 2)}-${dateStr.substring(2, 4)}-${dateStr.substring(4, 6)}`; } else if (/^\d{4}[./]\d{2}[./]\d{2}$/.test(dateStr)) { dateStr = dateStr.replace(/[./]/g, '-'); } return isValidDateString(dateStr) ? dateStr : null; }
function recalculateAllDates() { if (tripData.days && tripData.days.length > 0 && tripData.days[0].date) { let currentDate = new Date(tripData.days[0].date + "T00:00:00Z"); tripData.days[0].date = dateToYyyyMmDd(currentDate); for (let i = 1; i < tripData.days.length; i++) { currentDate.setDate(currentDate.getDate() + 1); tripData.days[i].date = dateToYyyyMmDd(currentDate); } } }
function handleEditDate(event) { const dayIndex = parseInt(event.currentTarget.dataset.dayIndex); tripData.days.forEach((day, index) => { day.editingDate = (index === dayIndex); }); renderTrip(); }
function handleSaveDate(event) { const dayIndex = parseInt(event.currentTarget.dataset.dayIndex); const dateInput = document.querySelector(`.date-edit-input-text[data-day-index="${dayIndex}"]`); if (dateInput && dateInput.value) { const validatedDate = parseAndValidateDateInput(dateInput.value); if (validatedDate) { tripData.days[dayIndex].date = validatedDate; tripData.days[dayIndex].editingDate = false; recalculateAllDates(); renderTrip(); } else { showToastMessage("잘못된 날짜 형식입니다.", true); } } else { tripData.days[dayIndex].editingDate = false; renderTrip(); } }
function handleCancelDateEdit(event) { const dayIndex = parseInt(event.currentTarget.dataset.dayIndex); tripData.days[dayIndex].editingDate = false; renderTrip(); }
function handleToggleDayCollapse(event) { const dayHeaderContainer = event.target.closest('.day-header-container'); if (!dayHeaderContainer) return; const dayIndexElement = dayHeaderContainer.querySelector('[data-day-index]'); if (!dayIndexElement) return; const dayIndex = parseInt(dayIndexElement.dataset.dayIndex); const day = tripData.days[dayIndex]; if (day.editingDate) return; const dayContentWrapper = dayHeaderContainer.nextElementSibling; const toggleButtonElement = dayHeaderContainer.querySelector('.day-toggle-button'); const expandedIcon = `<svg class="toggle-icon w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>`; const collapsedIcon = `<svg class="toggle-icon w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>`; day.isCollapsed = !day.isCollapsed; if (dayContentWrapper) dayContentWrapper.classList.toggle('hidden', day.isCollapsed); if (toggleButtonElement) { toggleButtonElement.innerHTML = day.isCollapsed ? collapsedIcon : expandedIcon; } }

// --- Activity Modal Logic ---
function handleOpenActivityModalForNew(event) { const dayIdx = event.currentTarget.dataset.dayIndex; if(modalTitle) modalTitle.textContent = '새 일정 추가'; if(activityForm) activityForm.reset(); populateIconDropdown(); if(activityIconSelect) activityIconSelect.value = travelEmojis[0].value; if(activityTimeInput) activityTimeInput.value = ''; if(activityIdInput) activityIdInput.value = ''; if(dayIndexInput) dayIndexInput.value = dayIdx; if(activityModal) activityModal.classList.remove('hidden'); }
function populateAndOpenEditActivityModal(dayIdxStr, activityIdToEdit) {
    const dayIdx = parseInt(dayIdxStr, 10); const day = tripData.days[dayIdx];
    if (!day || !day.activities) { showToastMessage("일정을 수정하는 중 오류가 발생했습니다.", true); return; }
    const activity = day.activities.find(act => act.id === activityIdToEdit);
    if (activity) {
        if(modalTitle) modalTitle.textContent = '일정 수정'; if(activityForm) activityForm.reset(); populateIconDropdown();
        if(activityIdInput) activityIdInput.value = activity.id; if(dayIndexInput) dayIndexInput.value = dayIdx;
        if(activityTimeInput) activityTimeInput.value = activity.time || ""; if(activityIconSelect) activityIconSelect.value = activity.icon || "";
        const titleEl = document.getElementById('activityTitle'); if(titleEl) titleEl.value = activity.title || "";
        const descEl = document.getElementById('activityDescription'); if(descEl) descEl.value = activity.description || "";
        const locEl = document.getElementById('activityLocation'); if(locEl) locEl.value = activity.locationLink || "";
        const imgEl = document.getElementById('activityImageUrl'); if(imgEl) imgEl.value = activity.imageUrl || "";
        const costEl = document.getElementById('activityCost'); if(costEl) costEl.value = activity.cost || "";
        const notesEl = document.getElementById('activityNotes'); if(notesEl) notesEl.value = activity.notes || "";
        if(activityModal) activityModal.classList.remove('hidden');
    } else { showToastMessage("해당 일정을 찾을 수 없습니다.", true); }
}
function handleOpenActivityModalForEdit(event) { const button = event.currentTarget; populateAndOpenEditActivityModal(button.dataset.dayIndex, button.dataset.activityId); }
if (activityTimeInput) activityTimeInput.addEventListener('input', function(e) { let value = e.target.value.replace(/[^0-9]/g, ''); e.target.value = value.length > 4 ? value.substring(0, 4) : value; });
if (activityForm) activityForm.addEventListener('submit', (e) => {
    e.preventDefault(); const dayIdx = parseInt(dayIndexInput.value); const currentActivityId = activityIdInput.value;
    let timeValue = activityTimeInput.value.trim();
    if (timeValue) { if (timeValue.length !== 4 || !/^\d{4}$/.test(timeValue) || parseInt(timeValue.substring(0, 2), 10) > 23 || parseInt(timeValue.substring(2, 4), 10) > 59) { showToastMessage("시간은 유효한 HHMM 형식의 4자리 숫자로 입력하거나 비워두세요.", true); return; } }
    const activityData = { id: currentActivityId || generateId(), time: timeValue, icon: activityIconSelect.value, title: document.getElementById('activityTitle').value, description: document.getElementById('activityDescription').value, locationLink: document.getElementById('activityLocation').value, imageUrl: document.getElementById('activityImageUrl').value, cost: document.getElementById('activityCost').value, notes: document.getElementById('activityNotes').value };
    if (currentActivityId) { const activityIndex = tripData.days[dayIdx].activities.findIndex(act => act.id === currentActivityId); if (activityIndex > -1) { tripData.days[dayIdx].activities[activityIndex] = activityData; } } else { if(tripData.days[dayIdx]) tripData.days[dayIdx].activities.push(activityData); }
    if(activityModal) activityModal.classList.add('hidden'); renderTrip();
});
const cancelActivityButton = document.getElementById('cancelActivityButton');
if (cancelActivityButton) cancelActivityButton.addEventListener('click', () => { if(activityModal) activityModal.classList.add('hidden'); });

// --- Day Management ---
if (addDayButton) addDayButton.addEventListener('click', () => { let newDate; let newDayIsCollapsed; if (tripData.days && tripData.days.length > 0 && tripData.days[tripData.days.length - 1].date) { const lastDate = new Date(tripData.days[tripData.days.length - 1].date + "T00:00:00Z"); newDate = new Date(lastDate); newDate.setDate(lastDate.getDate() + 1); newDayIsCollapsed = true; } else { newDate = new Date(); newDayIsCollapsed = false; tripData.days = []; } const newDay = { date: dateToYyyyMmDd(newDate), activities: [], isCollapsed: newDayIsCollapsed, editingDate: false }; tripData.days.push(newDay); renderTrip(); });
function showConfirmDeleteDayModal(dayIdx) { dayIndexToDelete = dayIdx; const dayNumber = dayIdx + 1; const dateString = new Date(tripData.days[dayIdx].date + "T00:00:00Z").toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }); if(confirmDeleteDayMessage) confirmDeleteDayMessage.textContent = `DAY ${dayNumber} (${dateString}) 삭제 확인`; if(confirmDeleteDayModal) confirmDeleteDayModal.classList.remove('hidden'); }
function hideConfirmDeleteDayModal() { if(confirmDeleteDayModal) confirmDeleteDayModal.classList.add('hidden'); dayIndexToDelete = -1; }
if (confirmDeleteDayActionButton) confirmDeleteDayActionButton.addEventListener('click', () => { if (dayIndexToDelete > -1 && dayIndexToDelete < tripData.days.length) { tripData.days.splice(dayIndexToDelete, 1); recalculateAllDates(); renderTrip(); } hideConfirmDeleteDayModal(); });
if (cancelDeleteDayButton) cancelDeleteDayButton.addEventListener('click', hideConfirmDeleteDayModal);
function handleDeleteActivity(event) { const button = event.currentTarget; tripData.days[button.dataset.dayIndex].activities = tripData.days[button.dataset.dayIndex].activities.filter(act => act.id !== button.dataset.activityId); renderTrip(); }
function handleDuplicateActivity(event) { const button = event.currentTarget; const dayIdx = parseInt(button.dataset.dayIndex); const activityToDuplicate = tripData.days[dayIdx].activities.find(act => act.id === button.dataset.activityId); if (activityToDuplicate) { const newActivity = { ...activityToDuplicate, id: generateId(), title: `${activityToDuplicate.title} (복사본)` }; const originalIndex = tripData.days[dayIdx].activities.findIndex(act => act.id === button.dataset.activityId); tripData.days[dayIdx].activities.splice(originalIndex + 1, 0, newActivity); renderTrip(); } }

// --- Firestore 연동 함수 ---
async function deleteTripFromFirestore(tripIdToDelete, tripTitle) {
    if (!db) { showToastMessage("Firestore가 초기화되지 않았습니다.", true); return; }
    if (!tripIdToDelete) { showToastMessage("삭제할 일정 ID가 없습니다.", true); return; }

    if (!confirm(`"${tripTitle}" 일정을 정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;

    try {
        await db.collection("tripplan").doc(tripIdToDelete).delete();
        showToastMessage(`"${tripTitle}" 일정이 Firestore에서 삭제되었습니다.`);

        if (currentTripId === tripIdToDelete) {
            currentTripId = null;
            tripData = { title: "새 여행 일정표", editingTitle: false, days: [{ date: dateToYyyyMmDd(new Date()), activities: [], isCollapsed: false, editingDate: false }] };
            renderTrip();
        }
        
        if (loadTripModal && !loadTripModal.classList.contains('hidden')) {
            loadTripListFromFirestore();
        }

    } catch (error) {
        console.error("Error deleting trip from Firestore: ", error);
        showToastMessage(`"${tripTitle}" 일정 삭제 중 오류가 발생했습니다.`, true);
    }
}

async function loadTripFromFirestore(tripIdToLoad) {
    if (!db) { showToastMessage("Firestore가 초기화되지 않았습니다.", true); return; }
    if (!tripIdToLoad) {
        tripData = { title: "새 여행 일정표", editingTitle: false, days: [{ date: dateToYyyyMmDd(new Date()), activities: [], isCollapsed: false, editingDate: false }] };
        currentTripId = null; renderTrip(); return;
    }
    try {
        const doc = await db.collection("tripplan").doc(tripIdToLoad).get();
        if (doc.exists) {
            const loadedData = doc.data();
            tripData = {
                title: loadedData.title || "제목 없음",
                days: (loadedData.days || []).map(day => ({...day, editingDate: false})),
                editingTitle: false
            };
            if (tripData.days.length === 0) tripData.days.push({ date: dateToYyyyMmDd(new Date()), activities: [], isCollapsed: false, editingDate: false });
            if (tripData.days.length > 0 && tripData.days[0]) tripData.days[0].isCollapsed = false;
            currentTripId = tripIdToLoad;
            renderTrip();
            showToastMessage(`'${tripData.title}' 일정을 Firestore에서 불러왔습니다.`);
        } else {
            showToastMessage(`ID '${tripIdToLoad}'에 해당하는 일정을 찾을 수 없습니다. 새 일정을 시작합니다.`, true);
            tripData = { title: "새 여행 일정표", editingTitle: false, days: [{ date: dateToYyyyMmDd(new Date()), activities: [], isCollapsed: false, editingDate: false }] };
            currentTripId = null; renderTrip();
        }
    } catch (error) { console.error("Error loading trip from Firestore: ", error); showToastMessage("일정 불러오기 중 오류가 발생했습니다.", true); }
}

function renderFilteredTripList() {
    if (!tripListForLoadUl || !tripSearchInput) return; 

    const searchTerm = tripSearchInput.value.toLowerCase();
    tripListForLoadUl.innerHTML = ''; 

    const filteredTrips = allFetchedTrips.filter(trip => trip.title.toLowerCase().includes(searchTerm));

    if (filteredTrips.length > 0) {
        filteredTrips.forEach(trip => {
            const listItem = document.createElement('li');
            listItem.className = 'flex justify-between items-center p-2 hover:bg-gray-100 rounded group';
            
            const titleSpan = document.createElement('span');
            titleSpan.textContent = trip.title;
            titleSpan.dataset.tripId = trip.id;
            titleSpan.className = 'cursor-pointer flex-grow hover:text-blue-600 mr-2 text-sm';
            titleSpan.title = `"${trip.title}" 일정 불러오기`;
            titleSpan.addEventListener('click', () => { loadTripFromFirestore(trip.id); if (loadTripModal) loadTripModal.classList.add('hidden'); });
            
            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = `<svg class="w-4 h-4 text-gray-400 group-hover:text-red-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`;
            deleteButton.className = 'action-button text-xs px-2 py-1 opacity-50 group-hover:opacity-100 hover:bg-red-100 rounded';
            deleteButton.title = `"${trip.title}" 일정 삭제`;
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation(); 
                deleteTripFromFirestore(event.currentTarget.dataset.tripId, event.currentTarget.dataset.tripTitle);
            });

            listItem.appendChild(titleSpan);
            listItem.appendChild(deleteButton);
            tripListForLoadUl.appendChild(listItem);
        });
    } else {
        const isLoading = loadingTripListMsg && loadingTripListMsg.style.display !== 'none';
        if (!isLoading) {
            const message = searchTerm ? `"'${tripSearchInput.value}'" 검색 결과가 없습니다.` : '저장된 여행 일정이 없습니다.';
            tripListForLoadUl.innerHTML = `<li class="p-2 text-gray-500">${message}</li>`;
        }
    }
}

async function loadTripListFromFirestore() {
    if (!db || !loadTripModal || !tripListForLoadUl || !loadingTripListMsg || !tripSearchInput) {
        showToastMessage("일정 불러오기 UI가 준비되지 않았습니다.", true);
        return;
    }

    loadingTripListMsg.textContent = "목록을 불러오는 중...";
    loadingTripListMsg.style.display = 'block';
    tripListForLoadUl.innerHTML = '';
    tripSearchInput.value = '';
    
    loadTripModal.classList.remove('hidden');
    allFetchedTrips = [];

    try {
        const querySnapshot = await db.collection("tripplan").orderBy("title").get(); 
        querySnapshot.forEach((doc) => allFetchedTrips.push({ id: doc.id, title: doc.data().title || "제목 없음" }));
        loadingTripListMsg.style.display = 'none';
        renderFilteredTripList();
    } catch (error) {
        console.error("Error loading trip list from Firestore: ", error);
        showToastMessage("일정 목록 불러오기 중 오류가 발생했습니다.", true);
        if(loadingTripListMsg) loadingTripListMsg.textContent = "목록 불러오기 중 오류가 발생했습니다.";
        allFetchedTrips = [];
        loadingTripListMsg.style.display = 'none';
        renderFilteredTripList();
    }
}

// --- 로컬 파일 저장/불러오기 (백업용) ---
function generateReadOnlyDayView(dayData, dayNumber) { let activitiesHTML = ''; (dayData.activities || []).forEach(activity => { let imageHTML = activity.imageUrl ? `<img src="${activity.imageUrl}" alt="${activity.title || '활동 이미지'}" class="card-image" onerror="this.style.display='none';">` : ''; activitiesHTML += `<div class="readonly-activity-card"><div class="card-time-icon-area">${activity.icon ? `<div class="card-icon">${activity.icon}</div>` : '<div class="card-icon" style="height: 28.8px;"></div>'}<div class="card-time">${formatTimeToHHMM(activity.time)}</div></div><div class="card-details-area"><div class="card-title">${activity.title || ''}</div>${activity.description ? `<div class="card-description">${activity.description}</div>` : ''}${imageHTML}${activity.locationLink ? `<div class="card-location">📍 <a href="${activity.locationLink}" target="_blank" rel="noopener noreferrer">위치 보기</a></div>` : ''}${activity.cost ? `<div class="card-cost">💰 ${activity.cost}</div>` : ''}${activity.notes ? `<div class="card-notes">📝 ${activity.notes}</div>` : ''}</div></div>`; }); return `<div class="day-section bg-white shadow-sm rounded-md"><div class="day-header-container" id="day-header-readonly-single-${dayNumber}"><div class="day-header-main"><h2 class="day-header-title">${formatDate(dayData.date, dayNumber)}</h2></div></div><div class="day-content-wrapper"><div class="activities-list pt-3">${activitiesHTML}</div></div></div>`; }
function handleSaveDayAsHtml(dayIndex) { if (dayIndex < 0 || !tripData.days || dayIndex >= tripData.days.length) return; const dayDataToSave = JSON.parse(JSON.stringify(tripData.days[dayIndex])); const dayDataString = JSON.stringify(dayDataToSave).replace(/<\/script>/g, '<\\/script>'); const readOnlyDayViewHTML = generateReadOnlyDayView(dayDataToSave, dayIndex + 1); let styles = ""; Array.from(document.styleSheets).forEach(sheet => { try { Array.from(sheet.cssRules).forEach(rule => { styles += rule.cssText + '\n'; }); } catch (e) { console.warn("CSS 규칙 접근 불가:", sheet.href); } }); const htmlContent = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>DAY ${dayIndex + 1} 일정 (${dayDataToSave.date})</title><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap" rel="stylesheet"><style>body { font-family: 'Noto Sans KR', sans-serif; background-color: #F8F9FA; margin:0; padding:0;} ${styles} .readonly-view-header h1 { font-size: 1.25rem; text-align: center; padding: 1rem; background-color: white; border-bottom: 1px solid #E0E0E0;} .saved-html-view .day-content-wrapper { display: block !important; } .saved-html-view .day-header-controls .day-toggle-button-static { display: none !important; } main.readonly-main-content { max-width: 48rem; margin-left: auto; margin-right: auto; padding: 1rem; } @media print { .readonly-view-header { display: none !important; } .main-content, .readonly-main-content { padding: 0 !important; margin:0 auto; max-width: 100%; } body { background-color: white; } .day-section { margin-bottom: 10mm; page-break-inside: avoid; border: 1px solid #ccc !important; box-shadow: none !important; } .day-header-container { padding: 8px 0px !important; margin-bottom: 5mm; border-bottom: 2px solid black !important; background-color: white !important; } .day-header-title { font-size: 14pt !important; } .day-content-wrapper { padding: 0 !important; } .activity-card, .readonly-activity-card { border: 1px solid #eee !important; box-shadow: none !important; padding: 3mm !important; margin-top: 3mm !important; margin-bottom: 0; page-break-inside: avoid; } .card-image { display: none !important; } @page { size: A4 portrait; margin: 15mm; @top-center { content: "DAY ${dayIndex + 1} (${dayDataToSave.date})"; font-size: 10pt; color: #333; } @bottom-right { content: "Page " counter(page) " / " counter(pages); font-size: 8pt; color: #555; } } }</style></head><body class="text-gray-800"><header class="readonly-view-header"><h1>DAY ${dayIndex + 1} : ${new Date(dayDataToSave.date + "T00:00:00Z").toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</h1></header><main class="readonly-main-content saved-html-view">${readOnlyDayViewHTML}</main><script type="application/json" id="embeddedTripDayData">${dayDataString}<\/script></body></html>`; const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `DAY${dayIndex + 1}_${dayDataToSave.date}_일정.html`; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href); showToastMessage(`DAY ${dayIndex + 1} 일정이 HTML 파일로 저장되었습니다.`); }
if (loadDayAtIndexHtmlInput) loadDayAtIndexHtmlInput.addEventListener('change', (event) => { const file = event.target.files[0]; if (file && insertDayAtIndex !== -1 && insertDayAtIndex < tripData.days.length) { const reader = new FileReader(); reader.onload = (e) => { try { const doc = new DOMParser().parseFromString(e.target.result, "text/html"); const embeddedDataElement = doc.getElementById('embeddedTripDayData'); if (embeddedDataElement && embeddedDataElement.textContent) { const loadedDayData = JSON.parse(embeddedDataElement.textContent); if (loadedDayData && loadedDayData.date && isValidDateString(loadedDayData.date) && Array.isArray(loadedDayData.activities)) { tripData.days[insertDayAtIndex] = {...loadedDayData, id: loadedDayData.id || generateId(), isCollapsed: false, editingDate: false}; recalculateAllDates(); renderTrip(); showToastMessage(`DAY ${insertDayAtIndex + 1} 일정을 불러온 내용으로 덮어썼습니다.`); } else { throw new Error('유효하지 않은 날짜 데이터 형식입니다.'); } } else { throw new Error('HTML 파일에서 날짜 데이터를 찾을 수 없습니다.'); } } catch (err) { showToastMessage(`오류: ${err.message}`, true); } finally { if(loadDayAtIndexHtmlInput) loadDayAtIndexHtmlInput.value = null; insertDayAtIndex = -1; } }; reader.readAsText(file); } else { if(loadDayAtIndexHtmlInput) loadDayAtIndexHtmlInput.value = null; insertDayAtIndex = -1; } });

// --- 인라인 스타일 HTML 생성 및 표시 ---
function handleInlinePreview() { const inlineHtml = generateInlineStyledHTML(tripData, { includeStyles: true, makePageTitleEmptyForCopy: false }); const previewWindow = window.open('', '_blank'); if (previewWindow) { previewWindow.document.write(inlineHtml); previewWindow.document.close(); } else { showToastMessage("팝업이 차단되었을 수 있습니다.", true); }}
function formatDateForInlineView(dateString, dayNumber) { const date = new Date(dateString + "T00:00:00Z"); const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }; return `DAY ${dayNumber}: ${date.toLocaleDateString('ko-KR', options)}`; }
async function handleCopyInlineHtml() { const inlineHtml = generateInlineStyledHTML(tripData, { includeStyles: false, makePageTitleEmptyForCopy: true }); try { const blobHtml = new Blob([inlineHtml], { type: 'text/html' }); const blobText = new Blob([inlineHtml], { type: 'text/plain' }); await navigator.clipboard.write([new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })]); showToastMessage('인라인 코드가 HTML 형식으로 복사되었습니다.'); } catch (err) { try { await navigator.clipboard.writeText(inlineHtml); showToastMessage('인라인 코드가 일반 텍스트로 복사되었습니다 (HTML 형식 복사 실패).'); } catch (fallbackErr) { showToastMessage('클립보드 복사에 최종적으로 실패했습니다.', true); } } }
function generateInlineStyledHTML(data, options = { includeStyles: true, makePageTitleEmptyForCopy: false }) {
    let daysHTML = ''; const dataForInlineView = JSON.parse(JSON.stringify(data)); if (!dataForInlineView.days) dataForInlineView.days = [];
    dataForInlineView.days.forEach((day, dayIndex) => {
        let activitiesHTML = (day.activities || []).map(activity => {
            const imageDetailHTML = activity.imageUrl ? `<details open class="image-details" style="margin-top: 8px;"><summary class="custom-marker-image" style="font-size: 12px; color: #007bff; text-decoration: none; cursor: pointer; display: inline-block;">🖼️ 사진 접기</summary><img src="${activity.imageUrl}" alt="${activity.title || '활동 이미지'}" style="max-width: 300px; height: auto; object-fit: cover; border-radius: 4px; margin-top: 8px; display: block;" onerror="this.style.display='none';"></details>`:'';
            const locationHTML = activity.locationLink ? `<div class="card-location" style="font-size: 12px; margin-top: 4px;">📍 <a href="${activity.locationLink}" target="_blank" rel="noopener noreferrer" style="color: #007bff; text-decoration: none;">위치 보기</a></div>` : '';
            const costHTML = activity.cost ? `<div class="card-cost" style="font-size: 12px; margin-top: 4px;">💰 ${activity.cost}</div>` : '';
            const notesHTML = activity.notes ? `<div class="card-notes" style="font-size: 12px; margin-top: 4px; white-space: pre-wrap;">📝 ${activity.notes.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</div>` : '';
            const descriptionHTML = activity.description ? `<div class="card-description" style="font-size: 12px; white-space: pre-wrap;">${activity.description.replace(/\n/g, '<br>')}</div>` : '';
            return `<div class="readonly-activity-card" style="background-color: white; border-radius: 8px; border: 1px solid #E0E0E0; padding: 16px; margin-bottom: 16px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); display: flex;"><div class="card-time-icon-area" style="width: 100px; flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-start;"><div class="card-icon" style="font-size: 20px; margin-bottom: 4px;">${activity.icon || ' '}</div><div class="card-time" style="font-size: 12px; font-weight: bold; min-height: 18px;">${formatTimeToHHMM(activity.time) || ' '}</div></div><div class="card-details-area" style="flex-grow: 1; display: flex; flex-direction: column; gap: 4px;"><div class="card-title" style="font-size: 13px; font-weight: bold;">${activity.title || ''}</div>${descriptionHTML}${imageDetailHTML}${locationHTML}${costHTML}${notesHTML}</div></div>`;
        }).join('');
        daysHTML += `<div class="day-section" style="margin-bottom: 16px; border-radius: 0.375rem; background-color: #ffffff; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);"><details ${day.isCollapsed ? '' : 'open'}><summary class="custom-marker" style="display: flex; align-items: center; padding: 12px 8px; border-bottom: 1px solid #EEE; background-color: #fdfdfd; border-radius: 6px 6px 0 0; cursor: pointer;"><h2 class="day-header-title" style="font-size: 14px; font-weight: 600;">${formatDateForInlineView(day.date, dayIndex + 1)}</h2></summary><div class="day-content-wrapper" style="padding: 0 8px 8px 8px;"><div class="activities-list" style="padding-top: 0.75rem;">${activitiesHTML || '<p style="font-size:12px; color: #777; padding: 10px 0;">이 날짜에는 아직 등록된 일정이 없습니다.</p>'}</div></div></details></div>`;
    });
    const definedStyles = `body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; margin: 0; background-color: #f8f9fa; color: #212529;} main { max-width: 768px; margin-left: auto; margin-right: auto; padding: 1rem; } header { background-color: white; border-bottom: 1px solid #E0E0E0; padding: 1rem; text-align: center; } header h1 { font-size: 16px; font-weight: bold; margin: 0; } summary { list-style: none; } summary::-webkit-details-marker { display: none; } summary.custom-marker { position: relative; } summary.custom-marker::before { content: '▶'; font-size: 0.8em; margin-right: 8px; display: inline-block; width: 1em; text-align: center; color: #555; transition: transform 0.2s ease-in-out; } details[open] > summary.custom-marker::before { content: '▼'; }`;
    let styleTagHTML = options.includeStyles ? `<style>${definedStyles}</style>` : '';
    const pageDocumentTitle = options.makePageTitleEmptyForCopy ? ' ' : (dataForInlineView.title || "여행 일정");
    return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${pageDocumentTitle}</title>${styleTagHTML}</head><body><header><h1>${(dataForInlineView.title || "여행 일정")}</h1></header><main><div id="daysContainerReadOnly">${daysHTML || '<p style="text-align:center; padding: 20px; color: #777;">여행 일정이 없습니다.</p>'}</div></main></body></html>`;
}

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    if (activityIconSelect) { populateIconDropdown(); }
    if (copyInlineHtmlButton) { copyInlineHtmlButton.addEventListener('click', handleCopyInlineHtml); }
    if (inlinePreviewButton) { inlinePreviewButton.addEventListener('click', handleInlinePreview); }
    if (daysContainer) {
        daysContainer.addEventListener('dblclick', function(event) {
            const clickedCard = event.target.closest('.activity-card');
            if (clickedCard) {
                const activityId = clickedCard.dataset.activityId;
                const activitiesListElement = clickedCard.closest('.activities-list');
                if (activitiesListElement) {
                    const dayIndex = activitiesListElement.dataset.dayIndex;
                    if (dayIndex !== undefined && activityId !== undefined) {
                        populateAndOpenEditActivityModal(dayIndex, activityId);
                    }
                }
            }
        });
    }

    // DB 불러오기 버튼 설정
    if (loadHtmlButtonTrigger) {
        loadHtmlButtonTrigger.addEventListener('click', loadTripListFromFirestore);
    }
    
    if (cancelLoadTripModalButton && loadTripModal) {
        cancelLoadTripModalButton.addEventListener('click', () => {
            loadTripModal.classList.add('hidden');
        });
    }

    if (tripSearchInput) {
        tripSearchInput.addEventListener('input', renderFilteredTripList);
    }
    
    renderTrip();
});