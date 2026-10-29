"use strict";
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { createTelegram } = require("./telegram");
const { createBot, webhookSecret, safeEq, STAFF_COMMANDS, GUEST_COMMANDS } = require("./bot");
const { createGuest, createMailer } = require("./guest");
const { createPush } = require("./push");
const { createCampaign } = require("./campaign");
const { getMessaging } = require("firebase-admin/messaging");
const { createLoyalty } = require("./loyalty");
const { createBackup } = require("./backup");
const { getStorage } = require("firebase-admin/storage");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { sitemapXml } = require("./sitemap");

initializeApp();
const TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
// Tài khoản gửi email (vd Gmail + mật khẩu ứng dụng). Giá trị "-" = chưa cấu hình: email bị tắt, Telegram vẫn chạy.
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const REGION = "us-central1";
const opts = { region: REGION, secrets: [TOKEN, SMTP_USER, SMTP_PASS] };

// Bộ đếm tin nhắn trong bộ nhớ dùng chung giữa các yêu cầu của cùng một instance.
const mem = new Map();
const mailer = () => createMailer({ user: SMTP_USER.value(), pass: SMTP_PASS.value() });
const guestFor = (tg) => createGuest({ db: getFirestore(), tg, mailer: mailer() });
const pushFor = () => createPush({ db: getFirestore(), messaging: getMessaging() });
const botFor = () => { const tg = createTelegram(TOKEN.value()); return createBot({ db: getFirestore(), tg, mem, guest: guestFor(tg), push: pushFor() }); };
const needAuth = (req) => { if (!req.auth) throw new HttpsError("unauthenticated", "Cần đăng nhập."); return req.auth.uid; };
const asHttpsError = (e) => (e instanceof HttpsError ? e : new HttpsError(e.code === "permission-denied" ? "permission-denied" : "internal", e.message));

/** Telegram gọi vào đây; chỉ nhận khi đúng mã bí mật của webhook. */
exports.telegramWebhook = onRequest(opts, async (req, res) => {
  if (req.method !== "POST" || !safeEq(req.get("x-telegram-bot-api-secret-token"), webhookSecret(TOKEN.value()))) { res.status(403).send("forbidden"); return; }
  try { await botFor().handleUpdate(req.body ?? {}); } catch (e) { console.error("telegram update failed", e); }
  res.status(200).send("ok"); // luôn trả 200 để Telegram không gửi lại vô hạn
});

/** Ứng dụng báo sự kiện (yêu cầu đặt phòng, khách hủy, cảm nhận mới); lỗi không ảnh hưởng người dùng. */
exports.tgNotify = onCall(opts, async (req) => {
  try { return await botFor().notify(needAuth(req), req.data ?? {}); } catch (e) { console.error("tgNotify", e); return { sent: 0 }; }
});

/** Nhân viên tạo mã/đường dẫn liên kết chat Telegram của mình. */
exports.tgLinkCode = onCall(opts, async (req) => {
  try { return await botFor().linkCode(needAuth(req)); } catch (e) { throw asHttpsError(e); }
});

/** Khách tạo mã/đường dẫn liên kết Telegram với tài khoản của mình để nhận thông báo đặt phòng. */
exports.tgGuestLink = onCall(opts, async (req) => {
  try { return await botFor().guestLinkCode(needAuth(req)); } catch (e) { throw asHttpsError(e); }
});

/** Nhân viên vừa đổi trạng thái đặt phòng trên web (xác nhận/hủy): báo khách qua email/Telegram (chỉ một lần mỗi loại). */
exports.guestNotify = onCall(opts, async (req) => {
  const uid = needAuth(req);
  const role = (await getFirestore().doc(`users/${uid}`).get()).data()?.role;
  if (!["owner", "manager", "reception"].includes(role)) throw new HttpsError("permission-denied", "Chỉ nhân viên lễ tân trở lên.");
  const id = String(req.data?.id ?? "");
  const b = (await getFirestore().doc(`bookings/${id}`).get()).data();
  if (!b) return { sent: false };
  const kind = b.status === "confirmed" ? "confirmed" : b.status === "cancelled" ? "cancelled" : "";
  if (!kind) return { sent: false };
  const g = guestFor(createTelegram(TOKEN.value()));
  const r = await g.dispatch(id, kind);
  return { sent: !!(r.email || r.telegram), ...r };
});

