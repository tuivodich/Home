"use strict";
// Dọn đặt phòng bị treo: chờ xác nhận quá ngày nhận → hết hạn; đã xác nhận quá ngày trả mà chưa đến → khách không đến.
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { createGuest } = require("../guest");
const { createBot } = require("../bot");

if (!getApps().length) initializeApp({ projectId: "demo-nhago" });
const db = getFirestore();
const NOW = new Date("2026-11-10T03:00:00Z"); // 10:00 giờ Việt Nam, 10/11

function fakeTg() {
  const sent = [];
  return { sent, getMe: async () => ({ username: "nhagobot" }), sendMessage: async (chat, text, extra) => { sent.push({ chat: String(chat), text, extra }); return {}; }, editMessageText: async () => ({}), answerCallbackQuery: async () => true };
}
function fakeMailer() { const mails = []; return { mails, enabled: true, from: "x@x.vn", send: async (m) => { mails.push(m); return true; } }; }
const mk = () => { const tg = fakeTg(), mailer = fakeMailer(); const guest = createGuest({ db, tg, mailer, now: () => NOW }); return { tg, mailer, guest, bot: createBot({ db, tg, now: () => NOW, guest }) }; };

async function reset() {
  for (const c of ["users", "rooms", "bookings", "busy", "pend", "tgChats", "tgSent", "tgRate", "settings"]) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  await db.doc("users/own").set({ role: "owner", email: "chu@x.vn" });
  await db.doc("users/rec").set({ role: "reception", email: "lt@x.vn" });
  await db.doc("rooms/r1").set({ name: "Phòng gỗ 1", price: 500000, capacity: 2, status: "active" });
  await db.doc("tgChats/111").set({ uid: "own", role: "owner" });
  await db.doc("tgChats/222").set({ uid: "rec", role: "reception" });
  await db.doc("settings/mail").set({ enabled: true });
}
const bk = (o) => ({ roomId: "r1", guestName: "An", phone: "090", email: "khach@x.vn", guests: 2, total: 1000000, note: "", source: "online", createdBy: "cus", ...o });
const read = async (id) => (await db.doc(`bookings/${id}`).get()).data();

test("expireStale: chờ xác nhận quá ngày nhận → hết hạn, nhả phòng và khe giữ chỗ, báo khách", async () => {
  await reset();
  await db.doc("bookings/p1").set(bk({ status: "pending", checkIn: "2026-11-08", checkOut: "2026-11-09", slotId: "cus_1", code: "PEND0001" }));
  await db.doc("busy/p1").set({ roomId: "r1", checkIn: "2026-11-08", checkOut: "2026-11-09", status: "pending" });
  await db.doc("pend/cus_1").set({ uid: "cus", n: 1, bookingId: "p1" });
  await db.doc("bookings/p2").set(bk({ status: "pending", checkIn: "2026-11-10", checkOut: "2026-11-11" })); // hôm nay vẫn còn hạn
  const { guest, mailer } = mk();
  const r = await guest.expireStale();
  assert.deepEqual(r, { expired: 1, noShows: 0 });
  const b = await read("p1");
  assert.deepEqual([b.status, b.cancelReason], ["cancelled", "expired"]);
  assert.equal((await db.doc("busy/p1").get()).exists, false);
  assert.equal((await db.doc("pend/cus_1").get()).exists, false);
  assert.equal((await read("p2")).status, "pending");
  assert.ok(mailer.mails.some((m) => /không còn hiệu lực/.test(m.subject) && /PEND0001/.test(m.subject)), "email hết hạn");
});

