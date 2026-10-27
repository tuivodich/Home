import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import type { Coupon } from "./types";

export type CouponCheck =
  | { ok: true; code: string; percent: number }
  | { ok: false; reason: "notfound" | "used" | "expired" };

const CODE_RE = /^[A-Z0-9-]{3,32}$/;

/** Kiểm tra một mã giảm giá (chỉ đọc đúng mã được nhập, không liệt kê được các mã khác). */
export async function checkCoupon(raw: string): Promise<CouponCheck> {
  const code = raw.trim().toUpperCase();
  if (!CODE_RE.test(code)) return { ok: false, reason: "notfound" };
  try {
    const snap = await getDoc(doc(db, "coupons", code));
    if (!snap.exists()) return { ok: false, reason: "notfound" };
    const d = snap.data() as Coupon;
    if (d.used) return { ok: false, reason: "used" };
    if (d.expiresAt && d.expiresAt.toMillis() < Date.now()) return { ok: false, reason: "expired" };
    return { ok: true, code, percent: d.percent };
  } catch {
    return { ok: false, reason: "notfound" };
  }
}

export const discounted = (price: number, percent: number) => Math.round(price * (100 - percent) / 100);
