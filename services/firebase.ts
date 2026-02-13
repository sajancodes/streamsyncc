
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyBlFk2TjG9MB2a0GrIrJNXfWFM-OBxNYTs",
  authDomain: "streamm-1e286.firebaseapp.com",
  projectId: "streamm-1e286",
  storageBucket: "streamm-1e286.firebasestorage.app",
  messagingSenderId: "753097074535",
  appId: "1:753097074535:web:4d9d6ece17dc7f285d71c2",
  measurementId: "G-026ZVBZ2D7"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize and Export Firestore
// Correctly obtain firestore instance from the initialized app for modular SDK usage
export const db = getFirestore(app);

// Initialize Analytics (browser-only)
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
