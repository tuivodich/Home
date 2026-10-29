/**
 * Bảng giá, phụ thu, đặt cọc và chính sách hủy. Thuần tính toán (không phụ thuộc React/Firebase) để dùng chung
 * cho hộp thoại đặt phòng, trang quản trị, hóa đơn và kiểm thử.
 * Quy ước: giá mỗi đêm = giá phòng × (1 + %); % của đêm = ngày lễ (nếu có) hoặc (mùa + cuối tuần).
 * Mã giảm giá chỉ áp lên tiền ở (sau giảm ở dài ngày + phụ thu thêm khách), không áp lên dịch vụ/nhận sớm/trả muộn.
 */

export interface PriceRule { name: string; from: string; to: string; percent: number }
export interface LongStayRule { minNights: number; percent: number } // percent âm = giảm giá
export interface PricingCfg { weekendDays: number[]; weekendPercent: number; seasons: PriceRule[]; holidays: PriceRule[]; longStay: LongStayRule[] }
export interface CancelTier { daysBefore: number; refundPercent: number }
export interface ServiceDef { id: string; name: string; price: number; unit: "once" | "night"; active: boolean }
export interface BookingCfg {
  depositPercent: number; checkInTime: string; checkOutTime: string; cancelTiers: CancelTier[]; cancelNote: string;
  extraGuestFee: number; earlyCheckInFee: number; lateCheckOutFee: number; services: ServiceDef[];
}
export interface RoomPrice { price: number; capacity: number; baseGuests?: number }
/** Một dòng chi tiết giá: `label` tiếng Việt, `labelEn` tiếng Anh (đặt phòng cũ chỉ có tiếng Việt). */
export interface Line { label: string; labelEn?: string; amount: number }
/** Nhãn dòng theo ngôn ngữ đang xem (rơi về tiếng Việt nếu chưa có bản tiếng Anh). */
export const lineLabel = (l: Line, lang: string) => (lang === "en" && l.labelEn ? l.labelEn : l.label);

export const DEFAULT_PRICING: PricingCfg = { weekendDays: [5, 6], weekendPercent: 0, seasons: [], holidays: [], longStay: [] };
export const DEFAULT_BOOKING_CFG: BookingCfg = {
  depositPercent: 0, checkInTime: "14:00", checkOutTime: "12:00",
  cancelTiers: [{ daysBefore: 7, refundPercent: 100 }, { daysBefore: 3, refundPercent: 50 }, { daysBefore: 0, refundPercent: 0 }],
  cancelNote: "", extraGuestFee: 0, earlyCheckInFee: 0, lateCheckOutFee: 0, services: [],
};

const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const arr = <T>(v: unknown, f: (x: Record<string, unknown>) => T | null): T[] =>
  (Array.isArray(v) ? v : []).map((x) => (x && typeof x === "object" ? f(x as Record<string, unknown>) : null)).filter((x): x is T => x !== null);

export function parsePricing(d: Record<string, unknown> | undefined): PricingCfg {
  const rule = (x: Record<string, unknown>): PriceRule | null => (str(x.from) && str(x.to) ? { name: str(x.name), from: str(x.from), to: str(x.to), percent: num(x.percent) } : null);
  const days = Array.isArray(d?.weekendDays) ? (d!.weekendDays as unknown[]).filter((n): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= 6) : DEFAULT_PRICING.weekendDays;
  return {
    weekendDays: days, weekendPercent: num(d?.weekendPercent), seasons: arr(d?.seasons, rule), holidays: arr(d?.holidays, rule),
    longStay: arr(d?.longStay, (x) => (num(x.minNights) >= 2 ? { minNights: Math.floor(num(x.minNights)), percent: num(x.percent) } : null)).sort((a, b) => a.minNights - b.minNights),
  };
}

