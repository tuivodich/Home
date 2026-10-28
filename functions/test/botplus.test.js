"use strict";
// Lệnh mở rộng của bot, thông báo buồng phòng và nhắc việc tự động. Chạy với Firestore Emulator (xem bot.test.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, Timestamp } = require("firebase-admin/firestore");
const { createBot } = require("../bot");
const pricing = require("../pricing");

if (!getApps().length) initializeApp({ projectId: "demo-nhago" });
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
const NOW = new Date("2026-11-10T03:00:00Z"); // Thứ Ba 10:00 giờ Việt Nam
const mk = (now = NOW) => { const tg = fakeTg(); return { tg, bot: createBot({ db, tg, now: () => now, randomCode: () => "ABCD1234" }) }; };
const msg = (chat, text) => ({ message: { chat: { id: chat, type: "private" }, from: { first_name: "Chủ" }, text } });
const press = (chat, data) => ({ callback_query: { id: "cb1", data, from: { first_name: "Chủ" }, message: { message_id: 9, text: "Tin", chat: { id: chat } } } });

async function reset() {
  for (const c of ["users", "rooms", "bookings", "busy", "pend", "tgChats", "tgLinks", "tgSent", "tgRate", "settings", "schedule", "shifts", "attendance", "guests", "roomStatus", "expenses"]) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  await db.doc("users/own").set({ role: "owner", email: "chu@x.vn" });
  await db.doc("users/rec").set({ role: "reception", email: "lt@x.vn" });
  await db.doc("users/hk").set({ role: "housekeeping", email: "hk@x.vn" });
  await db.doc("users/cus").set({ role: "customer", email: "k@x.vn" });
  await db.doc("rooms/r1").set({ name: "Phòng gỗ 1", price: 500000, capacity: 2, status: "active" });
  await db.doc("rooms/r2").set({ name: "Phòng gỗ 2", price: 600000, capacity: 4, status: "active" });
  await db.doc("tgChats/111").set({ uid: "own", role: "owner", email: "chu@x.vn" });
  await db.doc("tgChats/222").set({ uid: "rec", role: "reception", email: "lt@x.vn" });
}

test("/gia: báo giá theo đêm, khách, phụ thu cuối tuần/thêm khách, cọc; bỏ phòng kín và phòng không đủ chỗ", async () => {
  await reset();
  await db.doc("settings/pricing").set({ weekendDays: [5, 6], weekendPercent: 20 });
  await db.doc("settings/booking").set({ depositPercent: 30, extraGuestFee: 100000 });
  await db.doc("busy/x").set({ roomId: "r2", checkIn: "2026-11-12", checkOut: "2026-11-14", status: "confirmed" });
  const { tg, bot } = mk();
  // 13/11 (Thứ Sáu) và 14/11 (Thứ Bảy) đều tính +20%; r2 kín đêm 13.
  await bot.handleUpdate(msg(900, "/gia 2 2 13/11"));
  const t = tg.sent[0].text;
  assert.match(t, /Báo giá 2 đêm, 2 khách/);
  assert.match(t, /Phòng gỗ 1/);
  assert.doesNotMatch(t, /Phòng gỗ 2/);
  assert.match(t, /1\.200\.000/); // 2 × 600.000
  assert.match(t, /Cọc 30%: 360\.000/);
  await bot.handleUpdate(msg(900, "/gia 1 3 20/11")); // 3 khách: chỉ r2 (sức chứa 4), phụ thu 1 khách = 100.000
  assert.match(tg.sent[1].text, /Phòng gỗ 2/);
  assert.doesNotMatch(tg.sent[1].text, /Phòng gỗ 1/);
});

test("/gia: tham số sai trả hướng dẫn; quá sức chứa báo rõ", async () => {
  await reset();
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(901, "/gia"));
  await bot.handleUpdate(msg(901, "/gia 2"));
  await bot.handleUpdate(msg(901, "/gia 0 2"));
  await bot.handleUpdate(msg(901, "/gia 2 2 01/01/2020"));
  for (const s of tg.sent) assert.match(s.text, /Cú pháp|từ 1 đến 30|không hợp lệ/);
  await bot.handleUpdate(msg(902, "/gia 2 9"));
  assert.match(tg.sent.at(-1).text, /vượt sức chứa/);
});

