// LifeOS Mobile Service Worker
const CACHE_NAME = "lifeos-mobile-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./mobile.css",
  "./mobile.js",
  "./manifest.json"
];

self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e) {
  if (e.request.method !== "GET") return;
  // 网络优先，失败退到缓存
  e.respondWith(
    fetch(e.request).then(function(res) {
      // 同源请求才缓存
      try {
        const url = new URL(e.request.url);
        if (url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(e.request, clone);
          });
        }
      } catch (err) {}
      return res;
    }).catch(function() {
      return caches.match(e.request).then(function(cached) {
        if (cached) return cached;
        // 主页兜底
        if (e.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
