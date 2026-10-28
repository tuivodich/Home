import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import type { Booking } from "./types";

/** Hạng thành viên: tự thăng khi số lần ở (đặt phòng online đã trả phòng) đạt `minBookings`; chủ/quản lý có thể đặt tay. */
export interface Tier { id: string; name: string; color: string; minBookings: number; couponPercent: number }
export interface LoyaltyCfg { enabled: boolean; tiers: Tier[] }

export const DEFAULT_TIERS: Tier[] = [
  { id: "bronze", name: "Đồng", color: "#cd7f32", minBookings: 0, couponPercent: 0 },
  { id: "silver", name: "Bạc", color: "#b8c2cc", minBookings: 3, couponPercent: 5 },
  { id: "gold", name: "Vàng", color: "#f2b705", minBookings: 6, couponPercent: 8 },
  { id: "diamond", name: "Kim cương", color: "#5ec8f2", minBookings: 10, couponPercent: 12 },
];
export const DEFAULT_LOYALTY: LoyaltyCfg = { enabled: false, tiers: DEFAULT_TIERS };

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
export function parseLoyalty(d: Record<string, unknown> | undefined): LoyaltyCfg {
  if (!d) return DEFAULT_LOYALTY;
  const tiers = (Array.isArray(d.tiers) ? d.tiers : []).flatMap((x): Tier[] => {
    const t = x as Record<string, unknown>;
    return t && typeof t.id === "string" && typeof t.name === "string" && t.id && t.name
      ? [{ id: t.id, name: t.name, color: /^#[0-9a-fA-F]{6}$/.test(String(t.color)) ? String(t.color) : "#999999", minBookings: Math.max(0, Math.floor(num(t.minBookings))), couponPercent: Math.min(50, Math.max(0, num(t.couponPercent))) }]
      : [];
  }).sort((a, b) => a.minBookings - b.minBookings);
  return { enabled: d.enabled === true, tiers: tiers.length ? tiers : DEFAULT_TIERS };
}

/** Số lần ở của một khách: đặt phòng ONLINE đã trả phòng. */
export const completedStays = (bookings: Booking[], uid: string) => bookings.filter((b) => b.createdBy === uid && b.source === "online" && b.status === "checked_out").length;

/** Hạng hiện tại: hạng đặt tay (nếu còn tồn tại) hoặc hạng cao nhất đạt được theo số lần ở. */
export function tierFor(count: number, cfg: LoyaltyCfg, manualId?: string): Tier | null {
  if (!cfg.enabled || !cfg.tiers.length) return null;
  const manual = manualId ? cfg.tiers.find((t) => t.id === manualId) : undefined;
  if (manual) return manual;
  return [...cfg.tiers].reverse().find((t) => count >= t.minBookings) ?? cfg.tiers[0];
}
export const nextTier = (count: number, cfg: LoyaltyCfg, current: Tier | null): Tier | null => cfg.tiers.find((t) => t.minBookings > count && (!current || t.minBookings > current.minBookings)) ?? null;

export function useLoyaltyCfg() {
  const [cfg, setCfg] = useState<LoyaltyCfg>(DEFAULT_LOYALTY);
  const [loading, setLoading] = useState(true);
  useEffect(() => onSnapshot(doc(db, "settings", "loyalty"), (s) => { setCfg(s.exists() ? parseLoyalty(s.data()) : DEFAULT_LOYALTY); setLoading(false); }, () => setLoading(false)), []);
  return { cfg, loading };
}

export interface MemberDoc { id: string; tier?: string; claimed?: Record<string, string> }

/** Hạng của chính mình (tính từ đặt phòng của tôi + hạng đặt tay). */
export function useMyTier(uid?: string) {
  const { cfg } = useLoyaltyCfg();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [member, setMember] = useState<MemberDoc | null>(null);
  useEffect(() => {
    if (!uid) { setBookings([]); setMember(null); return; }
    const a = onSnapshot(query(collection(db, "bookings"), where("createdBy", "==", uid)), (s) => setBookings(s.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as Booking)), () => {});
    const b = onSnapshot(doc(db, "members", uid), (s) => setMember(s.exists() ? ({ ...(s.data() as object), id: s.id } as MemberDoc) : null), () => setMember(null));
    return () => { a(); b(); };
  }, [uid]);
  const count = useMemo(() => (uid ? completedStays(bookings, uid) : 0), [bookings, uid]);
  const tier = tierFor(count, cfg, member?.tier);
  return { cfg, count, tier, next: nextTier(count, cfg, tier), member };
}

/** Chữ trắng hay đen cho dễ đọc trên nền màu hạng. */
export function badgeText(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.6 ? "#2a2110" : "#ffffff";
}

/** Cho trang nhân viên: tra hạng của nhiều tài khoản từ danh sách đặt phòng (đã có sẵn) + hạng đặt tay. */
export function useTierLookup(bookings: Booking[], enabled = true) {
  const { cfg } = useLoyaltyCfg();
  const [members, setMembers] = useState<MemberDoc[]>([]);
  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(collection(db, "members"), (s) => setMembers(s.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as MemberDoc)), () => {});
  }, [enabled]);
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of bookings) if (b.createdBy && b.source === "online" && b.status === "checked_out") counts.set(b.createdBy, (counts.get(b.createdBy) ?? 0) + 1);
    return {
      cfg, members,
      count: (uid?: string) => (uid ? counts.get(uid) ?? 0 : 0),
      tierOf: (uid?: string): Tier | null => (uid ? tierFor(counts.get(uid) ?? 0, cfg, members.find((m) => m.id === uid)?.tier) : null),
    };
  }, [bookings, cfg, members]);
}
