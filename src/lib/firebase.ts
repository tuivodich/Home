import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Cấu hình web của Firebase không phải bí mật; bảo mật do Firestore/Storage rules đảm nhiệm.
const firebaseConfig = {
  apiKey: "AIzaSyD1R-6mdV6KQaBv87TWDhE6iNvb29H27rI",
  authDomain: "sisterhome.firebaseapp.com",
  projectId: "sisterhome",
  storageBucket: "sisterhome.firebasestorage.app",
  messagingSenderId: "985898210501",
  appId: "1:985898210501:web:e354c9bea2824b06464cac",
  measurementId: "G-5JB6G5KKPE",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
