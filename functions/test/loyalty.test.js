"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { createLoyalty, parseLoyalty, tierFor } = require("../loyalty");

if (!getApps().length) initializeApp({ projectId: "demo-nhago" });
const db = getFirestore();
const NOW = new Date("2026-11-10T03:00:00Z");
const CFG = { enabled: true, tiers: [
  { id: "bronze", name: "Đồng", color: "#cd7f32", minBookings: 0, couponPercent: 0 },
  { id: "silver", name: "Bạc", color: "#b8c2cc", minBookings: 2, couponPercent: 5 },
  { id: "gold", name: "Vàng", color: "#f2b705", minBookings: 4, couponPercent: 8 },
] };

async function reset(stays = 0, extra = {}) {
  for (const c of ["bookings", "coupons", "members", "settings"]) { const s = await db.collection(c).get(); await Promise.all(s.docs.map((d) => d.ref.delete())); }
  await db.doc("settings/loyalty").set({ ...CFG, ...extra });
  for (let i = 0; i < stays; i++) await db.doc(`bookings/s${i}`).set({ createdBy: "u1", source: "online", status: "checked_out" });
  await db.doc("bookings/staffmade").set({ createdBy: "u1", source: "staff", status: "checked_out" }); // không tính
  await db.doc("bookings/cancel").set({ createdBy: "u1", source: "online", status: "cancelled" }); // không tính
  await db.doc("bookings/other").set({ createdBy: "u2", source: "online", status: "checked_out" }); // của người khác
}
const mk = () => createLoyalty({ db, now: () => NOW, randomCode: () => "ABC123" });

test("tierFor: tự thăng theo số lần ở, hạng đặt tay ưu tiên", () => {
  const cfg = parseLoyalty(CFG);
  assert.equal(tierFor(0, cfg).id, "bronze");
  assert.equal(tierFor(2, cfg).id, "silver");
  assert.equal(tierFor(9, cfg).id, "gold");
  assert.equal(tierFor(0, cfg, "gold").id, "gold");
  assert.equal(tierFor(5, cfg, "không-có").id, "gold"); // hạng đặt tay không còn tồn tại → tự động
});

test("nhận mã: tạo mã riêng cho đúng hạng (tính ở máy chủ), hạn 90 ngày, chỉ chủ mã dùng được", async () => {
  await reset(2);
  const r = await mk().claim("u1");
  assert.equal(r.existing, false);
  assert.equal(r.percent, 5);
  assert.match(r.code, /^MB-SILV-ABC123$/);
  const c = (await db.doc(`coupons/${r.code}`).get()).data();
  assert.equal(c.ownerUid, "u1");
  assert.equal(c.used, false);
  assert.equal(c.percent, 5);
  assert.equal(c.expiresAt.toMillis(), NOW.getTime() + 90 * 86400000);
  assert.equal((await db.doc("members/u1").get()).data().claimed.silver, r.code);
});

test("nhận mã lần hai cùng hạng trả lại mã cũ (không tạo thêm)", async () => {
  await reset(2);
  const a = await mk().claim("u1");
  const b = await createLoyalty({ db, now: () => NOW, randomCode: () => "ZZZ999" }).claim("u1");
  assert.equal(b.existing, true);
  assert.equal(b.code, a.code);
  assert.equal((await db.collection("coupons").get()).size, 1);
});

test("lên hạng mới thì nhận được mã mới của hạng đó", async () => {
  await reset(2);
  const a = await mk().claim("u1");
  for (const i of [10, 11]) await db.doc(`bookings/s${i}`).set({ createdBy: "u1", source: "online", status: "checked_out" });
  const b = await createLoyalty({ db, now: () => NOW, randomCode: () => "GOLD01" }).claim("u1");
  assert.equal(b.existing, false);
  assert.equal(b.percent, 8);
  assert.notEqual(b.code, a.code);
});

test("hạng đặt tay được tôn trọng; hạng không có mã hoặc chương trình tắt thì từ chối", async () => {
  await reset(0, {});
  await assert.rejects(mk().claim("u1"), /chưa có mã giảm giá/); // Đồng: 0%
  await db.doc("members/u1").set({ tier: "gold" });
  assert.equal((await mk().claim("u1")).percent, 8);
  await reset(5, { enabled: false });
  await assert.rejects(mk().claim("u1"), /chưa bật/);
});
