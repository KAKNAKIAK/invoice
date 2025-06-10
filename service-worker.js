// [수정] 캐시 이름을 변경하여 새로운 버전임을 명시합니다. (v1 -> v2)
const CACHE_NAME = 'quote-calculator-cache-v2';

// 캐시할 파일 목록은 동일합니다.
const FILES_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './script.js',
  './gds_parser/gds_parser.html',
  './hotel_maker/index.html',
  './hotel_maker/style.css',
  './hotel_maker/script.js',
  './itinerary_planner/index.html',
  './itinerary_planner/style.css',
  './itinerary_planner/script.js',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// 서비스 워커 설치 이벤트
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('새로운 버전의 파일 캐싱 완료');
        return cache.addAll(FILES_TO_CACHE);
      })
      .then(() => {
        // [신규] 새로운 서비스 워커가 설치되면 즉시 활성화되도록 합니다.
        return self.skipWaiting();
      })
  );
});

// [신규] 서비스 워커 활성화 및 이전 캐시 정리 이벤트
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        // 현재 캐시 이름(CACHE_NAME)과 다른 모든 이전 버전의 캐시를 삭제합니다.
        if (key !== CACHE_NAME) {
          console.log('이전 버전 캐시 삭제:', key);
          return caches.delete(key);
        }
      }));
    }).then(() => {
      // [신규] 활성화된 서비스 워커가 페이지를 즉시 제어하도록 합니다.
      return self.clients.claim();
    })
  );
});


// 요청에 대한 응답 처리 (캐시 우선 전략)
self.addEventListener('fetch', (event) => {
  // GET 요청에 대해서만 캐시 전략을 사용합니다.
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 캐시에 응답이 있으면 그것을 반환하고, 없으면 네트워크로 요청
        return response || fetch(event.request);
      })
  );
});