test("/diachi: dùng đường dẫn bản đồ đã nhập, không có thì tự tạo từ địa chỉ", async () => {
  await reset();
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(903, "/diachi"));
  assert.match(tg.sent[0].text, /chưa cập nhật địa chỉ/);
  await db.doc("settings/contact").set({ address: "Thôn 1, Đà Lạt" });
  await bot.handleUpdate(msg(903, "/diachi"));
  assert.match(tg.sent[1].text, /Thôn 1, Đà Lạt/);
  assert.match(tg.sent[1].extra.reply_markup.inline_keyboard[0][0].url, /google\.com\/maps\/search\/\?api=1&query=Th%C3%B4n/);
  await db.doc("settings/contact").set({ address: "Thôn 1", mapUrl: "https://maps.app.goo.gl/abc" });
  await bot.handleUpdate(msg(903, "/diachi"));
  assert.equal(tg.sent[2].extra.reply_markup.inline_keyboard[0][0].url, "https://maps.app.goo.gl/abc");
});

test("/tiennghi và /chinhsach", async () => {
  await reset();
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(904, "/tiennghi"));
  assert.match(tg.sent[0].text, /Wifi/);
  await db.doc("settings/booking").set({ depositPercent: 30, checkInTime: "15:00", checkOutTime: "11:00", cancelNote: "Báo trước nếu đến muộn.", cancelTiers: [{ daysBefore: 7, refundPercent: 100 }, { daysBefore: 0, refundPercent: 0 }] });
  await bot.handleUpdate(msg(904, "/chinhsach"));
  const t = tg.sent[1].text;
  assert.match(t, /15:00/); assert.match(t, /11:00/);
  assert.match(t, /cọc 30%/); assert.match(t, /Từ 7 ngày trở lên: hoàn 100%/);
  assert.match(t, /Báo trước nếu đến muộn/);
});

test("/tra: tra theo mã, không lộ họ tên/điện thoại/email/ghi chú; hỗ trợ đặt phòng cũ chưa có mã", async () => {
  await reset();
  await db.doc("bookings/AbCd1234XyZ").set({ roomId: "r1", guestName: "Nguyễn Văn Bí Mật", phone: "0909000111", email: "bimat@x.vn", note: "ghi chú riêng", checkIn: "2026-11-20", checkOut: "2026-11-22", guests: 2, total: 1000000, deposit: 300000, paid: 0, status: "confirmed", code: "ABCD1234" });
  await db.doc("bookings/OldBooking99").set({ roomId: "r2", guestName: "Cũ", phone: "0900", checkIn: "2026-11-25", checkOut: "2026-11-26", guests: 1, total: 1, status: "pending" });
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(905, "/tra abcd1234"));
  const t = tg.sent[0].text;
  assert.match(t, /ABCD1234/); assert.match(t, /đã xác nhận/); assert.match(t, /Phòng gỗ 1/); assert.match(t, /chưa nhận đủ cọc/);
  for (const secret of ["Bí Mật", "0909000111", "bimat@x.vn", "ghi chú riêng"]) assert.doesNotMatch(t, new RegExp(secret));
  await bot.handleUpdate(msg(905, "/tra NHAGO OLDBOOKI"));
  assert.match(tg.sent[1].text, /đang chờ xác nhận/);
  await bot.handleUpdate(msg(905, "/tra ZZZZ9999"));
  assert.match(tg.sent[2].text, /Không tìm thấy/);
  await bot.handleUpdate(msg(905, "/tra"));
  assert.match(tg.sent[3].text, /Cú pháp/);
});

test("/homnay có số yêu cầu chờ; /doanhthu chỉ chủ/quản lý và tính đúng", async () => {
  await reset();
  await db.doc("bookings/p1").set({ roomId: "r1", guestName: "A", phone: "1", checkIn: "2026-11-20", checkOut: "2026-11-21", guests: 1, total: 1, status: "pending" });
  await db.doc("bookings/d1").set({ roomId: "r1", guestName: "B", phone: "1", checkIn: "2026-11-09", checkOut: "2026-11-10", guests: 1, total: 800000, status: "checked_out" }); // tuần này (Thứ Hai 09/11)
  await db.doc("bookings/d2").set({ roomId: "r2", guestName: "C", phone: "1", checkIn: "2026-11-01", checkOut: "2026-11-03", guests: 1, total: 1200000, status: "checked_out" }); // tháng này, không phải tuần này
  await db.doc("expenses/e1").set({ date: "2026-11-09", amount: 200000, category: "dien", paid: true });
  const { tg, bot } = mk();
  await bot.handleUpdate(msg(111, "/homnay"));
  assert.match(tg.sent[0].text, /chờ xác nhận: 1/);
  await bot.handleUpdate(msg(111, "/doanhthu"));
  assert.match(tg.sent[1].text, /Tuần 09\/11\/2026/);
  assert.match(tg.sent[1].text, /800\.000 VNĐ/);
  assert.match(tg.sent[1].text, /Chi phí: 200\.000/);
  assert.match(tg.sent[1].text, /Lợi nhuận tạm tính: <b>600\.000/);
  await bot.handleUpdate(msg(111, "/doanhthu thang"));
  assert.match(tg.sent[2].text, /Tháng 11\/2026/);
  assert.match(tg.sent[2].text, /2\.000\.000 VNĐ/);
  await bot.handleUpdate(msg(222, "/doanhthu")); // lễ tân
  assert.match(tg.sent[3].text, /chỉ dành cho chủ và quản lý/);
  await bot.handleUpdate(msg(999, "/doanhthu")); // chưa liên kết
  assert.match(tg.sent[4].text, /dành cho nhân viên/);
});

