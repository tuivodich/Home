import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

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

// Chỉ dùng khi chạy thử cục bộ với Firebase Emulator (VITE_USE_EMULATOR=1); bản deploy không bật.
if (import.meta.env.VITE_USE_EMULATOR) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8089);
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}
