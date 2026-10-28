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
  };
}

const addDay = (s, n) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const dayOfWeek = (s) => new Date(`${s}T00:00:00Z`).getUTCDay();
const roundK = (n) => Math.round(n / 1000) * 1000;
const inRange = (d, r) => r.from <= d && d <= r.to;

function nightPrice(base, d, cfg) {
  const hol = cfg.holidays.filter((h) => inRange(d, h)).sort((a, b) => b.percent - a.percent)[0];
  let percent = 0;
  if (hol) percent = hol.percent;
  else {
    const se = cfg.seasons.filter((s) => inRange(d, s)).sort((a, b) => b.percent - a.percent)[0];
    if (se) percent += se.percent;
    if (cfg.weekendPercent && cfg.weekendDays.includes(dayOfWeek(d))) percent += cfg.weekendPercent;
  }
  return percent ? roundK(base * (1 + percent / 100)) : base;
}

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

module.exports = { parsePricing, parseBooking, nightPrice, quote };
