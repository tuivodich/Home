import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signOut, type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc, writeBatch, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { UserDoc } from "./types";

interface AuthState {
  user: User | null;
  profile: UserDoc | null;
  loading: boolean;
  login: (email: string, pw: string) => Promise<void>;
  register: (email: string, pw: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthState>(null!);

/** Tạo hồ sơ lần đầu: người đầu tiên của hệ thống là Chủ, còn lại là khách hàng. */
async function ensureProfile(u: User) {
  const ref = doc(db, "users", u.uid);
  if ((await getDoc(ref)).exists()) return;
  const base = { email: u.email ?? "", name: u.displayName ?? "" };
  const boot = await getDoc(doc(db, "meta", "bootstrap"));
  if (!boot.exists()) {
    const b = writeBatch(db);
    b.set(doc(db, "meta", "bootstrap"), { uid: u.uid, createdAt: serverTimestamp() });
    b.set(ref, { ...base, role: "owner" });
    try { await b.commit(); return; } catch { /* có người khác nhanh hơn → làm khách hàng */ }
  }
  await setDoc(ref, { ...base, role: "customer" });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const creating = useRef(false);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); if (!u) { setProfile(null); setLoading(false); } }), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid), (s) => {
      if (s.exists()) { setProfile(s.data() as UserDoc); setLoading(false); return; }
      setProfile(null);
      if (!creating.current) {
        creating.current = true;
        ensureProfile(user).catch((e) => console.error("ensureProfile", e)).finally(() => { creating.current = false; setLoading(false); });
      }
    }, () => setLoading(false));
  }, [user]);

  const login = async (email: string, pw: string) => { await signInWithEmailAndPassword(auth, email, pw); };
  const register = async (email: string, pw: string) => { await createUserWithEmailAndPassword(auth, email, pw); };
  const loginGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  };

  return (
    <Ctx.Provider value={{ user, profile, loading, login, register, loginGoogle, logout: () => signOut(auth) }}>
      {children}
    </Ctx.Provider>
  );
}
export const useAuth = () => useContext(Ctx);
