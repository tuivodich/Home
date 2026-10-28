"use strict";
// Bản rút gọn của src/lib/pricing.ts cho bot (báo giá nhanh /gia). Hai bản phải cho cùng kết quả — xem test/pricing.test.js.

const num = (v, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v, d = "") => (typeof v === "string" ? v : d);
const list = (v, f) => (Array.isArray(v) ? v : []).map((x) => (x && typeof x === "object" ? f(x) : null)).filter((x) => x !== null);

function parsePricing(d) {
  const rule = (x) => (str(x.from) && str(x.to) ? { name: str(x.name), from: str(x.from), to: str(x.to), percent: num(x.percent) } : null);
  const days = Array.isArray(d?.weekendDays) ? d.weekendDays.filter((n) => Number.isInteger(n) && n >= 0 && n <= 6) : [5, 6];
  return {
    weekendDays: days, weekendPercent: num(d?.weekendPercent), seasons: list(d?.seasons, rule), holidays: list(d?.holidays, rule),
    longStay: list(d?.longStay, (x) => (num(x.minNights) >= 2 ? { minNights: Math.floor(num(x.minNights)), percent: num(x.percent) } : null)).sort((a, b) => a.minNights - b.minNights),
  };
}

function parseBooking(d) {
  const tiers = list(d?.cancelTiers, (x) => ({ daysBefore: Math.max(0, Math.floor(num(x.daysBefore))), refundPercent: Math.min(100, Math.max(0, num(x.refundPercent))) })).sort((a, b) => b.daysBefore - a.daysBefore);
  return {
    depositPercent: Math.min(100, Math.max(0, num(d?.depositPercent))),
    checkInTime: str(d?.checkInTime, "14:00"), checkOutTime: str(d?.checkOutTime, "12:00"),
    cancelTiers: tiers.length ? tiers : [{ daysBefore: 7, refundPercent: 100 }, { daysBefore: 3, refundPercent: 50 }, { daysBefore: 0, refundPercent: 0 }],
    cancelNote: str(d?.cancelNote),
    extraGuestFee: Math.max(0, num(d?.extraGuestFee)), earlyCheckInFee: Math.max(0, num(d?.earlyCheckInFee)), lateCheckOutFee: Math.max(0, num(d?.lateCheckOutFee)),
    services: list(d?.services, (x) => (str(x.id) && str(x.name) ? { id: str(x.id), name: str(x.name), price: Math.max(0, num(x.price)), unit: x.unit === "night" ? "night" : "once", active: x.active !== false } : null)),
  };
}

const addDay = (s, n) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dayOfWeek = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();
const roundK = (n) => Math.round(n / 1000) * 1000;
const inRange = (d, r) => r.from <= d && d <= r.to;

/** Giá một đêm (giống nightPrice() của ứng dụng): { date, price, percent, tag }. */
function nightInfo(base, d, cfg) {
  const hol = cfg.holidays.filter((h) => inRange(d, h)).sort((a, b) => b.percent - a.percent)[0];
  let percent = 0, tag = "";
  if (hol) { percent = hol.percent; tag = hol.name || "holiday"; }
  else {
    const se = cfg.seasons.filter((s) => inRange(d, s)).sort((a, b) => b.percent - a.percent)[0];
    if (se) { percent += se.percent; tag = se.name || "season"; }
    if (cfg.weekendPercent && cfg.weekendDays.includes(dayOfWeek(d))) { percent += cfg.weekendPercent; tag = tag ? `${tag} + weekend` : "weekend"; }
  }
  return { date: d, percent, tag, price: percent ? roundK(base * (1 + percent / 100)) : base };
}
const nightPrice = (base, d, cfg) => nightInfo(base, d, cfg).price;

/** Tổng tiền ở (chưa mã giảm giá/dịch vụ/nhận sớm/trả muộn) + tiền cọc, giống quoteStay() của ứng dụng. */
function quote(room, checkIn, count, guests, pricing, cfg) {
  let sub = 0;
  for (let i = 0; i < count; i++) sub += nightPrice(room.price, addDay(checkIn, i), pricing);
  const ls = [...pricing.longStay].filter((r) => count >= r.minNights).sort((a, b) => b.minNights - a.minNights)[0];
  const pct = ls ? Math.min(0, ls.percent) : 0;
  const discount = Math.round((sub * -pct) / 100) || 0;
  const base = room.baseGuests ?? room.capacity ?? guests;
  const extra = Math.max(0, guests - base);
  const total = sub - discount + extra * cfg.extraGuestFee * count;
  const deposit = cfg.depositPercent > 0 ? Math.min(total, Math.ceil((total * cfg.depositPercent) / 100 / 1000) * 1000) : 0;
  return { total, deposit, discount, extra, perNight: count ? Math.round(total / count) : 0 };
}

