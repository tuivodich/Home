"use strict";
// Email xin đánh giá sau khi trả phòng, nhật ký hoạt động từ bot/hệ thống, khóa phòng khi xác nhận qua bot. Chạy với Firestore Emulator.
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { createGuest } = require("../guest");
const { createBot } = require("../bot");

if (!getApps().length) initializeApp({ projectId: "demo-nhago" });
const db = getFirestore();
const NOW = new Date("2026-11-10T03:00:00Z"); // 10/11 (giờ Việt Nam)

const fakeTg = () => { const sent = []; return { sent, getMe: async () => ({ username: "b" }), sendMessage: async (c, t, e) => { sent.push({ chat: String(c), text: t, extra: e }); return {}; }, editMessageText: async () => ({}), answerCallbackQuery: async () => true }; };
const fakeMailer = () => { const mails = []; return { mails, enabled: true, from: "x@x.vn", send: async (m) => { mails.push(m); return true; } }; };
const mk = () => { const tg = fakeTg(), mailer = fakeMailer(); const guest = createGuest({ db, tg, mailer, now: () => NOW }); return { tg, mailer, guest, bot: createBot({ db, tg, now: () => NOW, guest }) }; };

async function reset() {
  for (const c of ["users", "rooms", "bookings", "busy", "pend", "tgChats", "tgGuests", "tgSent", "tgRate", "settings", "reviews", "auditLog", "roomBlocks"]) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  await db.doc("users/own").set({ role: "owner", email: "chu@x.vn" });
  await db.doc("users/cus").set({ role: "customer", email: "k@x.vn" });
  await db.doc("rooms/r1").set({ name: "Phòng gỗ 1", price: 500000, capacity: 2, status: "active" });
  await db.doc("tgChats/111").set({ uid: "own", role: "owner" });
  await db.doc("settings/mail").set({ enabled: true });
  await db.doc("settings/mailState").set({ baselined: true });
}
const bk = (o) => ({ roomId: "r1", guestName: "An", phone: "090", email: "khach@x.vn", guests: 2, total: 1000000, note: "", source: "online", createdBy: "cus", code: "REVW0001", ...o });

test("xin đánh giá: khách online đã trả phòng 1–3 ngày trước, chưa viết cảm nhận → email có liên kết viết cảm nhận, chỉ một lần", async () => {
  await reset();
  await db.doc("bookings/a").set(bk({ status: "checked_out", checkIn: "2026-11-07", checkOut: "2026-11-09" }));
  await db.doc("bookings/today").set(bk({ status: "checked_out", checkIn: "2026-11-09", checkOut: "2026-11-10", code: "TODAY001" })); // vừa trả hôm nay: chưa hỏi
  await db.doc("bookings/old").set(bk({ status: "checked_out", checkIn: "2026-10-01", checkOut: "2026-10-03", code: "OLD00001" })); // quá 3 ngày: bỏ qua
  await db.doc("bookings/staff").set(bk({ status: "checked_out", checkIn: "2026-11-07", checkOut: "2026-11-09", source: "staff", code: "STAFF001" }));
  const { guest, mailer } = mk();
  const r = await guest.reminders();
  assert.equal(r.asked, 1);
  assert.equal(mailer.mails.length, 1);
  const m = mailer.mails[0];
  assert.match(m.subject, /Cảm ơn bạn đã lưu trú/); assert.match(m.subject, /REVW0001/);
  assert.match(m.text, /https:\/\/nhago\.web\.app\/reviews#write/);
  assert.match(m.html, /Viết cảm nhận của bạn/);
  assert.doesNotMatch(m.html, /Chính sách hủy/);
  assert.equal((await guest.reminders()).asked, 0, "không hỏi lại");
});

test("xin đánh giá: bỏ qua khách đã có cảm nhận; tắt trong cài đặt thì không gửi", async () => {
  await reset();
  await db.doc("bookings/a").set(bk({ status: "checked_out", checkIn: "2026-11-07", checkOut: "2026-11-09" }));
  await db.doc("reviews/cus").set({ name: "An", rating: 5, comment: "Rất tốt, sẽ quay lại.", status: "approved", createdBy: "cus" });
  const a = mk();
  assert.equal((await a.guest.reminders()).asked, 0);
  await db.doc("reviews/cus").delete();
  await db.doc("settings/mail").set({ enabled: true, reviewRequest: false });
  assert.equal((await mk().guest.reminders()).asked, 0);
  await db.doc("settings/mail").set({ enabled: true, reviewRequest: true });
  assert.equal((await mk().guest.reminders()).asked, 1);
});

test("nhật ký hoạt động: thao tác qua Telegram và hệ thống tự hủy đều được ghi", async () => {
  await reset();
  await db.doc("bookings/p1").set(bk({ status: "pending", checkIn: "2026-11-20", checkOut: "2026-11-21", slotId: "cus_1" }));
  await db.doc("busy/p1").set({ roomId: "r1", checkIn: "2026-11-20", checkOut: "2026-11-21", status: "pending" });
  await db.doc("bookings/old").set(bk({ status: "pending", checkIn: "2026-11-01", checkOut: "2026-11-02", code: "OLD00002" }));
  const { bot, guest } = mk();
  await bot.decide("cf", "p1", "Lan");
  await guest.expireStale();
  const logs = (await db.collection("auditLog").get()).docs.map((d) => d.data());
  const tgLog = logs.find((l) => l.action === "booking.status" && /qua Telegram/.test(l.summary));
  assert.deepEqual([tgLog.by, tgLog.role, tgLog.targetId], ["telegram:Lan", "telegram", "p1"]);
  assert.ok(tgLog.at);
  const sys = logs.find((l) => l.action === "booking.expire");
  assert.deepEqual([sys.by, sys.role, sys.targetId], ["system", "system", "old"]);
});

test("xác nhận qua bot bị chặn khi phòng đang bị khóa", async () => {
  await reset();
  await db.doc("bookings/p1").set(bk({ status: "pending", checkIn: "2026-11-20", checkOut: "2026-11-22", slotId: "cus_1" }));
  await db.doc("busy/p1").set({ roomId: "r1", checkIn: "2026-11-20", checkOut: "2026-11-22", status: "pending" });
  await db.doc("roomBlocks/k1").set({ roomId: "r1", from: "2026-11-21", to: "2026-11-25", reason: "Sửa mái" });
  const { bot } = mk();
  const r = await bot.decide("cf", "p1", "Lan");
  assert.equal(r.ok, false); assert.match(r.text, /khóa/);
  assert.equal((await db.doc("bookings/p1").get()).data().status, "pending");
  await db.doc("roomBlocks/k1").update({ from: "2026-11-22" }); // hết trùng (đêm 22 trở đi)
  assert.equal((await bot.decide("cf", "p1", "Lan")).ok, true);
});
