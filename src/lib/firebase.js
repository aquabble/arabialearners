// src/lib/firebase.js
// Initialize Firebase once, using Vite env vars.
// Make sure you set these in .env.local (dev) and Vercel env (prod).
// VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_APP_ID
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // optional (set if you have them)
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
};

// Guard against missing config (helps when .env not loaded)
for (const [k, v] of Object.entries(cfg)) {
  if (typeof v === 'undefined') {
    // leave as undefined; Firebase SDK tolerates missing optional fields
  }
}

const app = getApps().length ? getApp() : initializeApp(cfg);
const auth = getAuth(app);

// Persist across reloads (local tab)
setPersistence(auth, browserLocalPersistence).catch(() => {});

export { app, auth };
