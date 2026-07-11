importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA3Rf-lKEvqgX9qm6y0xHyGs0jBM4k69Bo",
  authDomain: "cinste-5e134.firebaseapp.com",
  projectId: "cinste-5e134",
  storageBucket: "cinste-5e134.firebasestorage.app",
  messagingSenderId: "731841447336",
  appId: "1:731841447336:web:4e69f5b6005001b77d499d",
  databaseURL: "https://cinste-5e134-default-rtdb.europe-west1.firebasedatabase.app/",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Caietul de cinste";
  const body = payload.notification?.body || "";
  self.registration.showNotification(title, {
    body,
    icon: "/icon.svg",
    badge: "/icon.svg",
  });
});
