import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

/** Thông tin liên hệ công khai (settings/contact): chủ/quản lý sửa ở Cài đặt; website và bot Telegram cùng đọc. */
export interface Contact { phone: string; zalo: string; email: string; address: string; facebook: string; mapUrl: string; coords: string }
export const CONTACT_FIELDS: (keyof Contact)[] = ["phone", "zalo", "email", "address", "facebook", "mapUrl", "coords"];
export const EMPTY_CONTACT: Contact = { phone: "", zalo: "", email: "", address: "", facebook: "", mapUrl: "", coords: "" };

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

/** Tọa độ "vĩ độ, kinh độ" hợp lệ (vd 11.9404, 108.4583) hoặc null. */
export function parseCoords(s: string): { lat: number; lng: number } | null {
  const m = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/.exec(s);
  if (!m) return null;
  const lat = +m[1], lng = +m[2];
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** Vị trí homestay cho bản đồ nhúng: ưu tiên ô tọa độ, rồi tọa độ có sẵn trong đường dẫn bản đồ dài (…@lat,lng… / !3d…!4d… / ?q=lat,lng). Link rút gọn (maps.app.goo.gl) không chứa tọa độ. */
export function mapPoint(c: Pick<Contact, "coords" | "mapUrl">): { lat: number; lng: number } | null {
  const direct = parseCoords(c.coords);
  if (direct) return direct;
  const u = c.mapUrl;
  const m = /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/.exec(u) ?? /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/.exec(u) ?? /[?&](?:q|ll|query|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/i.exec(u);
  return m ? parseCoords(`${m[1]},${m[2]}`) : null;
}

export function useContact(): Contact {
  const [c, setC] = useState<Contact>(EMPTY_CONTACT);
  useEffect(() => onSnapshot(doc(db, "settings", "contact"), (s) => setC(parseContact(s.data())), () => {}), []);
  return c;
}
