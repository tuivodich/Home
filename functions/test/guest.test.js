"use strict";
// Kiểm tra giá phía máy chủ, email/Telegram cho khách, liên kết Telegram của khách. Chạy với Firestore Emulator.
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { createGuest, createMailer } = require("../guest");
const { createBot } = require("../bot");
const pricing = require("../pricing");

if (!getApps().length) initializeApp({ projectId: "demo-nhago" });
const db = getFirestore();
const NOW = new Date("2026-11-10T03:00:00Z"); // 10:00 giờ Việt Nam

function fakeTg() {
  const sent = [];
  return { sent, getMe: async () => ({ username: "nhagobot" }), sendMessage: async (chat, text, extra) => { sent.push({ chat: String(chat), text, extra }); return {}; }, editMessageText: async () => ({}), answerCallbackQuery: async () => true };
}
function fakeMailer(enabled = true) {
  const mails = [];
  return { mails, enabled, from: "nhago@x.vn", send: async (m) => { mails.push(m); return true; } };
}
const mk = (mailer = fakeMailer()) => { const tg = fakeTg(); const guest = createGuest({ db, tg, mailer, now: () => NOW }); return { tg, mailer, guest, bot: createBot({ db, tg, now: () => NOW, randomCode: () => "GUEST123", guest }) }; };
const msg = (chat, text) => ({ message: { chat: { id: chat, type: "private" }, from: { first_name: "Lan" }, text } });

async function reset() {
  for (const c of ["users", "rooms", "bookings", "busy", "pend", "tgChats", "tgGuests", "tgLinks", "tgSent", "tgRate", "settings", "coupons"]) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  await db.doc("users/cus").set({ role: "customer", email: "khach@x.vn" });
  await db.doc("users/own").set({ role: "owner", email: "chu@x.vn" });
  await db.doc("rooms/r1").set({ name: "Phòng gỗ 1", price: 500000, capacity: 2, status: "active" });
  await db.doc("tgChats/111").set({ uid: "own", role: "owner", email: "chu@x.vn" });
  await db.doc("settings/pricing").set({ weekendDays: [5, 6], weekendPercent: 20, longStay: [{ minNights: 3, percent: -10 }] });
  await db.doc("settings/booking").set({ depositPercent: 30, extraGuestFee: 100000, earlyCheckInFee: 150000, services: [{ id: "bbq", name: "BBQ", price: 200000, unit: "once", active: true }] });
  await db.doc("settings/bank").set({ bankBin: "970422", bankName: "MB Bank", accountNo: "0123456789", accountName: "NHA GO" });
  await db.doc("settings/mail").set({ enabled: true });
  await db.doc("settings/mailState").set({ baselined: true });
}
const base = { roomId: "r1", guestName: "An <b>", phone: "090", email: "khach@x.vn", guests: 2, status: "pending", note: "", source: "online", createdBy: "cus", code: "ABCD1234", checkIn: "2026-11-20", checkOut: "2026-11-22" };
// 20/11 thứ Sáu và 21/11 thứ Bảy: +20% mỗi đêm → 600.000 × 2 = 1.200.000; cọc 30% = 360.000.
const RIGHT = { total: 1200000, deposit: 360000 };

test("verifyBooking: giá đúng thì chỉ đánh dấu đã kiểm", async () => {
  await reset();
  await db.doc("bookings/b1").set({ ...base, ...RIGHT });
  const { guest } = mk();
  assert.deepEqual(await guest.verifyBooking("b1"), { checked: true, corrected: false });
  const b = (await db.doc("bookings/b1").get()).data();
  assert.equal(b.priceChecked, true); assert.equal(b.total, 1200000); assert.equal(b.priceCorrected, undefined);
  assert.deepEqual(await guest.verifyBooking("b1"), { checked: false }); // chỉ kiểm một lần
});

