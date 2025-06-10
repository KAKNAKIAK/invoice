// 캐시 이름 정의
const CACHE_NAME = 'quote-calculator-cache-v1';
// 캐시할 파일 목록
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
        console.log('캐시 파일 저장 완료');
        return cache.addAll(FILES_TO_CACHE);
      })
  );
});

// 요청에 대한 응답 처리 (캐시 우선 전략)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // 캐시에 응답이 있으면 그것을 반환하고, 없으면 네트워크로 요청
        return response || fetch(event.request);
      })
  );
});
