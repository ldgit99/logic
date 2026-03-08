/**
 * sw.js — Service Worker (오프라인 캐싱)
 * 정적 자산을 캐시하여 오프라인 또는 느린 네트워크에서도 앱이 실행되도록 함.
 */

const CACHE_NAME = 'logic-circuit-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './css/layout.css',
  './css/sidebar.css',
  './css/content.css',
  './css/chatbot.css',
  './css/modal.css',
  './js/main.js',
  './chapters/index.json',
];

// 설치: 핵심 자산 사전 캐시
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// 활성화: 이전 캐시 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 네트워크 요청 가로채기: 네트워크 우선, 실패 시 캐시
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Worker API 및 외부 리소스는 캐싱하지 않음
  if (
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('openai.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('resend.com') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 정상 응답은 캐시에 저장
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