/** Chủ gửi thử một email để kiểm tra cấu hình SMTP. */
exports.mailTest = onCall(opts, async (req) => {
  const uid = needAuth(req);
  if ((await getFirestore().doc(`users/${uid}`).get()).data()?.role !== "owner") throw new HttpsError("permission-denied", "Chỉ chủ mới gửi thử được.");
  const to = String(req.data?.to ?? "").trim();
  if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(to)) throw new HttpsError("invalid-argument", "Email không hợp lệ.");
  const m = mailer();
  if (!m.enabled) throw new HttpsError("failed-precondition", "Chưa cấu hình tài khoản gửi email (secret SMTP_USER / SMTP_PASS).");
  try { await m.send({ from: m.from, to, subject: "Nhà Gỗ Homestay — email thử", text: "Cấu hình email hoạt động tốt." }); } catch (e) { throw new HttpsError("internal", e.message); }
  return { ok: true };
});

/** Chủ/quản lý gửi email tới nhiều khách (khuyến mãi, thông báo). Mỗi lần tối đa 100 địa chỉ; giao diện tự chia lô. */
exports.mailCampaign = onCall({ ...opts, timeoutSeconds: 540, memory: "256MiB" }, async (req) => {
  const uid = needAuth(req);
  const role = (await getFirestore().doc(`users/${uid}`).get()).data()?.role;
  if (!["owner", "manager"].includes(role)) throw new HttpsError("permission-denied", "Chỉ chủ/quản lý gửi email hàng loạt.");
  try {
    const db = getFirestore();
    const [u, pr] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc(`profiles/${uid}`).get()]);
    return await createCampaign({ db, mailer: mailer() }).send({
      uid, selfEmail: req.auth.token?.email, selfEmails: [u.data()?.email, pr.data()?.email], test: req.data?.test === true,
      subject: req.data?.subject, body: req.data?.body, to: req.data?.to,
    });
  } catch (e) { throw e instanceof HttpsError ? e : new HttpsError(["invalid-argument", "failed-precondition"].includes(e.code) ? e.code : "internal", e.message); }
});

/** Cho giao diện biết đã có tài khoản gửi email hay chưa (không lộ thông tin tài khoản). */
exports.mailStatus = onCall(opts, async (req) => {
  const uid = needAuth(req);
  const role = (await getFirestore().doc(`users/${uid}`).get()).data()?.role;
  if (!["owner", "manager"].includes(role)) throw new HttpsError("permission-denied", "Chỉ chủ/quản lý.");
  return { configured: mailer().enabled };
});

/** Chủ đăng ký webhook cho bot (bấm một lần ở Cài đặt, hoặc khi đổi token). */
exports.tgSetup = onCall(opts, async (req) => {
  const uid = needAuth(req);
  const me = await getFirestore().doc(`users/${uid}`).get();
  if (me.data()?.role !== "owner") throw new HttpsError("permission-denied", "Chỉ chủ mới kết nối bot.");
  const tg = createTelegram(TOKEN.value());
  const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT;
  const url = `https://${REGION}-${project}.cloudfunctions.net/telegramWebhook`;
  try {
    const bot = await tg.getMe();
    await tg.setWebhook(url, webhookSecret(TOKEN.value()));
    await tg.setMyCommands(GUEST_COMMANDS);
    // Chat nhân viên đã liên kết có menu riêng (đặt lại ở đây để đồng bộ khi nâng cấp).
    const staff = await getFirestore().collection("tgChats").get();
    await Promise.allSettled(staff.docs.map((d) => tg.setMyCommands(STAFF_COMMANDS, { type: "chat", chat_id: Number(d.id) })));
    return { username: bot.username, url };
  } catch (e) { throw new HttpsError("internal", e.message); }
});

/** Thành viên nhận mã giảm giá riêng của hạng hiện tại (không cần token bot). */
exports.loyaltyClaim = onCall({ region: REGION }, async (req) => {
  const uid = needAuth(req);
  try { return await createLoyalty({ db: getFirestore() }).claim(uid); } catch (e) { throw new HttpsError(e.code === "failed-precondition" ? "failed-precondition" : "internal", e.message); }
});

