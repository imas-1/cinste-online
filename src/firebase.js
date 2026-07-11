import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyA3Rf-lKEvqgX9qm6y0xHyGs0jBM4k69Bo",
  authDomain: "cinste-5e134.firebaseapp.com",
  projectId: "cinste-5e134",
  storageBucket: "cinste-5e134.firebasestorage.app",
  messagingSenderId: "731841447336",
  appId: "1:731841447336:web:4e69f5b6005001b77d499d",
  databaseURL: "https://cinste-5e134-default-rtdb.europe-west1.firebasedatabase.app/",
};

// cheia publică (VAPID) generată în Firebase Console → Cloud Messaging → Web Push certificates
export const VAPID_KEY = "BJ3LRSyaynrmUTShz6ENk2Ao6Yjvh90DIh5YWfCk2GU";

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function getMessagingIfSupported() {
  try {
    const supported = await isSupported();
    return supported ? getMessaging(app) : null;
  } catch (e) {
    return null;
  }
}
