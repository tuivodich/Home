"use strict";
// Gửi email hàng loạt: kiểm tra người nhận, giới hạn, nội dung an toàn. Chạy với Firestore Emulator.
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { createCampaign, bodyHtml } = require("../campaign");

if (!getApps().length) initializeApp({ projectId: "demo-nhago" });
const db = getFirestore();

function fakeMailer(opts = {}) {
  const mails = [];
  return { mails, enabled: opts.enabled ?? true, from: "nhago@x.vn", send: async (m) => { if (opts.failFor === m.to) throw new Error("smtp"); mails.push(m); return true; } };
}
async function reset() {
  for (const c of ["users", "bookings", "guests", "settings", "mailCampaigns"]) {
    const s = await db.collection(c).get();
    await Promise.all(s.docs.map((d) => d.ref.delete()));
  }
  await db.doc("users/u1").set({ role: "customer", email: "An@X.vn" });
  await db.doc("bookings/b1").set({ guestName: "Bình", email: "binh@x.vn" });
  await db.doc("guests/g1").set({ fullName: "Chi", email: "chi@x.vn" });
  await db.doc("settings/mail").set({ enabled: true, fromName: 'Nhà "Gỗ"', replyTo: "reply@x.vn" });
}
const base = { uid: "own", selfEmail: "chu@x.vn", subject: "Ưu đãi Noel", body: "Giảm 15%.\n\nĐặt tại https://nhago.web.app" };

test("gửi tới địa chỉ đã có trong hệ thống; địa chỉ lạ bị bỏ qua; ghi lịch sử", async () => {
  await reset();
  const mailer = fakeMailer();
  const r = await createCampaign({ db, mailer }).send({ ...base, to: ["an@x.vn", "BINH@x.vn", "chi@x.vn", "la@lạ.com", "khong-hop-le", "an@x.vn"] });
  assert.deepEqual([r.sent, r.failed, r.rejected], [3, 0, 1]); // trùng và sai định dạng bị loại trước; "la@lạ.com" hợp lệ nhưng không có trong hệ thống
  assert.deepEqual(mailer.mails.map((m) => m.to).sort(), ["an@x.vn", "binh@x.vn", "chi@x.vn"]);
  const m = mailer.mails[0];
  assert.equal(m.subject, "Ưu đãi Noel");
  assert.equal(m.from, '"Nhà Gỗ" <nhago@x.vn>', "tên người gửi đã bỏ dấu nháy kép");
  assert.equal(m.replyTo, "reply@x.vn");
  assert.match(m.html, /<a href="https:\/\/nhago\.web\.app" style/);
  const [c] = (await db.collection("mailCampaigns").get()).docs;
  assert.deepEqual([c.data().sent, c.data().rejected, c.data().by, c.data().subject], [3, 1, "own", "Ưu đãi Noel"]);
});

test("cho phép gửi tới email của chính người gửi (đăng nhập, tài khoản, hồ sơ)", async () => {
  await reset();
  const mailer = fakeMailer();
  const r = await createCampaign({ db, mailer }).send({ ...base, selfEmails: ["Rieng@Gmail.com"], to: ["Chu@x.vn", "rieng@gmail.com"] });
  assert.deepEqual([r.sent, r.rejected, r.to], [2, 0, ["chu@x.vn", "rieng@gmail.com"]]);
});

test("gửi thử (test) chỉ tới địa chỉ của chính người gửi, không tới khách", async () => {
  await reset();
  const mailer = fakeMailer();
  const c = createCampaign({ db, mailer });
  const r = await c.send({ ...base, selfEmails: ["rieng@gmail.com"], test: true, to: ["an@x.vn", "rieng@gmail.com"] });
  assert.deepEqual([r.sent, r.rejected, mailer.mails.map((m) => m.to)], [1, 1, ["rieng@gmail.com"]]);
  const none = await c.send({ ...base, test: true, to: ["an@x.vn"] }); // email khách không phải của người gửi
  assert.deepEqual([none.sent, none.rejected], [0, 1]);
});

test("một địa chỉ lỗi không chặn các địa chỉ khác", async () => {
  await reset();
  const mailer = fakeMailer({ failFor: "binh@x.vn" });
  const r = await createCampaign({ db, mailer }).send({ ...base, to: ["an@x.vn", "binh@x.vn", "chi@x.vn"] });
  assert.deepEqual([r.sent, r.failed, r.rejected], [2, 1, 0]);
});

test("kiểm tra đầu vào: tiêu đề, nội dung, số người nhận, chưa cấu hình SMTP", async () => {
  await reset();
  const c = createCampaign({ db, mailer: fakeMailer() });
  await assert.rejects(c.send({ ...base, subject: " " }), /Tiêu đề/);
  await assert.rejects(c.send({ ...base, subject: "x".repeat(151), to: ["an@x.vn"] }), /Tiêu đề/);
  await assert.rejects(c.send({ ...base, body: "", to: ["an@x.vn"] }), /Nội dung/);
  await assert.rejects(c.send({ ...base, to: [] }), /Chưa chọn người nhận/);
  await assert.rejects(c.send({ ...base, to: Array.from({ length: 101 }, (_, i) => `u${i}@x.vn`) }), /tối đa 100/);
  await assert.rejects(createCampaign({ db, mailer: fakeMailer({ enabled: false }) }).send({ ...base, to: ["an@x.vn"] }), /Chưa cấu hình tài khoản gửi email/);
  assert.equal((await db.collection("mailCampaigns").get()).size, 0, "lần bị từ chối không ghi lịch sử");
});

test("bodyHtml: escape HTML, giữ xuống dòng/đoạn, chỉ http(s) thành liên kết", () => {
  const h = bodyHtml('Xin <b>chào</b> & "bạn"\ndòng 2\n\nĐoạn 2 https://a.vn/x?y=1&z=2 javascript:alert(1)');
  assert.doesNotMatch(h, /<b>/);
  assert.match(h, /&lt;b&gt;chào&lt;\/b&gt; &amp; &quot;bạn&quot;<br>dòng 2/);
  assert.match(h, /<a href="https:\/\/a\.vn\/x\?y=1&amp;z=2"/);
  assert.doesNotMatch(h, /href="javascript/);
  assert.equal((h.match(/<p /g) ?? []).length, 2);
});
