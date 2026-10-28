"use strict";
// Lệnh nhân viên mở rộng (/taodat, /phongban, /baocao), báo cáo 21:00 và thông báo đẩy. Chạy với Firestore Emulator.
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { createBot } = require("../bot");
const { createPush } = require("../push");

if (!getApps().length) initializeApp({ projectId: "demo-nhago" });
const db = getFirestore();
const NOW = new Date("2026-11-10T14:00:00Z"); // 21:00 giờ Việt Nam, thứ Ba 10/11

function fakeTg() {
  const sent = [];
  return { sent, getMe: async () => ({ username: "nhagobot" }), sendMessage: async (chat, text, extra) => { sent.push({ chat: String(chat), text, extra }); return {}; }, editMessageText: async () => ({}), answerCallbackQuery: async () => true };
}
const mk = (push) => { const tg = fakeTg(); return { tg, bot: createBot({ db, tg, now: () => NOW, push }) }; };
const msg = (chat, text) => ({ message: { chat: { id: chat, type: "private" }, from: { first_name: "Chủ" }, text } });

async function reset() {
  for (const c of ["users", "rooms", "bookings", "busy", "pend", "tgChats", "tgGuests", "tgSent", "tgRate", "settings", "roomStatus", "fcmTokens"]) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  await db.doc("users/own").set({ role: "owner", email: "chu@x.vn" });
  await db.doc("users/rec").set({ role: "reception", email: "lt@x.vn" });
  await db.doc("users/hk").set({ role: "housekeeping", email: "hk@x.vn" });
  await db.doc("rooms/r1").set({ name: "Phòng gỗ 1", price: 500000, capacity: 2, status: "active" });
  await db.doc("rooms/r2").set({ name: "Phòng gỗ 2", price: 600000, capacity: 4, status: "active" });
  await db.doc("tgChats/111").set({ uid: "own", role: "owner", email: "chu@x.vn" });
  await db.doc("tgChats/222").set({ uid: "rec", role: "reception", email: "lt@x.vn" });
  await db.doc("settings/booking").set({ depositPercent: 30 });
}

test("/taodat: tạo đặt phòng đã xác nhận, giá theo bảng giá, giữ phòng trong busy", async () => {
  await reset();
  const { bot, tg } = mk();
  await bot.handleUpdate(msg(222, "/taodat P1 25/11 2 2 Nguyễn Văn A 0909123456"));
  assert.match(tg.sent[0].text, /Đã tạo đặt phòng/);
  assert.match(tg.sent[0].text, /1\.000\.000/);
  const [d] = (await db.collection("bookings").get()).docs;
  const b = d.data();
  assert.deepEqual([b.roomId, b.guestName, b.phone, b.checkIn, b.checkOut, b.guests, b.total, b.deposit, b.status, b.source, b.createdBy], ["r1", "Nguyễn Văn A", "0909123456", "2026-11-25", "2026-11-27", 2, 1000000, 300000, "confirmed", "staff", "rec"]);
  assert.equal(b.code, d.id.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase());
  assert.equal((await db.doc(`busy/${d.id}`).get()).data().status, "confirmed");
  // Trùng lịch: bị từ chối, không tạo thêm.
  await bot.handleUpdate(msg(222, "/taodat phòng gỗ 1 26/11 1 2 B 0909123456".replace("phòng gỗ 1", "P1")));
  assert.match(tg.sent[1].text, /đã có đặt phòng/);
  assert.equal((await db.collection("bookings").get()).size, 1);
});

test("/taodat: nhận phòng theo tên duy nhất; sai cú pháp/phòng/sức chứa/ngày được báo rõ; khách thường không dùng được", async () => {
  await reset();
  const { bot, tg } = mk();
  await bot.handleUpdate(msg(111, "/taodat"));
  assert.match(tg.sent[0].text, /Cú pháp/); assert.match(tg.sent[0].text, /P1<\/b> = Phòng gỗ 1/);
  await bot.handleUpdate(msg(111, "/taodat gỗ 25/11 1 2 An 0909123456")); // "gỗ" khớp cả hai phòng
  assert.match(tg.sent[1].text, /Không xác định được phòng/);
  await bot.handleUpdate(msg(111, "/taodat P1 25/11 1 5 An 0909123456")); // P1 chứa 2
  assert.match(tg.sent[2].text, /tối đa 2 khách/);
  await bot.handleUpdate(msg(111, "/taodat P2 01/01/2020 1 2 An 0909123456"));
  assert.match(tg.sent[3].text, /chưa hợp lệ/);
  await bot.handleUpdate(msg(111, "/taodat P2 25/11 1 2 An 12"));
  assert.match(tg.sent[4].text, /chưa hợp lệ/);
  await bot.handleUpdate(msg(111, "/taodat 2 25/11 1 2 An 0909123456")); // "2" khớp "Phòng gỗ 2" duy nhất
  assert.match(tg.sent[5].text, /Đã tạo đặt phòng/);
  await bot.handleUpdate(msg(999, "/taodat P1 25/11 1 2 An 0909123456"));
  assert.match(tg.sent[6].text, /dành cho nhân viên/);
  assert.equal((await db.collection("bookings").get()).size, 1);
});