// ===== Sao lưu dữ liệu (chỉ chủ) =====
const backupFor = () => createBackup({ db: getFirestore(), bucket: getStorage().bucket() });
async function needOwner(req) {
  const uid = needAuth(req);
  if ((await getFirestore().doc(`users/${uid}`).get()).data()?.role !== "owner") throw new HttpsError("permission-denied", "Chỉ chủ mới sao lưu được.");
  return uid;
}
const wrap = (fn) => async (req) => { try { return await fn(req); } catch (e) { throw e instanceof HttpsError ? e : new HttpsError(e.code === "invalid-argument" || e.code === "failed-precondition" ? e.code : "internal", e.message); } };

exports.backupNow = onCall({ region: REGION, timeoutSeconds: 300, memory: "512MiB" }, wrap(async (req) => {
  await needOwner(req);
  const cfg = (await getFirestore().doc("settings/backup").get()).data();
  return backupFor().run(cfg?.keep ?? 14);
}));
exports.backupList = onCall({ region: REGION }, wrap(async (req) => { await needOwner(req); return { files: await backupFor().list() }; }));
exports.backupGet = onCall({ region: REGION, memory: "512MiB" }, wrap(async (req) => { await needOwner(req); return { name: req.data?.name, json: await backupFor().get(String(req.data?.name ?? "")) }; }));
/** Mỗi ngày 02:00 (giờ Việt Nam): sao lưu nếu chủ đã bật (hằng ngày hoặc Chủ nhật hằng tuần). */
exports.backupScheduled = onSchedule({ region: REGION, schedule: "0 2 * * *", timeZone: "Asia/Ho_Chi_Minh", timeoutSeconds: 540, memory: "512MiB" }, async () => { await backupFor().scheduled(); });

// ===== Cảnh báo và nhắc tự động qua Telegram cho quản lý =====
const schedOpts = { region: REGION, timeZone: "Asia/Ho_Chi_Minh", secrets: [TOKEN, SMTP_USER, SMTP_PASS], timeoutSeconds: 120 };
/** Mỗi 30 phút trong giờ làm việc (05:00–23:59): báo nhân viên chưa vào ca / quên ra ca. */
exports.tgStaffAlerts = onSchedule({ ...schedOpts, schedule: "*/30 5-23 * * *" }, async () => { try { await botFor().staffAlerts(); } catch (e) { console.error("staffAlerts", e); } });
/** 08:00 và 18:00 mỗi ngày: khách sắp nhận phòng chưa cọc; khách vừa trả phòng chưa có hồ sơ. */
exports.tgReminders = onSchedule({ ...schedOpts, schedule: "0 8,18 * * *" }, async () => {
  try { await botFor().dailyReminders(); } catch (e) { console.error("dailyReminders", e); }
  try { await guestFor(createTelegram(TOKEN.value())).reminders(); } catch (e) { console.error("guest reminders", e); }
});
/**
 * Mỗi 2 giờ từ 06:00 đến 22:00 (giờ Việt Nam): dọn đặt phòng bị treo (hết hạn / khách không đến), tính lại giá các yêu cầu mới
 * và gửi email/Telegram còn sót cho khách. Đây là lớp dự phòng: các việc cần tức thời (báo nhân viên, xác nhận qua bot hoặc web) đã chạy ngay khi xảy ra.
 */
exports.bookingSweep = onSchedule({ ...schedOpts, schedule: "0 6-22/2 * * *" }, async () => {
  try {
    const g = guestFor(createTelegram(TOKEN.value()));
    const stale = await g.expireStale().catch((e) => { console.error("expireStale", e); return null; });
    const r = await g.sweep();
    console.log("bookingSweep", JSON.stringify({ ...r, stale }));
  } catch (e) { console.error("bookingSweep", e); }
});

/** /sitemap.xml (hosting chuyển tiếp tới đây): danh sách trang công khai gồm từng phòng. */
exports.sitemap = onRequest({ region: REGION, cors: false }, async (req, res) => {
  try {
    res.set("Cache-Control", "public, max-age=3600, s-maxage=3600").type("application/xml").status(200).send(await sitemapXml(getFirestore()));
  } catch (e) { console.error("sitemap", e); res.status(500).send("error"); }
});

/** 21:00 hằng ngày: báo cáo trong ngày gửi chủ/quản lý qua Telegram. */
exports.tgDailyReport = onSchedule({ ...schedOpts, schedule: "0 21 * * *" }, async () => { try { await botFor().dailyReport(); } catch (e) { console.error("dailyReport", e); } });
