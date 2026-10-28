/* Service worker nhận thông báo đẩy (Firebase Cloud Messaging) cho nhân viên. Tải tại /sw.js. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let p = {};
  try { p = event.data ? event.data.json() : {}; } catch { p = {}; }
  const d = p.data || p;
  const n = p.notification || {};
  const title = n.title || d.title || "Nhà Gỗ Homestay";
  const body = n.body || d.body || "";
  event.waitUntil(self.registration.showNotification(title, {
    body, icon: "/icon-192.png", badge: "/favicon-32.png", tag: d.tag || "nhago", renotify: true, data: { url: d.url || "/app" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/app", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.startsWith(self.location.origin) && "focus" in c) { c.navigate(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
