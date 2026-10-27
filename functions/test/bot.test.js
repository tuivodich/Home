"use strict";
// Chạy với Firestore Emulator: firebase emulators:exec --only firestore "npm test --prefix functions"
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { createBot, webhookSecret, parseDate } = require("../bot");

initializeApp({ projectId: "demo-nhago" });
const db = getFirestore();

function fakeTg() {
  const sent = [], edits = [], answers = [];
  return {
    sent, edits, answers,
    getMe: async () => ({ username: "nhagobot" }),
    sendMessage: async (chat, text, extra) => { sent.push({ chat: String(chat), text, extra }); return {}; },
    editMessageText: async (chat, id, text, extra) => { edits.push({ chat: String(chat), id, text, extra }); return {}; },
    answerCallbackQuery: async (id, text) => { answers.push({ id, text }); return true; },
  };
}
const NOW = new Date("2026-11-10T03:00:00Z"); // 10:00 giờ Việt Nam
const mk = () => { const tg = fakeTg(); return { tg, bot: createBot({ db, tg, now: () => NOW, randomCode: () => "ABCD1234" }) }; };

async function reset() {
  for (const c of ["users", "rooms", "bookings", "busy", "pend", "tgChats", "tgLinks", "tgSent", "reviews"]) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  await db.doc("users/own").set({ role: "owner", email: "chu@x.vn" });
  await db.doc("users/cus").set({ role: "customer", email: "k@x.vn" });
  await db.doc("users/hk").set({ role: "housekeeping", email: "hk@x.vn" });
  await db.doc("rooms/r1").set({ name: "Phòng gỗ 1", price: 500000, status: "active" });
  await db.doc("rooms/r2").set({ name: "Phòng gỗ 2", price: 600000, status: "active" });
  await db.doc("bookings/b1").set({ roomId: "r1", guestName: "An <b>", phone: "090", email: "k@x.vn", checkIn: "2026-11-20", checkOut: "2026-11-22", guests: 2, total: 1000000, status: "pending", note: "", source: "online", createdBy: "cus", slotId: "cus_1" });
  await db.doc("busy/b1").set({ roomId: "r1", checkIn: "2026-11-20", checkOut: "2026-11-22", status: "pending" });
  await db.doc("pend/cus_1").set({ uid: "cus", n: 1, bookingId: "b1" });
  await db.doc("tgChats/111").set({ uid: "own", role: "owner", email: "chu@x.vn" });
}
const msg = (chat, text, from = "Chủ") => ({ message: { chat: { id: chat, type: "private" }, from: { first_name: from }, text } });
const press = (chat, data) => ({ callback_query: { id: "cb1", data, from: { first_name: "Chủ" }, message: { message_id: 9, text: "Yêu cầu", chat: { id: chat } } } });

test("parseDate", () => {
  assert.equal(parseDate("25/12/2026", "2026-11-10"), "2026-12-25");
  assert.equal(parseDate("5/1", "2026-11-10"), "2026-01-05");
  assert.equal(parseDate("2026-12-25", "2026-11-10"), "2026-12-25");
  assert.equal(parseDate("31/02", "2026-11-10"), null);
  assert.equal(parseDate("abc", "2026-11-10"), null);
});

test("webhookSecret ổn định và phụ thuộc token", () => {
  assert.equal(webhookSecret("t1"), webhookSecret("t1"));
  assert.notEqual(webhookSecret("t1"), webhookSecret("t2"));
});

test("notify: yêu cầu mới gửi tới chat nhân viên, kèm nút, chỉ một lần, escape HTML", async () => {
  await reset();
  const { tg, bot } = mk();
  assert.deepEqual(await bot.notify("cus", { type: "booking", id: "b1" }), { sent: 1 });
  assert.equal(tg.sent.length, 1);
  assert.match(tg.sent[0].text, /Yêu cầu đặt phòng mới/);
  assert.match(tg.sent[0].text, /An &lt;b&gt;/);
  assert.equal(tg.sent[0].extra.reply_markup.inline_keyboard[0][0].callback_data, "cf:b1");
  assert.deepEqual(await bot.notify("cus", { type: "booking", id: "b1" }), { sent: 0 }); // trùng
});

test("notify: người khác không giả mạo được; sai trạng thái bị bỏ qua", async () => {
  await reset();
  const { tg, bot } = mk();
  assert.deepEqual(await bot.notify("own", { type: "booking", id: "b1" }), { sent: 0 });
  assert.deepEqual(await bot.notify("cus", { type: "cancel", id: "b1" }), { sent: 0 });
  assert.deepEqual(await bot.notify("cus", { type: "review" }), { sent: 0 });
  assert.equal(tg.sent.length, 0);
});

test("notify: khách hủy và cảm nhận mới", async () => {
  await reset();
  await db.doc("bookings/b1").update({ status: "cancelled", cancelReason: "customer" });
  await db.doc("reviews/cus").set({ name: "An", rating: 4, comment: "Rất yên tĩnh và dễ chịu.", status: "pending", createdBy: "cus" });
  const { tg, bot } = mk();
  assert.equal((await bot.notify("cus", { type: "cancel", id: "b1" })).sent, 1);
  assert.equal((await bot.notify("cus", { type: "review" })).sent, 1);
  assert.match(tg.sent[0].text, /hủy/);
  assert.match(tg.sent[1].text, /Cảm nhận mới/);
});

