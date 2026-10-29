import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Guest } from "./types";

/** Hồ sơ cá nhân của tài khoản (profiles/{uid}): điền sẵn khi đặt phòng; chính chủ sửa, hoặc chủ trang web sửa hộ. */
export interface Profile {
  fullName: string; docType: Guest["docType"]; docNumber: string; nationality: string; dob: string; phone: string; email: string;
}
export const EMPTY_PROFILE: Profile = { fullName: "", docType: "cccd", docNumber: "", nationality: "Vietnam", dob: "", phone: "", email: "" };

export function parseProfile(d: Record<string, unknown> | undefined): Profile {
  const s = (k: keyof Profile) => (typeof d?.[k] === "string" ? (d[k] as string) : EMPTY_PROFILE[k]);
  const dt = s("docType");
  return {
    fullName: s("fullName"), docType: (["cccd", "passport", "license", "other"].includes(dt) ? dt : "cccd") as Profile["docType"],
    docNumber: s("docNumber"), nationality: s("nationality"), dob: s("dob"), phone: s("phone"), email: s("email"),
  };
}

/** Nghe hồ sơ của một tài khoản; `undefined` khi chưa đăng nhập, `loading` đến khi đọc xong. */
export function useProfileDoc(uid?: string) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(!!uid);
  useEffect(() => {
    if (!uid) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    return onSnapshot(doc(db, "profiles", uid), (s) => { setProfile(s.exists() ? parseProfile(s.data()) : null); setLoading(false); }, () => setLoading(false));
  }, [uid]);
  return { profile, loading };
}

export const saveProfile = (uid: string, p: Profile) =>
  setDoc(doc(db, "profiles", uid), {
    fullName: p.fullName.trim(), docType: p.docType, docNumber: p.docNumber.trim(), nationality: p.nationality.trim(),
    dob: p.dob, phone: p.phone.trim(), email: p.email.trim(), updatedAt: serverTimestamp(),
  });
