/* global self, clients */
/* Firebase compat libs for SW */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

/* --- Firebase config (same as your web app) --- */
firebase.initializeApp({
  apiKey: "AIzaSyAn2vBZpmDcZlssIyOr5ApWgy2uK344nmw",
  authDomain: "dct-supportlink.firebaseapp.com",
  projectId: "dct-supportlink",
  storageBucket: "dct-supportlink.firebasestorage.app",
  messagingSenderId: "517961716843",
  appId: "1:517961716843:web:70835e80b97d1bea5ccd2e",
});

const messaging = firebase.messaging();

/**
 * Show a notification while the app is in the background.
 * (This is only used if you later send FCM push payloads with notification fields.)
 */
messaging.onBackgroundMessage((payload) => {
  const n = payload?.notification || {};
  const title = n.title || "New Asset Request";
  const body = n.body || "Open to review the request.";
  const image = n.image;

  const options = {
    body,
    // Use an icon you actually have in /public (your project has logo192.png)
    icon: "/logo192.png",
    image,
    data: payload?.data || {},
    tag: payload?.data?.requestId ? `asset-request-${payload.data.requestId}` : undefined,
    renotify: false,
  };

  self.registration.showNotification(title, options);
});

/**
 * When a user clicks a notification, focus an existing tab if possible.
 * If there isn't one, open the custodian page.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Focus the first existing client
      for (const w of wins) {
        if ("focus" in w) return w.focus();
      }
      // No open tabs: open the custodian dashboard
      return clients.openWindow("/custodian");
    })
  );
});

/* Optional niceties */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
