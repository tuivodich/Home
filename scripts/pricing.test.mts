// Kiểm thử bảng giá: node --experimental-strip-types --test scripts/pricing.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_BOOKING_CFG, DEFAULT_PRICING, depositFor, nightPrice, parseBookingCfg, parsePricing, quoteLines, quoteStay, refundPercentFor } from "../src/lib/pricing.ts";

const room = { price: 1000000, capacity: 4, baseGuests: 2 };
const P = { ...DEFAULT_PRICING, weekendPercent: 20, seasons: [{ name: "Hè", from: "2026-06-01", to: "2026-08-31", percent: 10 }], holidays: [{ name: "Tết", from: "2027-02-05", to: "2027-02-10", percent: 50 }], longStay: [{ minNights: 3, percent: -5 }, { minNights: 7, percent: -10 }] };
const C = { ...DEFAULT_BOOKING_CFG, extraGuestFee: 100000, earlyCheckInFee: 200000, lateCheckOutFee: 150000, services: [
  { id: "a", name: "Đón đưa", price: 300000, unit: "once" as const, active: true },
  { id: "b", name: "Thuê xe máy", price: 120000, unit: "night" as const, active: true },
  { id: "c", name: "Ẩn", price: 1, unit: "once" as const, active: false },
] };

test("giá một đêm: thường, cuối tuần (T6/T7), mùa, lễ", () => {
  assert.equal(nightPrice(1000000, "2026-10-28", P).price, 1000000); // thứ Tư
  assert.equal(nightPrice(1000000, "2026-10-30", P).price, 1200000); // thứ Sáu +20%
  assert.equal(nightPrice(1000000, "2026-10-31", P).price, 1200000); // thứ Bảy
  assert.equal(nightPrice(1000000, "2026-11-01", P).price, 1000000); // Chủ nhật không phải đêm cuối tuần
  assert.equal(nightPrice(1000000, "2026-07-08", P).price, 1100000); // thứ Tư mùa hè +10%
  assert.equal(nightPrice(1000000, "2026-07-10", P).price, 1300000); // thứ Sáu mùa hè +10% +20%
  assert.equal(nightPrice(1000000, "2027-02-06", P).price, 1500000); // lễ thay thế cuối tuần (thứ Bảy) = +50%
});

test("làm tròn nghìn đồng", () => {
  assert.equal(nightPrice(333000, "2026-10-30", P).price, 400000);
});

test("báo giá: ở 2 đêm thường, đúng số khách cơ sở", () => {
  const q = quoteStay(room, "2026-10-26", "2026-10-28", 2, P, C);
  assert.equal(q.total, 2000000);
  assert.equal(q.longStayDiscount, 0);
  assert.equal(q.extraGuestFee, 0);
});

test("giảm ở dài ngày: 3 đêm −5%, 7 đêm −10%", () => {
  assert.equal(quoteStay(room, "2026-10-26", "2026-10-29", 2, P, C).total, 2850000); // 3 đêm thường = 3.000.000 −5%
  assert.equal(quoteStay(room, "2026-10-26", "2026-11-02", 2, P, C).longStayPercent, -10);
});

test("phụ thu thêm khách theo đêm, nhận sớm, trả muộn, dịch vụ", () => {
  const q = quoteStay(room, "2026-10-26", "2026-10-28", 4, P, C, { early: true, late: true, services: { a: 1, b: 2, c: 5, zz: 3 } });
  assert.equal(q.extraGuests, 2);
  assert.equal(q.extraGuestFee, 2 * 100000 * 2);
  assert.equal(q.servicesTotal, 300000 + 120000 * 2 * 2); // dịch vụ ẩn/không có bị bỏ qua
  assert.equal(q.total, 2000000 + 400000 + 200000 + 150000 + 780000);
});

test("mã giảm giá chỉ áp lên tiền ở (sau giảm ở dài ngày + phụ thu thêm khách)", () => {
  const q = quoteStay(room, "2026-10-26", "2026-10-28", 4, P, C, { early: true, services: { a: 1 }, couponPercent: 10 });
  assert.equal(q.lodging, 2000000 + 400000);
  assert.equal(q.couponDiscount, 240000);
  assert.equal(q.total, 2400000 - 240000 + 200000 + 300000);
  assert.equal(q.originalTotal, 2400000 + 200000 + 300000);
});

test("tiền cọc: làm tròn lên nghìn, 0% = không cọc, không vượt tổng", () => {
  assert.equal(depositFor(2850000, 30), 855000);
  assert.equal(depositFor(2851000, 30), 856000); // 855.300 → làm tròn lên nghìn
  assert.equal(depositFor(2850000, 0), 0);
  assert.equal(depositFor(500000, 100), 500000);
  assert.equal(depositFor(1500, 100), 1500);
});

test("chính sách hủy: chọn mức theo số ngày còn lại", () => {
  const tiers = DEFAULT_BOOKING_CFG.cancelTiers; // 7→100, 3→50, 0→0
  assert.equal(refundPercentFor(10, tiers), 100);
  assert.equal(refundPercentFor(7, tiers), 100);
  assert.equal(refundPercentFor(5, tiers), 50);
  assert.equal(refundPercentFor(3, tiers), 50);
  assert.equal(refundPercentFor(1, tiers), 0);
  assert.equal(refundPercentFor(-2, tiers), 0);
});

test("đọc cấu hình: giá trị sai/thiếu được chuẩn hóa", () => {
  const p = parsePricing({ weekendDays: [5, 9, "x"], weekendPercent: "abc", seasons: [{ from: "2026-01-01" }, { name: "ok", from: "2026-01-01", to: "2026-01-05", percent: 5 }], longStay: [{ minNights: 7, percent: -10 }, { minNights: 3, percent: -5 }, { minNights: 1, percent: -50 }] });
  assert.deepEqual(p.weekendDays, [5]);
  assert.equal(p.weekendPercent, 0);
  assert.equal(p.seasons.length, 1);
  assert.deepEqual(p.longStay.map((r) => r.minNights), [3, 7]);
  const c = parseBookingCfg({ depositPercent: 500, cancelTiers: [{ daysBefore: 2, refundPercent: 150 }, { daysBefore: 9, refundPercent: 100 }], services: [{ id: "x", name: "Y", price: -5, unit: "night" }, { name: "no id" }] });
  assert.equal(c.depositPercent, 100);
  assert.deepEqual(c.cancelTiers.map((t) => [t.daysBefore, t.refundPercent]), [[9, 100], [2, 100]]);
  assert.equal(c.services.length, 1);
  assert.equal(c.services[0].price, 0);
  assert.deepEqual(parseBookingCfg(undefined), DEFAULT_BOOKING_CFG);
});

test("dòng chi tiết gộp các đêm cùng giá và có tổng khớp", () => {
  const q = quoteStay(room, "2026-10-29", "2026-11-01", 2, P, C, { couponPercent: 10, services: { a: 1 } }); // T5, T6, T7
  const lines = quoteLines(q, "Phòng gỗ 1");
  assert.equal(lines.reduce((s, l) => s + l.amount, 0), q.total);
  assert.ok(lines.some((l) => /cuối tuần/.test(l.label) && /× 2 đêm/.test(l.label)));
});
