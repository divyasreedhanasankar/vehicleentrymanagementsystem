// =============================================
// Firebase Configuration & Initialization
// =============================================

const firebaseConfig = {
  apiKey: "AIzaSyA5VTue1DnuKatnQmVL2Np8D4Gl80Ga8nY",
  authDomain: "vehicle-entry-registration.firebaseapp.com",
  projectId: "vehicle-entry-registration",
  storageBucket: "vehicle-entry-registration.firebasestorage.app",
  messagingSenderId: "844082778926",
  appId: "1:844082778926:web:df00c68e1cd8e65a8b60bf",
  measurementId: "G-6VYV3JY06S"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db  = firebase.firestore();
const storage = firebase.storage();

// Enable Firestore offline persistence (optional, helps with reliability)
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore persistence: multiple tabs open');
  } else if (err.code === 'unimplemented') {
    console.warn('Firestore persistence: not supported in this browser');
  }
});
