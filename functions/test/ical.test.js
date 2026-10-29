"use strict";
// iCal (xuất/nhập) và webhook ngân hàng. Chạy với Firestore Emulator (xem bot.test.js).
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { createIcal, parseIcs, buildIcs, okFeedUrl } = require("../ical");
const { createBankHook, extractCode, normalize } = require("../bankhook");

if (!getApps().length) initializeApp({ projectId: "demo-nhago" });
const db = getFirestore();
const NOW = new Date("2026-11-10T03:00:00Z");

async function reset() {
  for (const c of ["rooms", "bookings", "busy", "roomBlocks", "settings", "tgSent", "bankTx", "auditLog"]) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  await db.doc("rooms/r1").set({ name: "Phòng gỗ 1", price: 500000, capacity: 2, status: "active" });
}

test("parseIcs: đọc ngày, gập dòng, bỏ sự kiện đã hủy, giờ UTC đổi sang giờ Việt Nam", () => {
  const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:a1", "DTSTART;VALUE=DATE:20261225", "DTEND;VALUE=DATE:20261228", "SUMMARY:Reserved\\, Airbnb", "END:VEVENT",
    "BEGIN:VEVENT", "UID:a2", "DTSTART:20261230T180000Z", "DTEND:20261231T050000Z", "SUMMARY:Long", " name", "END:VEVENT",
    "BEGIN:VEVENT", "UID:a3", "DTSTART;VALUE=DATE:20270105", "STATUS:CANCELLED", "END:VEVENT",
    "BEGIN:VEVENT", "UID:a4", "DTSTART;VALUE=DATE:20270110", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const ev = parseIcs(ics);
  assert.deepEqual(ev.map((e) => [e.uid, e.from, e.to]), [["a1", "2026-12-25", "2026-12-28"], ["a2", "2026-12-31", "2027-01-01"], ["a4", "2027-01-10", "2027-01-11"]]);
  assert.equal(ev[0].summary, "Reserved, Airbnb");
  assert.equal(ev[1].summary, "Longname");
});

test("buildIcs: sự kiện cả ngày, không lộ tên khách", () => {
  const out = buildIcs("Phòng; 1", [{ uid: "bk-x", from: "2026-12-25", to: "2026-12-27", summary: "Reserved" }], NOW.getTime());
  assert.match(out, /BEGIN:VCALENDAR\r\n/);
  assert.match(out, /DTSTART;VALUE=DATE:20261225\r\nDTEND;VALUE=DATE:20261227/);
  assert.match(out, /UID:bk-x@nhago\.web\.app/);
  assert.match(out, /X-WR-CALNAME:Phòng\; 1/);
});

test("okFeedUrl: chỉ https tới tên miền công khai", () => {
  assert.equal(okFeedUrl("https://www.airbnb.com/calendar/ical/1.ics?s=abc"), true);
  for (const u of ["http://x.com/a.ics", "https://localhost/a", "https://127.0.0.1/a", "https://[::1]/a", "https://metadata.google.internal/a", "https://user:p@x.com/a", "ftp://x.com", "javascript:alert(1)"]) assert.equal(okFeedUrl(u), false, u);
});

test("xuất iCal: cần đúng mã bí mật; chỉ đặt phòng còn hiệu lực + khóa tay, không lặp lại lịch nhập", async () => {
  await reset();
  await db.doc("settings/ical").set({ token: "tok1234567890abcdef", feeds: [] });
  const base = { roomId: "r1", guestName: "Tên Riêng Tư", phone: "0900000000" };
  await db.doc("bookings/a").set({ ...base, checkIn: "2026-12-01", checkOut: "2026-12-03", status: "confirmed" });
  await db.doc("bookings/b").set({ ...base, checkIn: "2026-12-05", checkOut: "2026-12-06", status: "pending" });
  await db.doc("bookings/c").set({ ...base, checkIn: "2026-12-08", checkOut: "2026-12-09", status: "cancelled" });
  await db.doc("bookings/d").set({ ...base, checkIn: "2026-12-10", checkOut: "2026-12-11", status: "checked_out" });
  await db.doc("roomBlocks/k1").set({ roomId: "r1", from: "2026-12-20", to: "2026-12-22", reason: "Sửa mái" });
  await db.doc("roomBlocks/k2").set({ roomId: "r1", from: "2026-12-25", to: "2026-12-27", reason: "Airbnb", source: "ical", feedId: "f1" });
  const ical = createIcal({ db, now: () => NOW });
  assert.equal((await ical.exportFor("r1", "sai")).status, 403);
  assert.equal((await ical.exportFor("rx", "tok1234567890abcdef")).status, 404);
  const r = await ical.exportFor("r1", "tok1234567890abcdef");
  assert.equal(r.status, 200);
  assert.equal((r.body.match(/BEGIN:VEVENT/g) ?? []).length, 3); // a, b, k1
  assert.match(r.body, /bk-a@nhago/); assert.match(r.body, /blk-k1@nhago/);
  assert.doesNotMatch(r.body, /bk-c|bk-d|blk-k2|Tên Riêng Tư|0900000000|Sửa mái/);
});

