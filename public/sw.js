// 极简 service worker：满足 PWA 可安装条件，网络请求照常走（不做离线缓存）
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
