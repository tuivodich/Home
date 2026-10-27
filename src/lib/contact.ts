import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

/** Thông tin liên hệ công khai (settings/contact): chủ/quản lý sửa ở Cài đặt; website và bot Telegram cùng đọc. */
export interface Contact { phone: string; zalo: string; email: string; address: string; facebook: string; mapUrl: string }
export const CONTACT_FIELDS: (keyof Contact)[] = ["phone", "zalo", "email", "address", "facebook", "mapUrl"];
export const EMPTY_CONTACT: Contact = { phone: "", zalo: "", email: "", address: "", facebook: "", mapUrl: "" };

export function parseContact(data: Record<string, unknown> | undefined): Contact {
  const out = { ...EMPTY_CONTACT };
  for (const k of CONTACT_FIELDS) if (typeof data?.[k] === "string") out[k] = (data[k] as string).trim();
  return out;
}

/** Chỉ cho đường dẫn http/https (chặn javascript:… trong các ô đường dẫn). */
export const safeUrl = (s: string): string | undefined => (/^https?:\/\//i.test(s.trim()) ? s.trim() : undefined);
export const isUrlOk = (s: string) => !s.trim() || /^https?:\/\/\S+$/i.test(s.trim());
export const zaloHref = (s: string): string | undefined => {
  if (!s) return undefined;
  if (safeUrl(s)) return safeUrl(s);
  const d = s.replace(/\D/g, "");
  return d ? `https://zalo.me/${d}` : undefined;
};

export function useContact(): Contact {
  const [c, setC] = useState<Contact>(EMPTY_CONTACT);
  useEffect(() => onSnapshot(doc(db, "settings", "contact"), (s) => setC(parseContact(s.data())), () => {}), []);
  return c;
}