test("nhập iCal: tạo khóa phòng + lịch bận, cập nhật khi nguồn đổi, gỡ khi nguồn bỏ, báo khi trùng đặt phòng của mình, lỗi mạng giữ nguyên", async () => {
  await reset();
  await db.doc("settings/ical").set({ token: "tok1234567890abcdef", feeds: [{ id: "f1", roomId: "r1", name: "Airbnb", url: "https://cal.example.com/r1.ics" }, { id: "bad", roomId: "r1", name: "Xấu", url: "http://insecure.example.com/x.ics" }] });
  await db.doc("bookings/own").set({ roomId: "r1", guestName: "Khách Nhà", checkIn: "2026-12-26", checkOut: "2026-12-28", status: "confirmed" });
  let body = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:e1", "DTSTART;VALUE=DATE:20261220", "DTEND;VALUE=DATE:20261222", "SUMMARY:Reserved", "END:VEVENT",
    "BEGIN:VEVENT", "UID:e2", "DTSTART;VALUE=DATE:20261225", "DTEND;VALUE=DATE:20261227", "END:VEVENT",
    "BEGIN:VEVENT", "UID:old", "DTSTART;VALUE=DATE:20260101", "DTEND;VALUE=DATE:20260103", "END:VEVENT",
    "BEGIN:VEVENT", "UID:echo@nhago.web.app", "DTSTART;VALUE=DATE:20261230", "DTEND;VALUE=DATE:20261231", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  let fail = false;
  const calls = [];
  const fetchImpl = async (url) => { calls.push(url); if (fail) throw new Error("mạng lỗi"); return { ok: true, status: 200, text: async () => body }; };
  const sent = [];
  const ical = createIcal({ db, fetchImpl, now: () => NOW, notify: async (t) => { sent.push(t); return 1; } });
  const r1 = await ical.syncAll();
  assert.deepEqual([r1.feeds, r1.added, r1.removed, r1.conflicts], [1, 2, 0, 1]); // nguồn http bị bỏ; sự kiện cũ và do mình xuất bị bỏ
  assert.deepEqual(calls, ["https://cal.example.com/r1.ics"]);
  const blocks = (await db.collection("roomBlocks").get()).docs.map((d) => d.data());
  assert.equal(blocks.length, 2);
  assert.ok(blocks.every((b) => b.source === "ical" && b.feedId === "f1" && b.roomId === "r1"));
  const busy = (await db.collection("busy").get()).docs;
  assert.equal(busy.length, 2); assert.ok(busy.every((d) => d.id.startsWith("blk_ical_f1_")));
  assert.match(sent[0], /Trùng lịch/); assert.match(sent[0], /Khách Nhà/);
  const r2 = await ical.syncAll();
  assert.deepEqual([r2.added, r2.removed, r2.conflicts], [0, 0, 0]); // chạy lại: không nhân đôi, không báo lại
  fail = true;
  await ical.syncAll();
  assert.equal((await db.collection("roomBlocks").get()).size, 2); // lỗi mạng: giữ nguyên
  assert.equal((await db.doc("settings/icalState").get()).data().feeds.f1.ok, false);
  fail = false;
  body = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:e1", "DTSTART;VALUE=DATE:20261220", "DTEND;VALUE=DATE:20261223", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const r3 = await ical.syncAll();
  assert.deepEqual([r3.added, r3.removed], [1, 2]); // e1 đổi ngày → khóa mới; e2 và e1 cũ bị gỡ
  assert.equal((await db.collection("roomBlocks").get()).size, 1);
  assert.equal((await db.collection("busy").get()).size, 1);
  assert.equal((await db.doc("settings/icalState").get()).data().feeds.f1.ok, true);
});

test("extractCode / normalize", () => {
  assert.equal(extractCode("MBVCB.123 NHAGO ABCD1234 chuyen tien"), "ABCD1234");
  assert.equal(extractCode("nhagoabcd1234"), "ABCD1234");
  assert.equal(extractCode("NHAGO-AB12CD34"), "AB12CD34");
  assert.equal(extractCode("chuyen tien an trua"), "");
  assert.deepEqual(normalize({ id: 7, transferType: "in", transferAmount: 300000, content: "x", transactionDate: "2026-11-10 10:00:00", accountNumber: "012" }).map((t) => [t.source, t.id, t.amount]), [["sepay", "7", 300000]]);
  assert.deepEqual(normalize({ id: 7, transferType: "out", transferAmount: 5 }), []);
  assert.deepEqual(normalize({ error: 0, data: [{ id: 1, amount: 500000, description: "NHAGO ABCD1234" }, { id: 2, amount: -10, description: "phi" }] }).map((t) => [t.source, t.id, t.amount]), [["casso", "1", 500000]]);
  assert.deepEqual(normalize(null), []);
});

