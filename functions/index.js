"use strict";
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { createTelegram } = require("./telegram");
const { createBot, webhookSecret, safeEq, STAFF_COMMANDS } = require("./bot");
const { createLoyalty } = require("./loyalty");
const { createBackup } = require("./backup");
const { getStorage } = require("firebase-admin/storage");
const { onSchedule } = require("firebase-functions/v2/scheduler");

initializeApp();
const TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const REGION = "us-central1";
const opts = { region: REGION, secrets: [TOKEN] };

// Bộ đếm tin nhắn trong bộ nhớ dùng chung giữa các yêu cầu của cùng một instance.
const mem = new Map();
const botFor = () => createBot({ db: getFirestore(), tg: createTelegram(TOKEN.value()), mem });
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
    await tg.setMyCommands([
      { command: "trong", description: "Phòng còn trống (vd /trong 25/12 27/12)" },
      { command: "phong", description: "Các phòng và giá" },
      { command: "lienhe", description: "Thông tin liên hệ" },
      { command: "dat", description: "Mở trang đặt phòng" },
    ]);
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
