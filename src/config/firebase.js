// src/config/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";

// --- Firebase configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAn2vBZpmDcZlssIyOr5ApWgy2uK344nmw",
  authDomain: "dct-supportlink.firebaseapp.com",
  projectId: "dct-supportlink",
  storageBucket: "dct-supportlink.firebasestorage.app",
  messagingSenderId: "517961716843",
  appId: "1:517961716843:web:70835e80b97d1bea5ccd2e",
  measurementId: "G-YHPXBPHZ2V",
};

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

// ======================================================
// 🔔 Firebase Cloud Messaging (FCM) Setup for Web Push
// ======================================================
export const messagingPromise = (async () => {
  const supported = await isSupported();
  return supported ? getMessaging(app) : null;
})();

/**
 * Ask the user for notification permission and return the FCM token.
 * (You can call this after login to save their token in Firestore.)
 */
export async function requestFcmToken(uid) {
  const messaging = await messagingPromise;
  if (!messaging) {
    console.warn("⚠️ FCM not supported on this browser");
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    console.warn("🚫 Notification permission denied");
    return null;
  }

 const vapidKey =
  "BFY4SVqvmtjc8eKtPySdgMM_0Zs_o5fbify0sg1yKR2bOtFn9QLcsq9ctsRkHHM5xvRODHih5tW6uoiIbrTMzfY";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

const token = await getToken(messaging, { vapidKey });


  console.log("✅ FCM token:", token);

  // Optional: save token to Firestore if user is logged in
  if (uid && token) {
    const ref = doc(db, "users", uid);
    await setDoc(ref, { fcmTokens: { [token]: true } }, { merge: true });
    console.log("💾 Token saved to Firestore for UID:", uid);
  }

  return token;
}

/**
 * Listen to foreground messages (only while tab is open).
 * Use this in your app to display notifications instantly.
 */
export async function onForegroundFcm(callback) {
  const messaging = await messagingPromise;
  if (!messaging) return () => {};
  return onMessage(messaging, callback);
}