test("buồng phòng: báo bẩn tới nhân viên một lần, nút Đã dọn xong đưa về sẵn sàng", async () => {
  await reset();
  await db.doc("roomStatus/r1").set({ status: "dirty", updatedAt: Timestamp.fromDate(NOW), updatedBy: "hk", updatedByName: "HK" });
  const { tg, bot } = mk();
  assert.equal((await bot.notify("cus", { type: "dirty", id: "r1" })).sent, 0); // khách không báo được
  assert.equal((await bot.notify("hk", { type: "dirty", id: "r2" })).sent, 0); // phòng chưa bẩn
  assert.equal((await bot.notify("hk", { type: "dirty", id: "r1" })).sent, 2);
  assert.equal((await bot.notify("hk", { type: "dirty", id: "r1" })).sent, 0); // trùng
  assert.match(tg.sent[0].text, /Phòng gỗ 1/);
  assert.equal(tg.sent[0].extra.reply_markup.inline_keyboard[0][0].callback_data, "rd:r1");
  await bot.handleUpdate(press(999, "rd:r1")); // chat lạ
  assert.equal((await db.doc("roomStatus/r1").get()).data().status, "dirty");
  await bot.handleUpdate(press(222, "rd:r1"));
  const rs = (await db.doc("roomStatus/r1").get()).data();
  assert.equal(rs.status, "ready"); assert.equal(rs.updatedBy, "rec");
  assert.match(tg.edits[0].text, /đã dọn xong/);
  await bot.handleUpdate(press(111, "rd:r1"));
  assert.match(tg.answers.at(-1).text, /đã được đánh dấu sẵn sàng/);
});

test("cảnh báo chấm công: đi muộn và quên ra ca, chỉ gửi quản lý và chỉ một lần", async () => {
  await reset();
  await db.doc("shifts/s1").set({ name: "Ca sáng", start: "08:00", end: "09:30", active: true }); // 09:30 đã qua lúc 10:00 + 60' chưa → chưa quên
  await db.doc("shifts/s2").set({ name: "Ca chiều", start: "09:30", end: "17:00", active: true }); // bắt đầu 09:30, trễ 30'
  await db.doc("schedule/2026-11-10_a").set({ date: "2026-11-10", uid: "a", name: "Lan", shiftId: "s2" });
  await db.doc("schedule/2026-11-10_b").set({ date: "2026-11-10", uid: "b", name: "Minh", shiftId: "s1" });
  await db.doc("attendance/b1").set({ uid: "b", name: "Minh", date: "2026-11-10", in: Timestamp.fromDate(new Date("2026-11-10T01:00:00Z")), source: "self" }); // vào 08:00, chưa ra
  const { tg, bot } = mk();
  let r = await bot.staffAlerts();
  assert.equal(r.alerts, 1); // Lan muộn; Minh chưa quên (hết ca 09:30 + 60' = 10:30)
  assert.match(tg.sent[0].text, /Lan/); assert.match(tg.sent[0].text, /chưa vào ca/);
  assert.deepEqual(tg.sent.map((x) => x.chat), ["111"]); // lễ tân không nhận
  r = await bot.staffAlerts();
  assert.equal(r.alerts, 0); // đã báo rồi
  const later = mk(new Date("2026-11-10T04:00:00Z")); // 11:00
  r = await later.bot.staffAlerts();
  assert.equal(r.alerts, 1);
  assert.match(later.tg.sent[0].text, /Minh/); assert.match(later.tg.sent[0].text, /chưa ra ca/);
});