const depositFor = (total, percent) => (percent > 0 ? Math.min(total, Math.ceil((total * percent) / 100 / 1000) * 1000) : 0);

/**
 * Báo giá đầy đủ, giống quoteStay() trong src/lib/pricing.ts (có nhận sớm/trả muộn, dịch vụ, mã giảm giá):
 * dùng để kiểm tra giá khách gửi lên. opts: { early, late, services: {id: số lượng}, couponPercent }.
 */
function quoteFull(room, checkIn, count, guests, pricing, cfg, o = {}) {
  const nights = [];
  for (let i = 0; i < count; i++) nights.push(nightInfo(room.price, addDay(checkIn, i), pricing));
  const roomSubtotal = nights.reduce((t, n) => t + n.price, 0);
  const ls = [...pricing.longStay].filter((r) => count >= r.minNights).sort((a, b) => b.minNights - a.minNights)[0];
  const longStayPercent = ls ? Math.min(0, ls.percent) : 0;
  const longStayDiscount = Math.round((roomSubtotal * -longStayPercent) / 100) || 0;
  const roomAfterLongStay = roomSubtotal - longStayDiscount;
  const base = room.baseGuests ?? room.capacity;
  const extraGuests = Math.max(0, guests - base);
  const extraGuestFee = extraGuests * cfg.extraGuestFee * count;
  const lodging = roomAfterLongStay + extraGuestFee;
  const couponPercent = o.couponPercent ?? 0;
  const couponDiscount = Math.round((lodging * couponPercent) / 100);
  const lodgingAfterCoupon = lodging - couponDiscount;
  const earlyFee = o.early ? cfg.earlyCheckInFee : 0;
  const lateFee = o.late ? cfg.lateCheckOutFee : 0;
  const services = (cfg.services ?? []).filter((s) => s.active && (o.services?.[s.id] ?? 0) > 0).map((s) => {
    const qty = Math.floor(o.services[s.id]);
    return { id: s.id, name: s.name, qty, amount: s.price * qty * (s.unit === "night" ? count : 1) };
  });
  const servicesTotal = services.reduce((t, s) => t + s.amount, 0);
  const originalTotal = lodging + earlyFee + lateFee + servicesTotal;
  const total = lodgingAfterCoupon + earlyFee + lateFee + servicesTotal;
  return { nights, nightsCount: count, longStayPercent, longStayDiscount, extraGuests, extraGuestFee, couponPercent, couponDiscount, earlyFee, lateFee, services, originalTotal, total, deposit: depositFor(total, cfg.depositPercent) };
}

function tagLabel(tag, percent) {
  const sign = percent > 0 ? `+${percent}%` : `${percent}%`;
  return tag.replace("weekend", "cuối tuần").replace(/^holiday$/, "ngày lễ").replace(/^season$/, "mùa cao điểm") + ` ${sign}`;
}

/** Các dòng chi tiết lưu cùng đặt phòng (giống quoteLines() của ứng dụng). */
function quoteLines(q, roomName) {
  const lines = [];
  const groups = new Map();
  for (const n of q.nights) { const k = `${n.price}|${n.tag}`; const g = groups.get(k); if (g) g.n++; else groups.set(k, { price: n.price, tag: n.tag, percent: n.percent, n: 1 }); }
  for (const g of groups.values()) lines.push({ label: `${roomName} × ${g.n} đêm${g.tag ? ` (${tagLabel(g.tag, g.percent)})` : ""} @ ${g.price.toLocaleString("vi-VN")}`, amount: g.price * g.n });
  if (q.longStayDiscount) lines.push({ label: `Giảm ở dài ngày −${-q.longStayPercent}%`, amount: -q.longStayDiscount });
  if (q.extraGuestFee) lines.push({ label: `Phụ thu thêm khách (${q.extraGuests} người)`, amount: q.extraGuestFee });
  if (q.couponDiscount) lines.push({ label: `Mã giảm giá −${q.couponPercent}%`, amount: -q.couponDiscount });
  if (q.earlyFee) lines.push({ label: "Phụ thu nhận phòng sớm", amount: q.earlyFee });
  if (q.lateFee) lines.push({ label: "Phụ thu trả phòng muộn", amount: q.lateFee });
  for (const s of q.services) lines.push({ label: `${s.name} × ${s.qty}`, amount: s.amount });
  return lines;
}

module.exports = { parsePricing, parseBooking, nightPrice, quote, quoteFull, quoteLines, depositFor };
