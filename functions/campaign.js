"use strict";
const site = require("./site");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const validEmail = (s) => typeof s === "string" && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(s.trim()) && s.length <= 200;
const MAX_PER_CALL = 100;

/** Nội dung soạn tay (văn bản thuần) → HTML an toàn: xuống dòng, đường dẫn http(s) thành liên kết. */
function bodyHtml(text) {
  return esc(text).split(/\n{2,}/).map((p) => `<p style="margin:0 0 12px;line-height:1.6">${p.replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:#1e4d3a">${u}</a>`)}</p>`).join("");
}

/**
 * Gửi email tới nhiều khách (khuyến mãi, thông báo…) do chủ/quản lý soạn.
 * Chỉ gửi tới địa chỉ đã có trong hệ thống (tài khoản, đặt phòng, hồ sơ khách) hoặc email của chính người gửi; tối đa 100 địa chỉ mỗi lần.
 */
function createCampaign({ db, mailer, now = () => new Date() }) {
  const FieldValue = require("firebase-admin/firestore").FieldValue;

  async function knownEmails() {
    const set = new Set();
    const add = (v) => { if (validEmail(v)) set.add(v.trim().toLowerCase()); };
    for (const col of ["users", "bookings", "guests"]) (await db.collection(col).get()).docs.forEach((d) => add(d.data().email));
    return set;
  }

  async function send({ uid, selfEmail, selfEmails, test, subject, body, to }) {
    const sub = String(subject ?? "").trim(), text = String(body ?? "").trim();
    if (!sub || sub.length > 150) throw Object.assign(new Error("Tiêu đề từ 1 đến 150 ký tự."), { code: "invalid-argument" });
    if (!text || text.length > 5000) throw Object.assign(new Error("Nội dung từ 1 đến 5000 ký tự."), { code: "invalid-argument" });
    const list = [...new Set((Array.isArray(to) ? to : []).filter(validEmail).map((e) => e.trim().toLowerCase()))];
    if (!list.length) throw Object.assign(new Error("Chưa chọn người nhận."), { code: "invalid-argument" });
    if (list.length > MAX_PER_CALL) throw Object.assign(new Error(`Mỗi lần gửi tối đa ${MAX_PER_CALL} địa chỉ.`), { code: "invalid-argument" });
    if (!mailer?.enabled) throw Object.assign(new Error("Chưa cấu hình tài khoản gửi email (SMTP_USER / SMTP_PASS)."), { code: "failed-precondition" });
    // Địa chỉ của chính người gửi (email đăng nhập, email trong tài khoản/hồ sơ).
    const own = new Set([selfEmail, ...(selfEmails ?? [])].filter(validEmail).map((e) => e.trim().toLowerCase()));
    // Gửi thử: chỉ tới địa chỉ của chính người gửi. Gửi thật: tới địa chỉ đã có trong hệ thống.
    const known = test ? own : new Set([...(await knownEmails()), ...own]);
    const targets = list.filter((e) => known.has(e));
    const rejected = list.length - targets.length;
    const mail = (await db.doc("settings/mail").get()).data() ?? {};
    const fromName = String(mail.fromName || site.name).replace(/["\r\n]/g, "");
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#1f2a24">
<h2 style="color:#1e4d3a;margin:0 0 12px">${esc(sub)}</h2>${bodyHtml(text)}
<p style="margin:18px 0"><a href="${esc(site.url)}" style="background:#1e4d3a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Xem website ${esc(site.name)}</a></p>
<p style="color:#888;font-size:12px">${esc(site.name)} · ${esc(site.url)}<br>Nếu bạn không muốn nhận thư giới thiệu, hãy trả lời email này và cho chúng tôi biết.</p></div>`;
    let sent = 0, failed = 0;
    for (const to1 of targets) {
      try {
        await mailer.send({ from: `"${fromName}" <${mailer.from}>`, to: to1, ...(validEmail(mail.replyTo) ? { replyTo: mail.replyTo.trim() } : {}), subject: sub, text: `${text}\n\n— ${site.name}\n${site.url}`, html });
        sent++;
      } catch (e) { failed++; console.error("campaign mail failed", e.message); }
    }
    await db.collection("mailCampaigns").add({ subject: sub, preview: text.slice(0, 200), requested: list.length, sent, failed, rejected, by: uid, at: FieldValue.serverTimestamp() });
    return { sent, failed, rejected, to: targets };
  }

  return { send, MAX_PER_CALL };
}

module.exports = { createCampaign, bodyHtml, MAX_PER_CALL };
