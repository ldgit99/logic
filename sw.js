/**
 * sw.js — Service Worker (오프라인 캐싱 + 자동 업데이트 알림)
 *
 * 배포 시 CACHE_VERSION 날짜만 변경하면:
 *  1. 브라우저가 sw.js 변경 감지 → 새 SW 설치
 *  2. 구 캐시 자동 삭제
 *  3. 모든 열린 탭에 SW_UPDATED 메시지 → 업데이트 토스트 표시
 *
 * ⚠️ 배포할 때마다 아래 날짜를 갱신하세요.
 */
const CACHE_VERSION = '20260309d';
const CACHE_NAME = `logic-circuit-v${CACHE_VERSION}`;

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

// ── 설치: 핵심 자산 사전 캐시 ──────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {}) // 사전 캐시 실패해도 SW 설치 계속
  );
  // 구 SW를 즉시 교체 (waitForActivate 없이 바로 활성화)
  self.skipWaiting();
});

// ── 활성화: 구 캐시 삭제 + 클라이언트에 업데이트 알림 ───────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
      .then(() => {
        // 모든 열린 탭에 업데이트 알림 전송
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) =>
            client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION })
          );
        });
      })
  );
});

// ── fetch: 네트워크 우선, 실패 시 캐시 폴백 ────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 외부 API / non-GET 요청은 SW가 가로채지 않음
  if (
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('openai.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('resend.com') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
