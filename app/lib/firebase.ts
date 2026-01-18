import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA_QrvwV9STDLzjcse_vqNLYoLxqFV09ms",
  authDomain: "task-organizer-bb071.firebaseapp.com",
  projectId: "task-organizer-bb071",
  storageBucket: "task-organizer-bb071.firebasestorage.app",
  messagingSenderId: "522396818794",
  appId: "1:522396818794:web:44eda8517aee91cca4d913"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);