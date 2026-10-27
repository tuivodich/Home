import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { DEFAULT_FAQ, DEFAULT_PRIVACY, type FaqItem } from "./defaultContent";

export interface PrivacyDoc { vi: string; en: string; updatedAt?: { seconds: number } }
export interface FaqDoc { items: FaqItem[]; updatedAt?: { seconds: number } }

/** Đọc tài liệu nội dung `pages/<id>` (công khai); `null` khi chủ/quản lý chưa sửa lần nào. */
export function usePage<T>(id: "privacy" | "faq") {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => onSnapshot(doc(db, "pages", id), (s) => {
    setData(s.exists() ? (s.data() as T) : null);
    setLoading(false);
  }, () => setLoading(false)), [id]);
  return { data, loading };
}

export const usePrivacy = () => {
  const { data, loading } = usePage<PrivacyDoc>("privacy");
  return { loading, doc: { vi: data?.vi ?? DEFAULT_PRIVACY.vi, en: data?.en ?? DEFAULT_PRIVACY.en, updatedAt: data?.updatedAt }, custom: !!data };
};

export const useFaq = () => {
  const { data, loading } = usePage<FaqDoc>("faq");
  return { loading, items: data?.items ?? DEFAULT_FAQ, updatedAt: data?.updatedAt, custom: !!data };
};

export const savePrivacy = (v: { vi: string; en: string }) =>
  setDoc(doc(db, "pages", "privacy"), { vi: v.vi, en: v.en, updatedAt: serverTimestamp() });

export const saveFaq = (items: FaqItem[]) =>
  setDoc(doc(db, "pages", "faq"), { items, updatedAt: serverTimestamp() });

export const fmtDate = (ts?: { seconds: number }, lang: "vi" | "en" = "vi") =>
  ts ? new Date(ts.seconds * 1000).toLocaleDateString("en-GB") : "";