test("cảnh báo chấm công: đã vào ca hoặc ca chưa tới giờ thì không báo", async () => {
  await reset();
  await db.doc("shifts/s1").set({ name: "Ca chiều", start: "14:00", end: "22:00", active: true });
  await db.doc("schedule/2026-11-10_a").set({ date: "2026-11-10", uid: "a", name: "Lan", shiftId: "s1" });
  const { bot } = mk();
  assert.equal((await bot.staffAlerts()).alerts, 0); // chưa tới 14:15
  await db.doc("shifts/s1").update({ start: "09:00" });
  await db.doc("attendance/a1").set({ uid: "a", name: "Lan", date: "2026-11-10", in: Timestamp.fromDate(new Date("2026-11-10T02:00:00Z")), source: "self" });
  assert.equal((await mk().bot.staffAlerts()).alerts, 0); // đã vào ca
});

test("nhắc quản lý: sắp nhận phòng chưa cọc và trả phòng chưa có hồ sơ, mỗi việc một lần", async () => {
  await reset();
  const bk = { roomId: "r1", phone: "0900", guests: 2, total: 1000000 };
  await db.doc("bookings/dep1").set({ ...bk, guestName: "Cần Cọc", checkIn: "2026-11-11", checkOut: "2026-11-12", status: "confirmed", deposit: 300000, paid: 0 });
  await db.doc("bookings/dep2").set({ ...bk, guestName: "Đủ Cọc", checkIn: "2026-11-11", checkOut: "2026-11-12", status: "confirmed", deposit: 300000, paid: 300000 });
  await db.doc("bookings/dep3").set({ ...bk, guestName: "Xa Quá", checkIn: "2026-11-20", checkOut: "2026-11-21", status: "confirmed", deposit: 300000, paid: 0 });
  await db.doc("bookings/out1").set({ ...bk, guestName: "Chưa Hồ Sơ", checkIn: "2026-11-08", checkOut: "2026-11-09", status: "checked_out" });
  await db.doc("bookings/out2").set({ ...bk, guestName: "Có Hồ Sơ", checkIn: "2026-11-08", checkOut: "2026-11-09", status: "checked_out" });
  await db.doc("guests/g1").set({ bookingId: "out2", fullName: "Có Hồ Sơ" });
  const { tg, bot } = mk();
  const r = await bot.dailyReminders();
  assert.deepEqual([r.deposit, r.noProfile], [1, 1]);
  const all = tg.sent.map((x) => x.text).join("\n");
  assert.match(all, /Cần Cọc/); assert.match(all, /Chưa Hồ Sơ/);
  for (const n of ["Đủ Cọc", "Xa Quá", "Có Hồ Sơ"]) assert.doesNotMatch(all, new RegExp(n));
  assert.deepEqual([...new Set(tg.sent.map((x) => x.chat))], ["111"]);
  assert.equal(tg.sent.find((x) => /Cần Cọc/.test(x.text)).extra.reply_markup.inline_keyboard[0][0].callback_data, "pd:dep1");
  const again = await mk().bot.dailyReminders();
  assert.deepEqual([again.deposit, again.noProfile], [0, 0]);
});

test("pricing.js cho cùng kết quả với src/lib/pricing.ts", async (t) => {
  let ts;
  try { ts = await import("../../src/lib/pricing.ts"); } catch { return t.skip("Node này chưa đọc được .ts"); }
  const rawP = { weekendDays: [5, 6], weekendPercent: 15, seasons: [{ name: "Hè", from: "2026-12-01", to: "2026-12-31", percent: 25 }], holidays: [{ name: "Tết", from: "2027-02-05", to: "2027-02-12", percent: 60 }], longStay: [{ minNights: 3, percent: -5 }, { minNights: 7, percent: -12 }] };
  const rawB = { depositPercent: 30, extraGuestFee: 90000, cancelTiers: [{ daysBefore: 7, refundPercent: 100 }] };
  const room = { price: 730000, capacity: 4, baseGuests: 2 };
  for (const [ci, n, g] of [["2026-11-12", 1, 2], ["2026-11-12", 4, 3], ["2026-12-30", 3, 4], ["2027-02-10", 8, 2], ["2026-11-01", 10, 1]]) {
    const co = new Date(Date.parse(`${ci}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
    const a = ts.quoteStay(room, ci, co, g, ts.parsePricing(rawP), ts.parseBookingCfg(rawB));
    const b = pricing.quote(room, ci, n, g, pricing.parsePricing(rawP), pricing.parseBooking(rawB));
    assert.deepEqual({ total: b.total, deposit: b.deposit }, { total: a.total, deposit: a.deposit }, `${ci} ${n} đêm ${g} khách`);
  }
});