test("/phongban: liệt kê phòng bẩn/đang dọn với nút; không còn thì báo sẵn sàng", async () => {
  await reset();
  const { bot, tg } = mk();
  await bot.handleUpdate(msg(111, "/phongban"));
  assert.match(tg.sent[0].text, /sẵn sàng/);
  await db.doc("roomStatus/r1").set({ status: "dirty" });
  await db.doc("roomStatus/r2").set({ status: "cleaning" });
  await bot.handleUpdate(msg(111, "/phongban"));
  assert.equal(tg.sent.length, 3);
  assert.equal(tg.sent[1].extra.reply_markup.inline_keyboard[0][0].callback_data, "rd:r1");
  assert.match(tg.sent[2].text, /đang dọn/);
});

test("/baocao và báo cáo 21:00: nhận/trả phòng, doanh thu hôm nay, ngày mai, việc tồn; chỉ gửi chủ/quản lý", async () => {
  await reset();
  const bk = { roomId: "r1", phone: "1", guests: 2 };
  await db.doc("bookings/a").set({ ...bk, guestName: "Đến Nay", checkIn: "2026-11-10", checkOut: "2026-11-12", total: 1000000, status: "checked_in" });
  await db.doc("bookings/b").set({ ...bk, roomId: "r2", guestName: "Đi Nay", checkIn: "2026-11-08", checkOut: "2026-11-10", total: 1200000, status: "checked_out" });
  await db.doc("bookings/c").set({ ...bk, guestName: "Mai Đến", checkIn: "2026-11-11", checkOut: "2026-11-12", total: 500000, status: "confirmed", deposit: 150000, paid: 0 });
  await db.doc("bookings/d").set({ ...bk, guestName: "Chờ", checkIn: "2026-11-20", checkOut: "2026-11-21", total: 1, status: "pending" });
  await db.doc("roomStatus/r2").set({ status: "dirty" });
  const { bot, tg } = mk();
  await bot.handleUpdate(msg(222, "/baocao"));
  const t = tg.sent[0].text;
  assert.match(t, /Báo cáo ngày 10\/11\/2026/);
  assert.match(t, /Nhận phòng hôm nay: 1/); assert.match(t, /Trả phòng: 1/);
  assert.match(t, /1\.200\.000 VNĐ/);
  assert.match(t, /Mai Đến.*chưa đủ cọc/);
  assert.match(t, /chờ xác nhận: 1/); assert.match(t, /Phòng cần dọn: 1/);
  const r = await bot.dailyReport();
  assert.equal(r.sent, 1); // chỉ chủ (111); lễ tân 222 không nhận báo cáo tự động
  assert.equal(tg.sent.at(-1).chat, "111");
});

function fakeMessaging(failFor = []) {
  const calls = [];
  return { calls, sendEachForMulticast: async (m) => { calls.push(m); return { successCount: m.tokens.length - failFor.length, responses: m.tokens.map((t) => (failFor.includes(t) ? { success: false, error: { code: "messaging/registration-token-not-registered" } } : { success: true })) }; } };
}

test("push: gửi tới thiết bị nhân viên, bỏ token của người hết quyền, xóa token hết hiệu lực", async () => {
  await reset();
  await db.doc("fcmTokens/tokOwn").set({ uid: "own", ua: "x", at: Timestamp.now() });
  await db.doc("fcmTokens/tokRec").set({ uid: "rec", ua: "x", at: Timestamp.now() });
  await db.doc("fcmTokens/tokHk").set({ uid: "hk", ua: "x", at: Timestamp.now() }); // housekeeping: không thuộc nhóm nhận
  const m = fakeMessaging(["tokRec"]);
  const r = await createPush({ db, messaging: m }).send({ title: "Nhà Gỗ", body: "Yêu cầu mới", url: "/app/bookings" });
  assert.equal(r.sent, 1);
  assert.deepEqual(m.calls[0].tokens.sort(), ["tokOwn", "tokRec"]);
  assert.deepEqual(m.calls[0].data, { title: "Nhà Gỗ", body: "Yêu cầu mới", url: "/app/bookings" });
  assert.equal((await db.doc("fcmTokens/tokHk").get()).exists, false, "token người không đủ quyền bị xóa");
  assert.equal((await db.doc("fcmTokens/tokRec").get()).exists, false, "token hết hiệu lực bị xóa");
  assert.equal((await db.doc("fcmTokens/tokOwn").get()).exists, true);
});

test("notify gửi kèm thông báo đẩy rút gọn (không HTML)", async () => {
  await reset();
  await db.doc("roomStatus/r1").set({ status: "dirty", updatedAt: Timestamp.now() });
  const pushed = [];
  const { bot } = mk({ send: async (p) => { pushed.push(p); return {}; } });
  assert.equal((await bot.notify("hk", { type: "dirty", id: "r1" })).sent, 2);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(pushed.length, 1);
  assert.match(pushed[0].body, /Phòng gỗ 1 vừa trả phòng, cần dọn/);
  assert.doesNotMatch(pushed[0].body, /<b>/);
  assert.equal(pushed[0].url, "/app");
});
