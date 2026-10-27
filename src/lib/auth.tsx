import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type User,
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
  logout: () => Promise<void>;
}
const Ctx = createContext<AuthState>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); if (!u) { setProfile(null); setLoading(false); } }), []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "users", user.uid), (s) => {
      setProfile(s.exists() ? (s.data() as UserDoc) : null);
      setLoading(false);
    }, () => setLoading(false));
  }, [user]);

  const login = async (email: string, pw: string) => { await signInWithEmailAndPassword(auth, email, pw); };

  const register = async (email: string, pw: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    const uid = cred.user.uid;
    const boot = await getDoc(doc(db, "meta", "bootstrap"));
    if (!boot.exists()) {
      // Người đầu tiên → chủ homestay. Rules kiểm tra bootstrap chưa tồn tại.
      const b = writeBatch(db);
      b.set(doc(db, "meta", "bootstrap"), { uid, createdAt: serverTimestamp() });
      b.set(doc(db, "users", uid), { email, role: "owner" });
      try { await b.commit(); return; } catch { /* có người khác nhanh hơn → chờ duyệt */ }
    }
    await setDoc(doc(db, "users", uid), { email, role: "pending" });
  };

  return (
    <Ctx.Provider value={{ user, profile, loading, login, register, logout: () => signOut(auth) }}>
      {children}
    </Ctx.Provider>
  );
}
export const useAuth = () => useContext(Ctx);