test("webhook ngân hàng: xác thực, khớp mã, ghi sổ, không ghi lặp, giao dịch lạ được lưu để gán tay", async () => {
  await reset();
  await db.doc("settings/bankhook").set({ token: "k".repeat(24) });
  await db.doc("bookings/b1").set({ roomId: "r1", guestName: "An", code: "ABCD1234", checkIn: "2026-12-01", checkOut: "2026-12-03", status: "pending", total: 1000000, deposit: 300000, paid: 0 });
  await db.doc("bookings/b2").set({ roomId: "r1", guestName: "Bình", code: "ZZZZ0000", checkIn: "2026-12-01", checkOut: "2026-12-03", status: "cancelled", total: 1000000, deposit: 300000, paid: 0 });
  const sent = [];
  const hook = createBankHook({ db, now: () => NOW, notify: async (t, extra) => { sent.push({ t, extra }); return 1; } });
  const tx = (id, content, amount = 300000) => ({ id, transferType: "in", transferAmount: amount, content, transactionDate: "2026-11-10 10:00:00", accountNumber: "012" });
  assert.equal((await hook.handle(tx(1, "NHAGO ABCD1234"), {})).status, 401);
  assert.equal((await hook.handle(tx(1, "NHAGO ABCD1234"), { authorization: "Apikey sai" })).status, 401);
  assert.equal((await createBankHook({ db }).handle(tx(1, "x"), {}).then((r) => r.status)), 401);
  const ok = { authorization: `Apikey ${"k".repeat(24)}` };
  const r = await hook.handle(tx(1, "MB NHAGO ABCD1234 coc"), ok);
  assert.equal(r.status, 200); assert.equal(r.json.results[0].result, "matched");
  const b = (await db.doc("bookings/b1").get()).data();
  assert.equal(b.paid, 300000);
  assert.equal(b.payLog.length, 1); assert.deepEqual([b.payLog[0].amount, b.payLog[0].by], [300000, "bank"]);
  assert.equal(b.status, "pending"); // không tự xác nhận
  assert.equal(sent[0].extra.reply_markup.inline_keyboard[0][0].callback_data, "cf:b1");
  assert.match(sent[0].t, /300\.000 VNĐ/); assert.match(sent[0].t, /✅/);
  assert.equal((await hook.handle(tx(1, "NHAGO ABCD1234"), ok)).json.results[0].result, "duplicate");
  assert.equal((await db.doc("bookings/b1").get()).data().paid, 300000); // gọi lại cùng giao dịch không ghi lần hai
  assert.equal((await hook.handle(tx(2, "ck tien an"), ok)).json.results[0].result, "unmatched");
  assert.equal((await hook.handle(tx(3, "NHAGO ZZZZ0000"), ok)).json.results[0].result, "unmatched"); // đặt phòng đã hủy
  assert.equal((await hook.handle(tx(4, "NHAGO QQQQ9999"), ok)).json.results[0].result, "unmatched");
  assert.equal((await db.doc("bookings/b2").get()).data().paid, 0);
  const un = (await db.collection("bankTx").get()).docs.map((d) => d.data()).filter((x) => !x.matched);
  assert.equal(un.length, 3);
  assert.ok(un.some((x) => /đã hủy/.test(x.reason)));
  assert.equal((await hook.handle({ id: 9, transferType: "out", transferAmount: 5 }, ok)).json.results.length, 0);
  const casso = await hook.handle({ error: 0, data: [{ id: 55, amount: 700000, description: "NHAGOABCD1234" }] }, { "secure-token": "k".repeat(24) });
  assert.equal(casso.json.results[0].result, "matched");
  assert.equal((await db.doc("bookings/b1").get()).data().paid, 1000000);
  const log = (await db.collection("auditLog").get()).docs.map((d) => d.data());
  assert.equal(log.length, 2); assert.ok(log.every((l) => l.by === "bank" && l.action === "payment.in"));
});

test("webhook ngân hàng: chưa cấu hình mã thì từ chối; chủ tắt nhật ký thì không ghi", async () => {
  await reset();
  assert.equal((await createBankHook({ db }).handle({}, {})).status, 503);
  await db.doc("settings/bankhook").set({ token: "k".repeat(24) });
  await db.doc("settings/audit").set({ enabled: false });
  await db.doc("bookings/b1").set({ roomId: "r1", guestName: "An", code: "ABCD1234", checkIn: "2026-12-01", checkOut: "2026-12-03", status: "confirmed", total: 100, deposit: 10 });
  await createBankHook({ db, now: () => NOW }).handle({ id: 1, transferType: "in", transferAmount: 10, content: "NHAGO ABCD1234" }, { authorization: `Apikey ${"k".repeat(24)}` });
  assert.equal((await db.collection("auditLog").get()).size, 0);
  assert.equal((await db.doc("bookings/b1").get()).data().paid, 10);
});