test("liên kết: tạo mã → /start MÃ → chat được lưu; khách thường không tạo được mã", async () => {
  await reset();
  const { tg, bot } = mk();
  await assert.rejects(bot.linkCode("cus"));
  const r = await bot.linkCode("own");
  assert.equal(r.code, "ABCD1234");
  assert.match(r.link, /t\.me\/nhagobot\?start=ABCD1234/);
  await bot.handleUpdate(msg(222, "/start ABCD1234", "Lan"));
  const chat = await db.doc("tgChats/222").get();
  assert.equal(chat.data().uid, "own");
  assert.equal((await db.doc("tgLinks/ABCD1234").get()).exists, false); // mã dùng một lần
  assert.match(tg.sent.at(-1).text, /Đã liên kết/);
  await bot.handleUpdate(msg(333, "/start ABCD1234")); // mã đã dùng
  assert.equal((await db.doc("tgChats/333").get()).exists, false);
});

test("liên kết: mã hết hạn / người bị hạ quyền không liên kết được", async () => {
  await reset();
  const { bot } = mk();
  await db.doc("tgLinks/OLD").set({ uid: "own", exp: NOW.getTime() - 1 });
  await bot.handleUpdate(msg(444, "/start OLD"));
  assert.equal((await db.doc("tgChats/444").get()).exists, false);
  await db.doc("tgLinks/HK").set({ uid: "hk", exp: NOW.getTime() + 60000 });
  await bot.handleUpdate(msg(445, "/start HK"));
  assert.equal((await db.doc("tgChats/445").get()).exists, false);
});

test("chat chưa liên kết không dùng được lệnh và nút", async () => {
  await reset();
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(999, "/cho"));
  assert.match(tg.sent[0].text, /chưa liên kết/);
  await bot.handleUpdate(press(999, "cf:b1"));
  assert.match(tg.answers[0].text, /chưa liên kết|không đủ quyền/);
  assert.equal((await db.doc("bookings/b1").get()).data().status, "pending");
});

test("nút Xác nhận: đổi trạng thái, cập nhật busy, nhả khe, sửa tin nhắn; bấm lại báo đã xử lý", async () => {
  await reset();
  const { tg, bot } = mk();
  await bot.handleUpdate(press(111, "cf:b1"));
  assert.equal((await db.doc("bookings/b1").get()).data().status, "confirmed");
  assert.equal((await db.doc("busy/b1").get()).data().status, "confirmed");
  assert.equal((await db.doc("pend/cus_1").get()).exists, false);
  assert.match(tg.edits[0].text, /Đã xác nhận/);
  await bot.handleUpdate(press(111, "cf:b1"));
  assert.match(tg.answers.at(-1).text, /đã được xử lý/);
});

test("nút Xác nhận bị chặn khi trùng lịch với đặt phòng đã xác nhận", async () => {
  await reset();
  await db.doc("bookings/b2").set({ roomId: "r1", guestName: "B", phone: "1", checkIn: "2026-11-21", checkOut: "2026-11-23", guests: 1, total: 1, status: "confirmed" });
  const { bot } = mk();
  await bot.handleUpdate(press(111, "cf:b1"));
  assert.equal((await db.doc("bookings/b1").get()).data().status, "pending");
});

test("nút Từ chối: hủy, gỡ lịch bận, nhả khe", async () => {
  await reset();
  const { bot } = mk();
  await bot.handleUpdate(press(111, "rj:b1"));
  assert.equal((await db.doc("bookings/b1").get()).data().status, "cancelled");
  assert.equal((await db.doc("busy/b1").get()).exists, false);
  assert.equal((await db.doc("pend/cus_1").get()).exists, false);
});

test("quyền được kiểm tra lại: chat của người bị hạ quyền bị ngắt", async () => {
  await reset();
  await db.doc("users/own").update({ role: "customer" });
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(111, "/cho"));
  assert.match(tg.sent[0].text, /không còn quyền/);
  assert.equal((await db.doc("tgChats/111").get()).exists, false);
  await reset();
  await db.doc("users/own").update({ role: "customer" });
  await bot.handleUpdate(press(111, "cf:b1"));
  assert.equal((await db.doc("bookings/b1").get()).data().status, "pending");
});

test("/homnay, /cho, /trong", async () => {
  await reset();
  await db.doc("bookings/t1").set({ roomId: "r2", guestName: "Hoa", phone: "1", checkIn: "2026-11-10", checkOut: "2026-11-12", guests: 1, total: 1, status: "confirmed" });
  await db.doc("bookings/t2").set({ roomId: "r1", guestName: "Bình", phone: "1", checkIn: "2026-11-08", checkOut: "2026-11-10", guests: 1, total: 1, status: "checked_in" });
  await db.doc("busy/t1").set({ roomId: "r2", checkIn: "2026-11-10", checkOut: "2026-11-12", status: "confirmed" });
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(111, "/homnay"));
  assert.match(tg.sent[0].text, /10\/11\/2026/);
  assert.match(tg.sent[0].text, /Hoa/);
  assert.match(tg.sent[0].text, /Bình/);
  await bot.handleUpdate(msg(111, "/cho"));
  assert.match(tg.sent[1].text, /Chờ xác nhận/);
  assert.equal(tg.sent[1].extra.reply_markup.inline_keyboard[0][1].callback_data, "rj:b1");
  await bot.handleUpdate(msg(111, "/trong 10/11"));
  assert.match(tg.sent[2].text, /còn 1\/2/);
  assert.match(tg.sent[2].text, /Phòng gỗ 1/);
  await bot.handleUpdate(msg(111, "/trong xyz"));
  assert.match(tg.sent[3].text, /không hợp lệ/);
});

test("/huylienket", async () => {
  await reset();
  const { bot } = mk();
  await bot.handleUpdate(msg(111, "/huylienket"));
  assert.equal((await db.doc("tgChats/111").get()).exists, false);
});