test("verifyBooking: khách khai giá thấp (hoặc cọc sai) bị sửa theo bảng giá, ghi dấu và báo quản lý", async () => {
  await reset();
  await db.doc("bookings/b2").set({ ...base, total: 1000, deposit: 300, lines: [{ label: "x", amount: 1000 }] });
  const { guest, tg } = mk();
  const v = await guest.verifyBooking("b2");
  assert.deepEqual([v.corrected, v.from, v.to], [true, 1000, 1200000]);
  const b = (await db.doc("bookings/b2").get()).data();
  assert.equal(b.total, 1200000); assert.equal(b.deposit, 360000); assert.equal(b.priceCorrected, true); assert.equal(b.clientTotal, 1000);
  assert.ok(b.lines.some((l) => /cuối tuần \+20%/.test(l.label)), "dòng chi tiết được dựng lại");
  assert.equal(await guest.alertCorrected("b2", v), 1);
  assert.match(tg.sent[0].text, /Giá được hệ thống điều chỉnh/);
  assert.equal(tg.sent[0].chat, "111");
});

test("verifyBooking: tính cả nhận sớm, dịch vụ, thêm khách và mã giảm giá của khách", async () => {
  await reset();
  await db.doc("coupons/MB-1").set({ percent: 10, used: true, usedBy: "cus", bookingId: "b3" });
  // lodging = 1.200.000 + 1 khách thêm × 100.000 × 2 đêm = 1.400.000; giảm 10% = −140.000; + nhận sớm 150.000 + BBQ ×2 = 400.000 → 1.810.000
  await db.doc("bookings/b3").set({ ...base, guests: 3, total: 5, couponCode: "MB-1", discountPercent: 10, opts: { early: true, services: { bbq: 2, hacker: 99 } } });
  const { guest } = mk();
  const v = await guest.verifyBooking("b3");
  assert.equal(v.to, 1810000);
  const b = (await db.doc("bookings/b3").get()).data();
  assert.equal(b.originalTotal, 1950000); assert.equal(b.deposit, 543000);
});

test("verifyBooking: bỏ qua đặt phòng của nhân viên và đặt phòng không còn chờ", async () => {
  await reset();
  await db.doc("bookings/s1").set({ ...base, source: "staff", total: 1 });
  await db.doc("bookings/s2").set({ ...base, status: "confirmed", total: 1 });
  const { guest } = mk();
  assert.deepEqual(await guest.verifyBooking("s1"), { checked: false });
  assert.deepEqual(await guest.verifyBooking("s2"), { checked: false });
  assert.equal((await db.doc("bookings/s1").get()).data().total, 1);
});

test("dispatch: email đúng nội dung (mã, tiền, QR, escape HTML), chỉ một lần mỗi loại, đúng trạng thái", async () => {
  await reset();
  await db.doc("bookings/b4").set({ ...base, ...RIGHT, deposit: 360000, guestName: "An <script>" });
  const { guest, mailer } = mk();
  assert.deepEqual(await guest.dispatch("b4", "confirmed"), { email: false, telegram: 0 }); // đang chờ, chưa xác nhận
  const r = await guest.dispatch("b4", "received");
  assert.equal(r.email, true);
  const m = mailer.mails[0];
  assert.equal(m.to, "khach@x.vn");
  assert.match(m.subject, /ABCD1234/);
  assert.match(m.text, /Tổng tiền: 1\.200\.000 VNĐ/);
  assert.match(m.text, /NHAGO ABCD1234/);
  assert.match(m.html, /img\.vietqr\.io\/image\/970422-0123456789/);
  assert.match(m.html, /amount=360000/);
  assert.doesNotMatch(m.html, /<script>/);
  assert.deepEqual(await guest.dispatch("b4", "received"), { email: false, telegram: 0 }); // không gửi lặp
  await db.doc("bookings/b4").update({ status: "confirmed" });
  assert.equal((await guest.dispatch("b4", "confirmed")).email, true);
  assert.match(mailer.mails[1].subject, /đã được xác nhận/);
  await db.doc("bookings/b4").update({ status: "cancelled", cancelReason: "customer" });
  assert.equal((await guest.dispatch("b4", "cancelled")).email, false); // khách tự hủy: không email
});