export function parseBookingCfg(d: Record<string, unknown> | undefined): BookingCfg {
  if (!d) return DEFAULT_BOOKING_CFG;
  const tiers = arr(d.cancelTiers, (x) => ({ daysBefore: Math.max(0, Math.floor(num(x.daysBefore))), refundPercent: Math.min(100, Math.max(0, num(x.refundPercent))) })).sort((a, b) => b.daysBefore - a.daysBefore);
  return {
    depositPercent: Math.min(100, Math.max(0, num(d.depositPercent, DEFAULT_BOOKING_CFG.depositPercent))),
    checkInTime: str(d.checkInTime, "14:00"), checkOutTime: str(d.checkOutTime, "12:00"),
    cancelTiers: tiers.length ? tiers : DEFAULT_BOOKING_CFG.cancelTiers, cancelNote: str(d.cancelNote),
    extraGuestFee: Math.max(0, num(d.extraGuestFee)), earlyCheckInFee: Math.max(0, num(d.earlyCheckInFee)), lateCheckOutFee: Math.max(0, num(d.lateCheckOutFee)),
    services: arr(d.services, (x) => (str(x.id) && str(x.name) ? { id: str(x.id), name: str(x.name), price: Math.max(0, num(x.price)), unit: x.unit === "night" ? "night" : "once", active: x.active !== false } : null)),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDay = (s: string, n: number) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return ymd(d); };
const dayOfWeek = (s: string) => new Date(`${s}T00:00:00`).getDay();
export const nightsOf = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000);
const roundK = (n: number) => Math.round(n / 1000) * 1000;
const inRange = (d: string, r: PriceRule) => r.from <= d && d <= r.to;

export interface Night { date: string; price: number; percent: number; tag: string }

/** Giá một đêm (ngày d = đêm bắt đầu từ ngày d). */
export function nightPrice(basePrice: number, d: string, cfg: PricingCfg): Night {
  const hol = cfg.holidays.filter((h) => inRange(d, h)).sort((a, b) => b.percent - a.percent)[0];
  let percent = 0, tag = "";
  if (hol) { percent = hol.percent; tag = hol.name || "holiday"; }
  else {
    const se = cfg.seasons.filter((s) => inRange(d, s)).sort((a, b) => b.percent - a.percent)[0];
    if (se) { percent += se.percent; tag = se.name || "season"; }
    if (cfg.weekendPercent && cfg.weekendDays.includes(dayOfWeek(d))) { percent += cfg.weekendPercent; tag = tag ? `${tag} + weekend` : "weekend"; }
  }
  return { date: d, percent, tag, price: percent ? roundK(basePrice * (1 + percent / 100)) : basePrice };
}

export interface QuoteOptions { early?: boolean; late?: boolean; services?: Record<string, number>; couponPercent?: number }
export interface Quote {
  nights: Night[]; nightsCount: number; roomSubtotal: number; longStayPercent: number; longStayDiscount: number; roomAfterLongStay: number;
  extraGuests: number; extraGuestFee: number; lodging: number; couponPercent: number; couponDiscount: number; lodgingAfterCoupon: number;
  earlyFee: number; lateFee: number; services: { id: string; name: string; qty: number; amount: number }[]; servicesTotal: number;
  originalTotal: number; total: number; deposit: number;
}

export function quoteStay(room: RoomPrice, checkIn: string, checkOut: string, guests: number, pricing: PricingCfg, cfg: BookingCfg, o: QuoteOptions = {}): Quote {
  const count = Math.max(0, nightsOf(checkIn, checkOut));
  const nights: Night[] = [];
  for (let i = 0; i < count; i++) nights.push(nightPrice(room.price, addDay(checkIn, i), pricing));
  const roomSubtotal = nights.reduce((s, n) => s + n.price, 0);
  const ls = [...pricing.longStay].filter((r) => count >= r.minNights).sort((a, b) => b.minNights - a.minNights)[0];
  const longStayPercent = ls ? Math.min(0, ls.percent) : 0; // chỉ giảm giá, không tăng
  const longStayDiscount = Math.round(roomSubtotal * -longStayPercent / 100) || 0;
  const roomAfterLongStay = roomSubtotal - longStayDiscount;
  const base = room.baseGuests ?? room.capacity;
  const extraGuests = Math.max(0, guests - base);
  const extraGuestFee = extraGuests * cfg.extraGuestFee * count;
  const lodging = roomAfterLongStay + extraGuestFee;
  const couponPercent = o.couponPercent ?? 0;
  const couponDiscount = Math.round(lodging * couponPercent / 100);
  const lodgingAfterCoupon = lodging - couponDiscount;
  const earlyFee = o.early ? cfg.earlyCheckInFee : 0;
  const lateFee = o.late ? cfg.lateCheckOutFee : 0;
  const services = cfg.services.filter((s) => s.active && (o.services?.[s.id] ?? 0) > 0).map((s) => {
    const qty = Math.floor(o.services![s.id]);
    return { id: s.id, name: s.name, qty, amount: s.price * qty * (s.unit === "night" ? count : 1) };
  });
  const servicesTotal = services.reduce((t, s) => t + s.amount, 0);
  const originalTotal = lodging + earlyFee + lateFee + servicesTotal;
  const total = lodgingAfterCoupon + earlyFee + lateFee + servicesTotal;
  return {
    nights, nightsCount: count, roomSubtotal, longStayPercent, longStayDiscount, roomAfterLongStay, extraGuests, extraGuestFee, lodging, couponPercent, couponDiscount,
    lodgingAfterCoupon, earlyFee, lateFee, services, servicesTotal, originalTotal, total, deposit: depositFor(total, cfg.depositPercent),
  };
}

