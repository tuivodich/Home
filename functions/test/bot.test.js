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
  for (const c of ["users", "rooms", "bookings", "busy", "pend", "tgChats", "tgLinks", "tgSent", "reviews", "tgRate", "settings"]) {
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
  await db.doc("tgLinks/OLDCODE1").set({ uid: "own", exp: NOW.getTime() - 1 });
  await bot.handleUpdate(msg(444, "/start OLDCODE1"));
  assert.equal((await db.doc("tgChats/444").get()).exists, false);
  await db.doc("tgLinks/HKCODE12").set({ uid: "hk", exp: NOW.getTime() + 60000 });
  await bot.handleUpdate(msg(445, "/start HKCODE12"));
  assert.equal((await db.doc("tgChats/445").get()).exists, false);
});

test("chat chưa liên kết không dùng được lệnh và nút", async () => {
  await reset();
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(999, "/cho"));
  assert.match(tg.sent[0].text, /dành cho nhân viên/);
  await bot.handleUpdate(msg(999, "/homnay"));
  assert.match(tg.sent[1].text, /dành cho nhân viên/);
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

// ===== Chế độ khách =====
test("khách: /start chào kèm lệnh và nút website; mã lạ không bị coi là mã liên kết", async () => {
  await reset();
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(500, "/start"));
  assert.match(tg.sent[0].text, /Xin chào/);
  assert.match(tg.sent[0].text, /\/trong/);
  assert.match(tg.sent[0].extra.reply_markup.inline_keyboard[0][0].url, /nhago\.web\.app/);
  await bot.handleUpdate(msg(500, "/start xyz"));
  assert.match(tg.sent[1].text, /Xin chào/);
});

test("khách: /trong có khoảng ngày → phòng trống, giá, tạm tính và nút đặt có ngày điền sẵn", async () => {
  await reset();
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(500, "/trong 20/11 22/11")); // r1 đang bị giữ chỗ (pending b1) 20→22/11
  assert.match(tg.sent[0].text, /còn 1\/2/);
  assert.doesNotMatch(tg.sent[0].text, /Phòng gỗ 1/);
  assert.match(tg.sent[0].text, /Phòng gỗ 2 — 600\.000 VNĐ\/đêm \(≈ 1\.200\.000 VNĐ\)/);
  assert.match(tg.sent[0].extra.reply_markup.inline_keyboard[0][0].url, /\?checkIn=2026-11-20&checkOut=2026-11-22#booking$/);
  assert.doesNotMatch(tg.sent[0].text, /An|090|k@x/); // không lộ thông tin khách
});

test("khách: /trong kiểm tra ngày sai", async () => {
  await reset();
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(500, "/trong 01/11/2026")); // đã qua (hôm nay 10/11/2026)
  assert.match(tg.sent[0].text, /đã qua/);
  await bot.handleUpdate(msg(500, "/trong 25/12/2026 20/12/2026"));
  assert.match(tg.sent[1].text, /sau ngày nhận/);
  await bot.handleUpdate(msg(500, "/trong 01/12 05/02"));
  assert.match(tg.sent[2].text, /Tối đa 30 đêm/);
  await bot.handleUpdate(msg(500, "/trong a b c"));
  assert.match(tg.sent[3].text, /tối đa 2 ngày/);
});

test("khách: hết phòng thì báo hết", async () => {
  await reset();
  await db.doc("busy/x2").set({ roomId: "r2", checkIn: "2026-12-01", checkOut: "2026-12-05", status: "confirmed" });
  await db.doc("busy/x1").set({ roomId: "r1", checkIn: "2026-12-01", checkOut: "2026-12-05", status: "confirmed" });
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(500, "/trong 02/12 03/12"));
  assert.match(tg.sent[0].text, /còn 0\/2/);
  assert.match(tg.sent[0].text, /hết phòng/);
});

test("khách: /phong, /lienhe, /dat", async () => {
  await reset();
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(500, "/phong"));
  assert.match(tg.sent[0].text, /Phòng gỗ 1/);
  assert.match(tg.sent[0].text, /500\.000 VNĐ\/đêm/);
  await bot.handleUpdate(msg(500, "/lienhe"));
  assert.match(tg.sent[1].text, /Nhà Gỗ Homestay/);
  assert.match(tg.sent[1].text, /chưa cập nhật/); // chưa có settings/contact
  await bot.handleUpdate(msg(500, "/dat 25/12 27/12"));
  assert.match(tg.sent[2].extra.reply_markup.inline_keyboard[0][0].url, /checkIn=2026-12-25&checkOut=2026-12-27/);
});

test("giới hạn tần suất: khách quá 6 tin/phút bị chặn, báo đúng một lần, rồi im lặng", async () => {
  await reset();
  const { tg, bot } = mk();
  for (let i = 0; i < 10; i++) await bot.handleUpdate(msg(600, "/lienhe"));
  assert.equal(tg.sent.filter((x) => /Nhà Gỗ Homestay/.test(x.text)).length, 6);
  assert.equal(tg.sent.filter((x) => /quá nhanh/.test(x.text)).length, 1);
  assert.equal(tg.sent.length, 7); // 6 trả lời + 1 cảnh báo; các tin còn lại không trả lời
});