test("dispatch: tắt trong cài đặt / chưa có tài khoản SMTP / email sai thì không gửi", async () => {
  await reset();
  await db.doc("bookings/b5").set({ ...base, ...RIGHT });
  await db.doc("settings/mail").set({ enabled: false });
  const a = mk();
  assert.equal((await a.guest.dispatch("b5", "received")).email, false);
  await db.doc("settings/mail").set({ enabled: true });
  await db.doc("bookings/b6").set({ ...base, ...RIGHT, email: "khong-hop-le" });
  assert.equal((await a.guest.dispatch("b6", "received")).email, false);
  await db.doc("bookings/b7").set({ ...base, ...RIGHT });
  const off = mk(createMailer({ user: "-", pass: "-" }));
  assert.equal(off.mailer.enabled, false);
  assert.equal((await off.guest.dispatch("b7", "received")).email, false);
  assert.equal(a.mailer.mails.length, 0);
});

test("liên kết Telegram của khách: /start MÃ, thông báo tới chat, /cuatoi, /huylienket", async () => {
  await reset();
  await db.doc("bookings/g1").set({ ...base, ...RIGHT, status: "confirmed" });
  const { bot, tg, guest } = mk();
  const link = await bot.guestLinkCode("cus");
  assert.match(link.link, /t\.me\/nhagobot\?start=GUEST123/);
  await bot.handleUpdate(msg(777, "/cuatoi")); // chưa liên kết
  assert.match(tg.sent.at(-1).text, /chưa liên kết tài khoản/);
  await bot.handleUpdate(msg(777, "/start GUEST123"));
  assert.equal((await db.doc("tgGuests/777").get()).data().uid, "cus");
  assert.equal((await db.doc("tgChats/777").get()).exists, false, "không thành chat nhân viên");
  assert.match(tg.sent.at(-1).text, /Đã liên kết Telegram/);
  const r = await guest.dispatch("g1", "confirmed");
  assert.equal(r.telegram, 1);
  assert.equal(tg.sent.at(-1).chat, "777");
  assert.match(tg.sent.at(-1).text, /Đặt phòng đã được xác nhận/);
  await bot.handleUpdate(msg(777, "/cuatoi"));
  assert.match(tg.sent.at(-1).text, /ABCD1234/);
  assert.match(tg.sent.at(-1).text, /Phòng gỗ 1/);
  await bot.handleUpdate(msg(777, "/cho")); // vẫn không phải nhân viên
  assert.match(tg.sent.at(-1).text, /dành cho nhân viên/);
  await bot.handleUpdate(msg(777, "/huylienket"));
  assert.equal((await db.doc("tgGuests/777").get()).exists, false);
});

test("bot: yêu cầu mới được kiểm giá trước khi báo nhân viên; xác nhận gửi tin cho khách", async () => {
  await reset();
  await db.doc("tgGuests/888").set({ uid: "cus" });
  await db.doc("bookings/n1").set({ ...base, total: 1000, deposit: 100, slotId: "cus_1" });
  await db.doc("busy/n1").set({ roomId: "r1", checkIn: base.checkIn, checkOut: base.checkOut, status: "pending" });
  await db.doc("pend/cus_1").set({ uid: "cus", n: 1, bookingId: "n1" });
  const { bot, tg, mailer } = mk();
  await bot.notify("cus", { type: "booking", id: "n1" });
  await new Promise((r) => setTimeout(r, 300));
  const staffMsg = tg.sent.find((s) => s.chat === "111");
  assert.match(staffMsg.text, /1\.200\.000/);
  assert.match(staffMsg.text, /khác bảng giá/);
  assert.ok(mailer.mails.some((m) => /Đã nhận yêu cầu/.test(m.subject)), "email 'đã nhận yêu cầu'");
  assert.ok(tg.sent.some((s) => s.chat === "888"), "tin Telegram tới khách đã liên kết");
  await bot.handleUpdate({ callback_query: { id: "c", data: "cf:n1", from: { first_name: "Chủ" }, message: { message_id: 1, text: "x", chat: { id: 111 } } } });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal((await db.doc("bookings/n1").get()).data().status, "confirmed");
  assert.ok(mailer.mails.some((m) => /đã được xác nhận/.test(m.subject)), "email xác nhận");
});

