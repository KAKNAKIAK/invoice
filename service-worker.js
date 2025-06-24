// service-worker.js ('Network First' 전략 적용)

// 캐시 이름은 그대로 유지하거나, 큰 구조 변경 시 버전을 올릴 수 있습니다.
const CACHE_NAME = 'quote-calculator-cache-v2';

// 캐시할 파일 목록 (기존과 동일)
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

// install 이벤트: 앱 설치 시 핵심 파일들을 캐시에 저장합니다. (변경 없음)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(FILES_TO_CACHE);
      })
  );
});

// activate 이벤트: 이전 버전의 캐시를 정리합니다. (변경 없음)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('Service Worker: Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// [수정] fetch 이벤트: 'Network First' 전략으로 변경
self.addEventListener('fetch', (event) => {
  event.respondWith(
    // 항상 네트워크에 먼저 요청을 보냅니다.
    fetch(event.request)
      .then(response => {
        // 네트워크 요청이 성공하면, 응답을 복제하여 캐시에 저장(업데이트)합니다.
        // 응답 스트림은 한 번만 사용할 수 있으므로, 복제본을 캐시에 넣어야 합니다.
        return caches.open(CACHE_NAME).then(cache => {
          console.log('Service Worker: Fetched from network and caching new version for ' + event.request.url);
          cache.put(event.request, response.clone());
          // 원본 응답을 브라우저에 반환합니다.
          return response;
        });
      })
      .catch(() => {
        // 네트워크 요청이 실패하면(오프라인 상태 등), 캐시에서 일치하는 항목을 찾아서 반환합니다.
        console.log('Service Worker: Network request failed. Serving from cache: ' + event.request.url);
        return caches.match(event.request);
      })
  );
});