test("giới hạn theo ngày: vượt 80 tin/ngày bị chặn", async () => {
  await reset();
  await db.doc("tgRate/700").set({ minKey: 0, minN: 0, dayKey: "2026-11-10", dayN: 80, warnedKey: "" });
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(700, "/lienhe"));
  assert.match(tg.sent[0].text, /quá nhiều hôm nay/);
  await bot.handleUpdate(msg(700, "/lienhe"));
  assert.equal(tg.sent.length, 1);
});

test("giới hạn trong bộ nhớ: lũ tin nhắn bị bỏ qua mà không chạm Firestore", async () => {
  await reset();
  const { tg, bot } = mk();
  for (let i = 0; i < 40; i++) await bot.handleUpdate(msg(800, "/lienhe"));
  assert.equal(tg.sent.length, 7); // 6 + cảnh báo; từ tin thứ 21 trở đi bỏ qua ngay
  const rate = (await db.doc("tgRate/800").get()).data();
  assert.ok(rate.minN <= 20, "Firestore chỉ đếm tối đa 20 tin trước khi chặn bằng bộ nhớ");
});

test("nhân viên đã liên kết không bị giới hạn kiểu khách (chỉ giới hạn bộ nhớ 20/phút)", async () => {
  await reset();
  const { tg, bot } = mk();
  for (let i = 0; i < 15; i++) await bot.handleUpdate(msg(111, "/phong"));
  assert.equal(tg.sent.length, 15);
  assert.equal((await db.doc("tgRate/111").get()).exists, false);
});

test("khách: ngày không ghi năm lấy lần tới (qua năm mới)", async () => {
  await reset();
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(500, "/trong 30/12 02/01"));
  assert.match(tg.sent[0].text, /30\/12\/2026 → 02\/01\/2027<\/b> \(3 đêm\)/);
  await bot.handleUpdate(msg(500, "/trong 05/01"));
  assert.match(tg.sent[1].text, /05\/01\/2027 → 06\/01\/2027/);
});

test("khách: /lienhe đọc settings/contact, bỏ mục trống, escape HTML, chỉ nhận đường dẫn http(s)", async () => {
  await reset();
  await db.doc("settings/contact").set({ phone: "0901 234 567", zalo: "", email: "a<b>@x.vn", address: "12 Đường Thông, Đà Lạt", facebook: "javascript:alert(1)", mapUrl: "https://maps.app.goo.gl/abc" });
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(500, "/lienhe"));
  const t = tg.sent[0].text;
  assert.match(t, /0901 234 567/);
  assert.match(t, /12 Đường Thông/);
  assert.match(t, /a&lt;b&gt;@x\.vn/);
  assert.match(t, /maps\.app\.goo\.gl/);
  assert.doesNotMatch(t, /Zalo/);
  assert.doesNotMatch(t, /javascript/);
});

test("đặt cọc: thông báo có số tiền cọc + mã chuyển khoản + nút Đã nhận cọc; bấm nút ghi nhận thanh toán", async () => {
  await reset();
  await db.doc("bookings/b1").update({ deposit: 300000 });
  const { tg, bot } = mk();
  await bot.notify("cus", { type: "booking", id: "b1" });
  assert.match(tg.sent[0].text, /Cọc: 300\.000 VNĐ/);
  assert.match(tg.sent[0].text, /NHAGO B1/);
  const rows = tg.sent[0].extra.reply_markup.inline_keyboard;
  assert.equal(rows[1][0].callback_data, "pd:b1");
  const cb = press(111, "pd:b1");
  cb.callback_query.message.reply_markup = { inline_keyboard: rows };
  await bot.handleUpdate(cb);
  const b = (await db.doc("bookings/b1").get()).data();
  assert.equal(b.paid, 300000);
  assert.equal(b.payLog.length, 1);
  assert.equal(b.payLog[0].amount, 300000);
  assert.equal(b.status, "pending"); // chỉ ghi nhận cọc, chưa xác nhận
  assert.match(tg.edits[0].text, /Đã ghi nhận cọc/);
  assert.equal(tg.edits[0].extra.reply_markup.inline_keyboard.length, 1); // còn nút Xác nhận/Từ chối
  await bot.handleUpdate(press(111, "pd:b1"));
  assert.match(tg.answers.at(-1).text, /đã nhận đủ cọc/);
  assert.equal((await db.doc("bookings/b1").get()).data().paid, 300000);
});

test("nút Đã nhận cọc không dùng được từ chat chưa liên kết", async () => {
  await reset();
  await db.doc("bookings/b1").update({ deposit: 300000 });
  const { bot } = mk();
  await bot.handleUpdate(press(999, "pd:b1"));
  assert.equal((await db.doc("bookings/b1").get()).data().paid, undefined);
});
