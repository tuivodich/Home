import test from "node:test";
import assert from "node:assert/strict";
import { buildResidence, isForeign, residenceCsv } from "../src/lib/residence.ts";

const rooms = [{ id: "r1", name: "Phòng gỗ 1" }, { id: "r2", name: "Phòng gỗ 2" }];
const bookings = [
  { id: "b1", roomId: "r1", checkIn: "2026-11-10", checkOut: "2026-11-12", status: "checked_in" },
  { id: "b2", roomId: "r2", checkIn: "2026-11-12", checkOut: "2026-11-14", status: "confirmed" },
  { id: "b3", roomId: "r1", checkIn: "2026-11-01", checkOut: "2026-11-03", status: "checked_out" },
  { id: "b4", roomId: "r2", checkIn: "2026-11-10", checkOut: "2026-11-11", status: "cancelled" },
  { id: "b5", roomId: "r2", checkIn: "2026-11-10", checkOut: "2026-11-11", status: "pending" },
];
const g = (id: string, bookingId: string, o = {}) => ({ id, fullName: `Khách ${id}`, docType: "cccd", docNumber: `0790${id}`, nationality: "Vietnam", dob: "1990-01-02", phone: "0909", bookingId, ...o });
const guests = [g("1", "b1"), g("2", "b2", { nationality: "Japan", docType: "passport" }), g("3", "b3"), g("4", "b4"), g("5", "b5"), g("6", "b1", { docNumber: "", dob: "" }), g("7", "none")];

test("isForeign: Việt Nam theo mọi cách viết là người Việt, trống không tính", () => {
  for (const v of ["Vietnam", "Việt Nam", "viet nam", "VN"]) assert.equal(isForeign(v), false, v);
  for (const v of ["Japan", "United States", "Korea"]) assert.equal(isForeign(v), true, v);
  assert.equal(isForeign(""), false);
});

test("buildResidence: chỉ khách có đặt phòng hợp lệ giao với khoảng ngày, sắp xếp, đánh dấu thiếu thông tin và người nước ngoài", () => {
  const rows = buildResidence(guests, bookings, rooms, "2026-11-10", "2026-11-12");
  assert.deepEqual(rows.map((r) => r.guestId), ["1", "6", "2"]); // theo ngày nhận, rồi phòng, rồi họ tên; b3 (đã trả trước khoảng), b4 hủy, b5 chờ, khách không gắn đặt phòng đều loại
  const jp = rows.find((r) => r.guestId === "2")!;
  assert.deepEqual([jp.foreign, jp.room, jp.checkIn], [true, "Phòng gỗ 2", "2026-11-12"]);
  assert.deepEqual(rows.find((r) => r.guestId === "6")!.missing, ["docNumber", "dob"]);
  assert.deepEqual(rows.find((r) => r.guestId === "1")!.missing, []);
  // Khoảng ngày chạm ngày trả phòng (cả hai đầu): b3 trả 03/11
  assert.deepEqual(buildResidence(guests, bookings, rooms, "2026-11-03", "2026-11-03").map((r) => r.guestId), ["3"]);
  assert.deepEqual(buildResidence(guests, bookings, rooms, "2026-12-01", "2026-12-05"), []);
});

test("residenceCsv: cột, định dạng ngày dd/mm/yyyy, số giấy tờ/điện thoại ép thành chữ", () => {
  const rows = buildResidence(guests, bookings, rooms, "2026-11-12", "2026-11-12");
  const csv = residenceCsv(rows, { head: ["STT", "Họ tên"], docType: (t) => ({ cccd: "CCCD", passport: "Hộ chiếu" } as Record<string, string>)[t] ?? t, foreign: "Người nước ngoài", local: "Công dân Việt Nam" });
  assert.deepEqual(csv[0], ["STT", "Họ tên"]);
  const jp = csv.find((r) => r[1] === "Khách 2")!;
  assert.deepEqual(jp.slice(0, 3), [3, "Khách 2", "02/01/1990"]); // b1 (khách 1, 6) trả 12/11 cũng giao khoảng nên Khách 2 đứng thứ 3
  assert.equal(jp[3], "Hộ chiếu"); assert.equal(jp[4], '="07902"'); assert.equal(jp[6], "Người nước ngoài"); assert.equal(jp[7], '="0909"');
  assert.equal(jp[9], "12/11/2026"); assert.equal(jp[10], "14/11/2026");
});
