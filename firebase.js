const firebaseConfig = {
  apiKey: "AIzaSyA1a2C_iAq6qvPiQg4wvQW9w2goJ0v1b-U",
  authDomain: "double-hutch-sale.firebaseapp.com",
  projectId: "double-hutch-sale",
  storageBucket: "double-hutch-sale.firebasestorage.app",
  messagingSenderId: "589519563354",
  appId: "1:589519563354:web:e3a4c3f2dc953bb5ec0663"
};

const ADMIN_EMAILS = [
  "amandaciaralee@gmail.com",
  "k.hutch.2026@gmail.com"
];

try {
  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);
  window.DoubleHutchCloud = {
    ready: true,
    auth,
    db,
    serverTimestamp: firebase.firestore.FieldValue.serverTimestamp,
    adminEmails: ADMIN_EMAILS,
    isAdminEmail(email) {
      return ADMIN_EMAILS.includes(String(email || "").toLowerCase());
    }
  };
} catch (error) {
  console.error("Firebase initialization failed", error);
  window.DoubleHutchCloud = { ready: false, error };
}
