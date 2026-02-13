import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBlFk2TjG9MB2a0GrIrJNXfWFM-OBxNYTs",
  authDomain: "streamm-1e286.firebaseapp.com",
  projectId: "streamm-1e286",
  storageBucket: "streamm-1e286.firebasestorage.app",
  messagingSenderId: "753097074535",
  appId: "1:753097074535:web:4d9d6ece17dc7f285d71c2",
  measurementId: "G-026ZVBZ2D7"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const rtdb = getDatabase(app);
