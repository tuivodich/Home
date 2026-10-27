"use strict";
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { createTelegram } = require("./telegram");
const { createBot, webhookSecret, safeEq, FRONT } = require("./bot");

initializeApp();
const TOKEN = defineSecret("TELEGRAM_BOT_TOKEN");
const REGION = "us-central1";
const opts = { region: REGION, secrets: [TOKEN] };

const botFor = () => createBot({ db: getFirestore(), tg: createTelegram(TOKEN.value()) });
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
      { command: "homnay", description: "Khách nhận/trả phòng hôm nay" },
      { command: "cho", description: "Yêu cầu đang chờ xác nhận" },
      { command: "trong", description: "Phòng còn trống (vd /trong 25/12)" },
      { command: "huylienket", description: "Ngừng nhận thông báo ở chat này" },
    ]);
    return { username: bot.username, url };
  } catch (e) { throw new HttpsError("internal", e.message); }
});