test("sweep: lần đầu chỉ ghi nhận trạng thái hiện có; sau đó kiểm giá và gửi tin cho đặt phòng mới/xác nhận trên web", async () => {
  await reset();
  await db.doc("settings/mailState").delete();
  await db.doc("bookings/old").set({ ...base, ...RIGHT, status: "confirmed" });
  const { guest, mailer } = mk();
  assert.equal((await guest.sweep()).baseline, 1);
  assert.equal(mailer.mails.length, 0, "khách cũ không bị gửi hàng loạt");
  await db.doc("bookings/new").set({ ...base, total: 5, code: "NEW00001" });
  await db.doc("bookings/old").update({ status: "cancelled" });
  const r = await guest.sweep();
  assert.equal(r.verified, 1);
  assert.equal((await db.doc("bookings/new").get()).data().total, 1200000);
  assert.ok(mailer.mails.some((m) => /NEW00001/.test(m.subject)), "đặt phòng mới được báo đã nhận");
  assert.ok(mailer.mails.some((m) => /không còn hiệu lực/.test(m.subject) && /ABCD1234/.test(m.subject)), "hủy trên web được báo");
});

test("reminders: nhắc khách có lịch nhận phòng vào ngày mai", async () => {
  await reset();
  await db.doc("bookings/t1").set({ ...base, ...RIGHT, status: "confirmed", checkIn: "2026-11-11", checkOut: "2026-11-12" });
  await db.doc("bookings/t2").set({ ...base, ...RIGHT, status: "confirmed", checkIn: "2026-11-15", checkOut: "2026-11-16", code: "LATER000" });
  const { guest, mailer } = mk();
  assert.equal((await guest.reminders()).sent, 1);
  assert.match(mailer.mails[0].subject, /Nhắc lịch nhận phòng ngày mai/);
  assert.equal((await guest.reminders()).sent, 0);
});

test("quoteFull/quoteLines trong functions/pricing.js khớp src/lib/pricing.ts", async (t) => {
  let ts;
  try { ts = await import("../../src/lib/pricing.ts"); } catch { return t.skip("Node này chưa đọc được .ts"); }
  const rawP = { weekendDays: [5, 6], weekendPercent: 15, seasons: [{ name: "Hè", from: "2026-12-01", to: "2026-12-31", percent: 25 }], holidays: [{ name: "Tết", from: "2027-02-05", to: "2027-02-12", percent: 60 }], longStay: [{ minNights: 3, percent: -5 }, { minNights: 7, percent: -12 }] };
  const rawB = { depositPercent: 30, extraGuestFee: 90000, earlyCheckInFee: 120000, lateCheckOutFee: 80000, services: [{ id: "bbq", name: "BBQ", price: 250000, unit: "once", active: true }, { id: "bike", name: "Xe đạp", price: 50000, unit: "night", active: true }] };
  const room = { price: 730000, capacity: 4, baseGuests: 2 };
  const cases = [
    ["2026-11-12", 1, 2, {}], ["2026-11-12", 4, 3, { early: true, late: true }], ["2026-12-30", 3, 4, { services: { bbq: 2, bike: 3 }, couponPercent: 15 }],
    ["2027-02-10", 8, 2, { couponPercent: 10, early: true }], ["2026-11-01", 10, 1, { services: { bbq: 1 } }],
  ];
  for (const [ci, n, g, o] of cases) {
    const co = new Date(Date.parse(`${ci}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
    const a = ts.quoteStay(room, ci, co, g, ts.parsePricing(rawP), ts.parseBookingCfg(rawB), o);
    const b = pricing.quoteFull(room, ci, n, g, pricing.parsePricing(rawP), pricing.parseBooking(rawB), o);
    assert.deepEqual({ total: b.total, original: b.originalTotal, deposit: b.deposit }, { total: a.total, original: a.originalTotal, deposit: a.deposit }, `${ci} ${n} đêm ${g} khách`);
    assert.deepEqual(pricing.quoteLines(b, "Phòng"), ts.quoteLines(a, "Phòng"), `dòng chi tiết ${ci}`);
  }
});