/** Tiền cọc: làm tròn lên nghìn đồng. */
export const depositFor = (total: number, percent: number) => (percent > 0 ? Math.min(total, Math.ceil((total * percent) / 100 / 1000) * 1000) : 0);

/** Các dòng chi tiết lưu cùng đặt phòng (để hóa đơn tái hiện đúng giá lúc đặt, dù bảng giá đổi sau này); có cả nhãn tiếng Việt và tiếng Anh. */
export function quoteLines(q: Quote, roomName: string): Line[] {
  const lines: Line[] = [];
  const groups = new Map<string, { price: number; tag: string; percent: number; n: number }>();
  for (const n of q.nights) { const k = `${n.price}|${n.tag}`; const g = groups.get(k); if (g) g.n++; else groups.set(k, { price: n.price, tag: n.tag, percent: n.percent, n: 1 }); }
  for (const g of groups.values()) lines.push({
    label: `${roomName} × ${g.n} đêm${g.tag ? ` (${tagLabel(g.tag, g.percent, "vi")})` : ""} @ ${g.price.toLocaleString("vi-VN")}`,
    labelEn: `${roomName} × ${g.n} night${g.n > 1 ? "s" : ""}${g.tag ? ` (${tagLabel(g.tag, g.percent, "en")})` : ""} @ ${g.price.toLocaleString("en-US")}`,
    amount: g.price * g.n,
  });
  if (q.longStayDiscount) lines.push({ label: `Giảm ở dài ngày −${-q.longStayPercent}%`, labelEn: `Long-stay discount −${-q.longStayPercent}%`, amount: -q.longStayDiscount });
  if (q.extraGuestFee) lines.push({ label: `Phụ thu thêm khách (${q.extraGuests} người)`, labelEn: `Extra guest surcharge (${q.extraGuests} ${q.extraGuests > 1 ? "guests" : "guest"})`, amount: q.extraGuestFee });
  if (q.couponDiscount) lines.push({ label: `Mã giảm giá −${q.couponPercent}%`, labelEn: `Coupon −${q.couponPercent}%`, amount: -q.couponDiscount });
  if (q.earlyFee) lines.push({ label: "Phụ thu nhận phòng sớm", labelEn: "Early check-in fee", amount: q.earlyFee });
  if (q.lateFee) lines.push({ label: "Phụ thu trả phòng muộn", labelEn: "Late check-out fee", amount: q.lateFee });
  for (const s of q.services) lines.push({ label: `${s.name} × ${s.qty}`, labelEn: `${s.name} × ${s.qty}`, amount: s.amount });
  return lines;
}
function tagLabel(tag: string, percent: number, lang: "vi" | "en") {
  const sign = percent > 0 ? `+${percent}%` : `${percent}%`;
  const vi = lang === "vi";
  return tag.replace("weekend", vi ? "cuối tuần" : "weekend").replace(/^holiday$/, vi ? "ngày lễ" : "holiday").replace(/^season$/, vi ? "mùa cao điểm" : "peak season") + ` ${sign}`;
}

/** Số ngày từ ngày `at` (yyyy-mm-dd) tới ngày nhận phòng. */
export const daysUntil = (at: string, checkIn: string) => nightsOf(at, checkIn);

/** % hoàn cọc theo chính sách: lấy mức có `daysBefore` lớn nhất mà không vượt quá số ngày còn lại. */
export function refundPercentFor(daysLeft: number, tiers: CancelTier[]): number {
  const sorted = [...tiers].sort((a, b) => b.daysBefore - a.daysBefore);
  const hit = sorted.find((t) => daysLeft >= t.daysBefore);
  return hit ? hit.refundPercent : 0;
}
