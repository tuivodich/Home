// node --experimental-strip-types --test scripts/report.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, monthlySeries, overlapNights } from "../src/lib/report.ts";

const rooms = [{ id: "r1", name: "Gỗ 1" }, { id: "r2", name: "Gỗ 2" }, { id: "r3", name: "Bảo trì", status: "maintenance" }];
const ts = (iso: string) => ({ toMillis: () => new Date(iso).getTime() });
const B = [
  { id: "a", roomId: "r1", checkIn: "2026-10-30", checkOut: "2026-11-02", status: "checked_out", total: 3000000, source: "online", paid: 3000000, payLog: [{ amount: 900000, at: ts("2026-10-20T10:00:00") }, { amount: 2100000, at: ts("2026-11-02T10:00:00") }] },
  { id: "b", roomId: "r1", checkIn: "2026-11-05", checkOut: "2026-11-07", status: "checked_out", total: 1000000, source: "staff", paid: 1000000, payLog: [] },
  { id: "c", roomId: "r2", checkIn: "2026-11-10", checkOut: "2026-11-12", status: "confirmed", total: 800000, paid: 240000 },
  { id: "d", roomId: "r2", checkIn: "2026-11-15", checkOut: "2026-11-16", status: "cancelled", total: 500000 },
  { id: "e", roomId: "r2", checkIn: "2026-11-20", checkOut: "2026-11-21", status: "pending", total: 400000 },
  { id: "f", roomId: "r1", checkIn: "2026-12-01", checkOut: "2026-12-03", status: "checked_out", total: 700000, source: "online", paid: 700000 },
];
const E = [{ date: "2026-11-03", amount: 400000, category: "electric", paid: true }, { date: "2026-11-20", amount: 300000, category: "water", paid: false }, { date: "2026-10-31", amount: 999, category: "other", paid: true }];

test("đêm giao với kỳ", () => {
  assert.equal(overlapNights("2026-10-30", "2026-11-02", "2026-11-01", "2026-12-01"), 1);
  assert.equal(overlapNights("2026-10-30", "2026-11-02", "2026-11-05", "2026-12-01"), 0);
});

test("báo cáo tháng 11/2026", () => {
  const r = buildReport(B, E, rooms, "2026-11-01", "2026-12-01");
  assert.equal(r.days, 30);
  assert.equal(r.revenue, 4000000);               // a (trả phòng 02/11) + b; f thuộc tháng 12
  assert.equal(r.stays, 2);
  assert.equal(r.soldNights, 3 + 2);
  assert.equal(r.adr, 800000);
  assert.equal(r.expected, 800000);               // c đã xác nhận, trả phòng 12/11
  assert.equal(r.cancelled, 1);
  assert.equal(r.cancelRate, 1 / 4);              // 4 đặt phòng nhận phòng trong tháng: b, c, d, e
  assert.equal(r.occupiedNights, 1 + 2);          // a: đêm 01/11; b: 2 đêm
  assert.equal(r.occupancy, 3 / (2 * 30));        // phòng bảo trì không tính
  assert.equal(r.online.revenue, 3000000);
  assert.equal(r.staff.revenue, 1000000);
  assert.equal(r.collected, 2100000);             // chỉ khoản thu trong tháng
  assert.equal(r.expenses, 700000);
  assert.equal(r.profit, 4000000 - 700000);
  assert.equal(r.unpaidExpenses, 300000);
  assert.equal(r.rooms[0].roomId, "r1");
  assert.equal(r.rooms.find((x) => x.roomId === "r2")!.revenue, 0);
  assert.equal(r.receivable, 800000 - 240000);     // phải thu còn lại (c); a, b, f đã thu đủ
});

test("chuỗi 12 tháng", () => {
  const m = monthlySeries(B, E, 2026);
  assert.equal(m[10].revenue, 4000000);
  assert.equal(m[11].revenue, 700000);
  assert.equal(m[9].expenses, 999);
  assert.equal(m.length, 12);
});

test("cọc giữ lại của đặt phòng đã hủy / không đến được cộng vào lợi nhuận", () => {
  const more = [
    ...B,
    { id: "g", roomId: "r2", checkIn: "2026-11-25", checkOut: "2026-11-27", status: "cancelled", total: 900000, paid: 270000, cancelledAt: ts("2026-11-24T10:00:00") },
    { id: "h", roomId: "r1", checkIn: "2026-11-28", checkOut: "2026-11-29", status: "cancelled", total: 500000, paid: 150000 }, // không có ngày hủy → theo ngày nhận phòng
    { id: "i", roomId: "r1", checkIn: "2026-11-08", checkOut: "2026-11-09", status: "cancelled", total: 500000, paid: 0 },     // đã hoàn hết
    { id: "j", roomId: "r1", checkIn: "2026-12-10", checkOut: "2026-12-11", status: "cancelled", total: 500000, paid: 100000 }, // tháng khác
  ];
  const r = buildReport(more, E, rooms, "2026-11-01", "2026-12-01");
  assert.equal(r.forfeited, 420000);
  assert.equal(r.forfeitedCount, 2);
  assert.equal(r.revenue, 4000000);                // doanh thu lưu trú không đổi
  assert.equal(r.profit, 4000000 + 420000 - 700000);
  assert.equal(monthlySeries(more, E, 2026)[10].forfeited, 420000);
  assert.equal(monthlySeries(more, E, 2026)[11].forfeited, 100000);
});