test("expireStale: đã xác nhận quá ngày trả phòng mà chưa nhận → khách không đến; giữ cọc; báo quản lý; không email cho khách", async () => {
  await reset();
  await db.doc("bookings/c1").set(bk({ status: "confirmed", checkIn: "2026-11-05", checkOut: "2026-11-07", paid: 300000, deposit: 300000, code: "CONF0001" }));
  await db.doc("busy/c1").set({ roomId: "r1", checkIn: "2026-11-05", checkOut: "2026-11-07", status: "confirmed" });
  await db.doc("bookings/c2").set(bk({ status: "confirmed", checkIn: "2026-11-09", checkOut: "2026-11-11" })); // vẫn đang trong kỳ ở dự kiến
  await db.doc("bookings/c3").set(bk({ status: "checked_in", checkIn: "2026-11-05", checkOut: "2026-11-07" })); // đã nhận phòng: không đụng
  const { guest, tg, mailer } = mk();
  assert.deepEqual(await guest.expireStale(), { expired: 0, noShows: 1 });
  const b = await read("c1");
  assert.deepEqual([b.status, b.cancelReason, b.paid], ["cancelled", "noshow", 300000]);
  assert.ok(b.noShowAt);
  assert.equal((await db.doc("busy/c1").get()).exists, false);
  assert.equal((await read("c2")).status, "confirmed");
  assert.equal((await read("c3")).status, "checked_in");
  assert.equal(mailer.mails.length, 0, "không gửi email cho khách không đến");
  assert.deepEqual(tg.sent.map((s) => s.chat), ["111"], "chỉ chủ/quản lý nhận báo");
  assert.match(tg.sent[0].text, /Khách không đến/);
  assert.match(tg.sent[0].text, /đã nhận 300\.000/);
  assert.deepEqual(await guest.expireStale(), { expired: 0, noShows: 0 }); // chạy lại không xử lý lần nữa
});

test("expireStale: tắt trong Cài đặt thì không tự hủy", async () => {
  await reset();
  await db.doc("settings/app").set({ autoRejectPending: false, autoNoShow: false });
  await db.doc("bookings/p1").set(bk({ status: "pending", checkIn: "2026-11-01", checkOut: "2026-11-02" }));
  await db.doc("bookings/c1").set(bk({ status: "confirmed", checkIn: "2026-11-01", checkOut: "2026-11-02" }));
  const { guest } = mk();
  assert.deepEqual(await guest.expireStale(), { expired: 0, noShows: 0 });
  assert.equal((await read("p1")).status, "pending"); assert.equal((await read("c1")).status, "confirmed");
  await db.doc("settings/app").set({ autoNoShow: false }); // chỉ tắt không đến: chờ xác nhận vẫn tự hết hạn
  assert.deepEqual(await guest.expireStale(), { expired: 1, noShows: 0 });
});

test("nhắc 08:00: đã xác nhận quá ngày nhận chưa đến + đang ở quá ngày trả; nút Khách không đến hoạt động", async () => {
  await reset();
  await db.doc("bookings/l1").set(bk({ status: "confirmed", checkIn: "2026-11-09", checkOut: "2026-11-12", paid: 100000, guestName: "Chưa Đến" }));
  await db.doc("busy/l1").set({ roomId: "r1", checkIn: "2026-11-09", checkOut: "2026-11-12", status: "confirmed" });
  await db.doc("bookings/l2").set(bk({ status: "checked_in", checkIn: "2026-11-05", checkOut: "2026-11-09", guestName: "Quá Hạn Trả" }));
  const { bot, tg } = mk();
  const r = await bot.dailyReminders();
  assert.deepEqual([r.lateIn, r.lateOut], [1, 1]);
  const m = tg.sent.find((s) => /Đặt phòng cần xử lý/.test(s.text));
  assert.match(m.text, /Chưa đến: <b>Chưa Đến<\/b>/); assert.match(m.text, /Quá hạn trả phòng: <b>Quá Hạn Trả<\/b>/);
  assert.equal(m.extra.reply_markup.inline_keyboard[0][0].callback_data, "ns:l1");
  assert.equal((await bot.dailyReminders()).lateIn, 0, "mỗi ngày chỉ nhắc một lần");
  await bot.handleUpdate({ callback_query: { id: "c", data: "ns:l1", from: { first_name: "Chủ" }, message: { message_id: 1, text: "x", chat: { id: 111 } } } });
  const b = await read("l1");
  assert.deepEqual([b.status, b.cancelReason, b.paid], ["cancelled", "noshow", 100000]);
  assert.equal((await db.doc("busy/l1").get()).exists, false);
  await bot.handleUpdate({ callback_query: { id: "c2", data: "ns:l1", from: { first_name: "Chủ" }, message: { message_id: 1, text: "x", chat: { id: 111 } } } });
  assert.equal(tg.sent.length >= 1, true);
});
