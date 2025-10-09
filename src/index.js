import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Register the Firebase Messaging service worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/firebase-messaging-sw.js")
    .then(() => console.log("✅ Firebase messaging service worker registered"))
    .catch((err) => console.error("❌ SW registration failed:", err));
}


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

