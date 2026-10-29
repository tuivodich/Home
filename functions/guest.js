"use strict";
const site = require("./site");
const pricing = require("./pricing");

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const money = (n) => `${new Intl.NumberFormat("vi-VN").format(Math.round(n || 0))} VNĐ`;
const fmtDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : s ?? ""; };
const nightsOf = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
const addDays = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const todayVN = (now) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
const codeOf = (b) => b.code || String(b.id).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
const validEmail = (s) => typeof s === "string" && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(s.trim()) && s.length <= 200;

/** Kiểu tin gửi cho khách theo trạng thái đặt phòng. */
const KINDS = ["received", "confirmed", "cancelled", "reminder", "review"];

/** Máy gửi email (SMTP). Chưa cấu hình tài khoản thì `enabled` = false và mọi lần gửi bị bỏ qua. */
function createMailer({ user, pass, host = "smtp.gmail.com", port = 465, transport } = {}) {
  const ok = !!transport || (!!user && user !== "-" && !!pass && pass !== "-");
  let tr = transport;
  return {
    enabled: ok, from: user,
    async send(msg) {
      if (!ok) return false;
      if (!tr) tr = require("nodemailer").createTransport({ host, port, secure: port === 465, auth: { user, pass } });
      await tr.sendMail(msg);
      return true;
    },
  };
}

function createGuest({ db, tg, mailer, now = () => new Date() }) {
  const FieldValue = require("firebase-admin/firestore").FieldValue;
  const get = async (path) => { const s = await db.doc(path).get(); return s.exists ? { id: s.id, ...s.data() } : null; };
  /** Ghi nhật ký hoạt động (bỏ qua khi chủ đã tắt trong settings/audit). */
  const auditAdd = async (entry) => { if ((await get("settings/audit"))?.enabled === false) return; return db.collection("auditLog").add(entry); };
  const once = async (key) => { try { await db.doc(`tgSent/${key}`).create({ at: FieldValue.serverTimestamp() }); return true; } catch { return false; } };
  const staffChats = async (roles) => (await db.collection("tgChats").get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => roles.includes(c.role));

  // ===== Kiểm tra giá phía máy chủ =====
  /**
   * Tính lại giá của yêu cầu đặt phòng online theo bảng giá hiện hành (khách chỉ gửi kết quả tính ở trình duyệt, không đáng tin).
   * Lệch thì sửa total/deposit/lines và ghi priceCorrected. Mỗi yêu cầu chỉ kiểm một lần (priceChecked).
   */
  async function verifyBooking(id) {
    const b = await get(`bookings/${id}`);
    if (!b || b.source !== "online" || b.status !== "pending" || b.priceChecked) return { checked: false };
    const room = await get(`rooms/${b.roomId}`);
    const count = nightsOf(b.checkIn, b.checkOut);
    if (!room || !(count >= 1 && count <= 365)) return { checked: false };
    const [p, c] = await Promise.all([get("settings/pricing"), get("settings/booking")]);
    const pc = pricing.parsePricing(p ?? undefined), cfg = pricing.parseBooking(c ?? undefined);
    let couponPercent = 0;
    if (b.couponCode) couponPercent = Number((await get(`coupons/${b.couponCode}`))?.percent) || 0;
    const o = b.opts && typeof b.opts === "object" ? b.opts : {};
    const services = {};
    for (const [k, v] of Object.entries(o.services && typeof o.services === "object" ? o.services : {})) if (Number.isFinite(v) && v > 0) services[k] = Math.min(20, Math.floor(v));
    const q = pricing.quoteFull({ price: Number(room.price) || 0, capacity: Number(room.capacity) || 1, baseGuests: room.baseGuests }, b.checkIn, count, Number(b.guests) || 1, pc, cfg, { early: !!o.early, late: !!o.late, services, couponPercent });
    const sameTotal = Math.round(b.total) === q.total;
    const sameDeposit = (b.deposit ?? 0) === q.deposit;
    if (sameTotal && sameDeposit) { await db.doc(`bookings/${id}`).update({ priceChecked: true }); return { checked: true, corrected: false }; }
    await db.doc(`bookings/${id}`).update({
      total: q.total, deposit: q.deposit > 0 ? q.deposit : FieldValue.delete(), lines: pricing.quoteLines(q, room.name),
      ...(b.couponCode ? { originalTotal: q.originalTotal, discountPercent: couponPercent } : {}),
      priceChecked: true, priceCorrected: true, clientTotal: Number(b.total) || 0,
    });
    return { checked: true, corrected: true, from: Number(b.total) || 0, to: q.total };
  }

  // ===== Nội dung tin cho khách =====
  async function context(b) {
    const [room, bankDoc, cfgDoc] = await Promise.all([get(`rooms/${b.roomId}`), get("settings/bank"), get("settings/booking")]);
    const cfg = pricing.parseBooking(cfgDoc ?? undefined);
    const bank = bankDoc && /^\d{6}$/.test(String(bankDoc.bankBin)) && bankDoc.accountNo && bankDoc.accountName ? bankDoc : null;
    return { roomName: room?.name ?? "phòng", cfg, bank };
  }

  function render(kind, b, ctx) {
    const code = codeOf(b), n = nightsOf(b.checkIn, b.checkOut);
    const due = Math.max(0, (b.deposit ?? 0) - (b.paid ?? 0));
    const head = {
      received: ["Đã nhận yêu cầu đặt phòng", "Cảm ơn bạn đã đặt phòng! Chúng tôi đã nhận yêu cầu và sẽ xác nhận sớm."],
      confirmed: ["Đặt phòng đã được xác nhận", "Đặt phòng của bạn đã được xác nhận. Hẹn gặp bạn!"],
      cancelled: ["Đặt phòng không còn hiệu lực", b.cancelReason === "expired" ? "Yêu cầu đặt phòng đã hết hạn vì chưa được xác nhận trước ngày nhận phòng." : "Rất tiếc, homestay không thể giữ phòng cho yêu cầu này. Bạn có thể đặt ngày khác hoặc liên hệ để được hỗ trợ."],
      reminder: ["Nhắc lịch nhận phòng ngày mai", "Ngày mai bạn nhận phòng. Dưới đây là thông tin để bạn chuẩn bị."],
      review: ["Cảm ơn bạn đã lưu trú", "Cảm ơn bạn đã chọn " + site.name + "! Nếu có vài phút, bạn chia sẻ cảm nhận về kỳ nghỉ giúp chúng tôi nhé — mỗi lời nhận xét giúp những vị khách sau chọn đúng nơi nghỉ và giúp chúng tôi phục vụ tốt hơn."],
    }[kind];
    const rows = [
      ["Mã đặt phòng", code], ["Phòng", ctx.roomName], ["Nhận phòng", `${fmtDate(b.checkIn)} (từ ${ctx.cfg.checkInTime})`],
      ["Trả phòng", `${fmtDate(b.checkOut)} (trước ${ctx.cfg.checkOutTime})`], ["Số đêm / khách", `${n} đêm · ${b.guests} khách`], ["Tổng tiền", money(b.total)],
    ];
    if (b.deposit > 0) rows.push(["Tiền cọc", `${money(b.deposit)}${(b.paid ?? 0) >= b.deposit ? " (đã nhận)" : ""}`]);
    const review = kind === "review";
    const showPay = !review && kind !== "cancelled" && due > 0 && ctx.bank;
    const payText = showPay ? `\nChuyển khoản đặt cọc ${money(due)}:\n${ctx.bank.bankName || "Ngân hàng"} · STK ${ctx.bank.accountNo} · ${ctx.bank.accountName}\nNội dung: NHAGO ${code}` : "";
    const qr = showPay ? `https://img.vietqr.io/image/${ctx.bank.bankBin}-${ctx.bank.accountNo}-compact2.png?${new URLSearchParams({ amount: String(due), addInfo: `NHAGO ${code}`, accountName: ctx.bank.accountName })}` : "";
    const cancelPolicy = ctx.cfg.cancelTiers.map((t) => `từ ${t.daysBefore} ngày trước: hoàn ${t.refundPercent}%`).join("; ");
    const foot = kind === "cancelled" || review ? "" : `\nChính sách hủy: ${cancelPolicy}.${ctx.cfg.cancelNote ? ` ${ctx.cfg.cancelNote}` : ""}`;
    const subject = `[${site.name}] ${head[0]} — ${code}`;
    const reviewUrl = `${site.url}/reviews#write`;
    const text = review
      ? `${head[1]}\n\nViết cảm nhận: ${reviewUrl}\n\nMã đặt phòng: ${code} · ${ctx.roomName} · ${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)}`
      : `${head[1]}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}${payText}${foot}\n\nXem trạng thái: ${site.url}/account\nTra nhanh trên Telegram: gõ /tra ${code}`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#1f2a24">
<h2 style="color:#1e4d3a;margin:0 0 8px">${esc(head[0])}</h2><p>${esc(head[1])}</p>
${review ? "" : `<table style="border-collapse:collapse;width:100%">${rows.map(([k, v]) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #e5e5e0;color:#666">${esc(k)}</td><td style="padding:6px 8px;border-bottom:1px solid #e5e5e0"><b>${esc(v)}</b></td></tr>`).join("")}</table>`}
${showPay ? `<h3 style="margin:18px 0 6px">Đặt cọc ${esc(money(due))}</h3><p style="margin:0">${esc(ctx.bank.bankName || "Ngân hàng")} · STK <b>${esc(ctx.bank.accountNo)}</b> · ${esc(ctx.bank.accountName)}<br>Nội dung chuyển khoản: <b>NHAGO ${esc(code)}</b></p><p><img src="${esc(qr)}" alt="VietQR" width="220" style="max-width:100%"></p>` : ""}
${kind === "cancelled" || review ? "" : `<p style="color:#555;font-size:13px">Chính sách hủy: ${esc(cancelPolicy)}.${ctx.cfg.cancelNote ? ` ${esc(ctx.cfg.cancelNote)}` : ""}</p>`}
<p><a href="${esc(review ? reviewUrl : site.url + "/account")}" style="background:#1e4d3a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">${review ? "Viết cảm nhận của bạn" : "Xem đặt phòng của tôi"}</a></p>
<p style="color:#888;font-size:12px">${esc(site.name)} · ${esc(site.url)}</p></div>`;
    const tgText = review ? `<b>${esc(head[0])}</b>\n${esc(head[1])}\n\n⭐ <a href="${esc(reviewUrl)}">Viết cảm nhận của bạn</a>` : `<b>${esc(head[0])}</b>\n${esc(head[1])}\n\n${rows.map(([k, v]) => `${esc(k)}: <b>${esc(v)}</b>`).join("\n")}${showPay ? `\n\n💸 Đặt cọc ${esc(money(due))}: ${esc(ctx.bank.bankName || "")} STK <code>${esc(ctx.bank.accountNo)}</code> · ${esc(ctx.bank.accountName)}\nNội dung: <code>NHAGO ${esc(code)}</code>` : ""}`;
    return { subject, text, html, tg: tgText };
  }

  /** Gửi tin cho khách (email nếu đã bật và có email; Telegram nếu khách đã liên kết). Mỗi (đặt phòng, loại tin) chỉ gửi một lần. */
  async function dispatch(id, kind) {
    if (!KINDS.includes(kind)) return { email: false, telegram: 0 };
    const b = await get(`bookings/${id}`);
    if (!b || b.source !== "online") return { email: false, telegram: 0 };
    const okState = { received: b.status === "pending", confirmed: b.status === "confirmed", cancelled: b.status === "cancelled" && b.cancelReason !== "customer" && b.cancelReason !== "noshow", reminder: b.status === "confirmed", review: b.status === "checked_out" }[kind];
    if (!okState) return { email: false, telegram: 0 };
    const mail = (await get("settings/mail")) ?? {};
    if (kind === "review" && mail.reviewRequest === false) return { email: false, telegram: 0 }; // chủ tắt email xin đánh giá
    if (!(await once(`gm_${id}_${kind}`))) return { email: false, telegram: 0 };
    const ctx = await context(b);
    const msg = render(kind, b, ctx);
    let email = false, telegram = 0;
    if (mail.enabled === true && mailer?.enabled && validEmail(b.email)) {
      try {
        email = await mailer.send({ from: `"${String(mail.fromName || site.name).replace(/["\r\n]/g, "")}" <${mailer.from}>`, to: b.email.trim(), ...(validEmail(mail.replyTo) ? { replyTo: mail.replyTo.trim() } : {}), subject: msg.subject, text: msg.text, html: msg.html });
      } catch (e) { console.error("guest mail failed", id, kind, e.message); }
    }
    if (b.createdBy && tg) {
      const chats = (await db.collection("tgGuests").where("uid", "==", b.createdBy).get()).docs;
      const r = await Promise.allSettled(chats.map((d) => tg.sendMessage(d.id, msg.tg)));
      telegram = r.filter((x) => x.status === "fulfilled").length;
    }
    return { email, telegram };
  }

  /** Quét định kỳ: kiểm giá các yêu cầu mới, gửi tin theo trạng thái (cho trường hợp xác nhận/hủy trên web hoặc khách bỏ qua bước báo). */
  async function sweep() {
    const t = todayVN(now());
    const state = await get("settings/mailState");
    const all = (await db.collection("bookings").where("checkIn", ">=", addDays(t, -1)).get()).docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => b.source === "online");
    // Lần chạy đầu: ghi nhận trạng thái hiện có là "đã báo" để không gửi hàng loạt cho đặt phòng cũ.
    if (!state?.baselined) {
      for (const b of all) {
        const k = b.status === "pending" ? "received" : b.status === "confirmed" ? "confirmed" : b.status === "cancelled" && b.cancelReason !== "customer" && b.cancelReason !== "noshow" ? "cancelled" : "";
        if (k) await once(`gm_${b.id}_${k}`);
      }
      await db.doc("settings/mailState").set({ baselined: true, at: FieldValue.serverTimestamp() });
      return { baseline: all.length, verified: 0, sent: 0 };
    }
    let verified = 0, sent = 0;
    for (const b of all) {
      if (b.status === "pending" && !b.priceChecked) { const v = await verifyBooking(b.id); if (v.checked) verified++; }
      const kind = b.status === "pending" ? "received" : b.status === "confirmed" ? "confirmed" : b.status === "cancelled" ? "cancelled" : "";
      if (kind) { const r = await dispatch(b.id, kind); if (r.email || r.telegram) sent++; }
    }
    return { verified, sent };
  }

  /**
   * Dọn các đặt phòng bị treo (chạy định kỳ, không cần ai mở trang quản lý):
   * - "Chờ xác nhận" mà đã qua ngày nhận phòng → hết hạn (nếu settings/app.autoRejectPending khác false), báo khách như hết hạn.
   * - "Đã xác nhận" mà đã qua ngày trả phòng và chưa nhận phòng → "khách không đến" (nếu settings/app.autoNoShow khác false):
   *   chuyển Đã hủy (cancelReason "noshow"), nhả phòng, GIỮ NGUYÊN tiền cọc đã nhận; báo chủ/quản lý qua Telegram; không gửi email cho khách.
   */
  async function expireStale() {
    const t = todayVN(now());
    const app = (await get("settings/app")) ?? {};
    const rejectPending = app.autoRejectPending !== false, markNoShow = app.autoNoShow !== false;
    const snap = await db.collection("bookings").where("status", "in", ["pending", "confirmed"]).get();
    const expired = [], noShows = [];
    for (const d of snap.docs) {
      const b = { id: d.id, ...d.data() };
      if (b.status === "pending" && rejectPending && b.checkIn < t) {
        const w = db.batch();
        w.update(d.ref, { status: "cancelled", cancelReason: "expired" });
        w.delete(db.doc(`busy/${d.id}`));
        if (b.slotId) w.delete(db.doc(`pend/${b.slotId}`));
        await w.commit();
        await auditAdd({ at: FieldValue.serverTimestamp(), by: "system", byName: "Hệ thống", role: "system", action: "booking.expire", summary: `Tự hết hạn: ${b.guestName} (chờ xác nhận quá ngày nhận ${fmtDate(b.checkIn)})`.slice(0, 300), targetType: "booking", targetId: d.id }).catch(() => {});
        expired.push(b);
      } else if (b.status === "confirmed" && markNoShow && b.checkOut < t) {
        const w = db.batch();
        w.update(d.ref, { status: "cancelled", cancelReason: "noshow", noShowAt: FieldValue.serverTimestamp() });
        w.delete(db.doc(`busy/${d.id}`));
        await w.commit();
        await auditAdd({ at: FieldValue.serverTimestamp(), by: "system", byName: "Hệ thống", role: "system", action: "booking.noshow", summary: `Tự hủy do khách không đến: ${b.guestName} (${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)})${(b.paid ?? 0) > 0 ? ` · cọc ${money(b.paid)} giữ trong sổ` : ""}`.slice(0, 300), targetType: "booking", targetId: d.id }).catch(() => {});
        noShows.push(b);
      }
    }
    for (const b of expired) await dispatch(b.id, "cancelled").catch((e) => console.error("expire mail", e));
    const fresh = [];
    for (const b of noShows) if (await once(`ns_${b.id}`)) fresh.push(b);
    if (fresh.length && tg) {
      const rooms = new Map((await db.collection("rooms").get()).docs.map((r) => [r.id, r.data().name]));
      const rows = fresh.map((b) => `• <b>${esc(b.guestName)}</b> — ${esc(rooms.get(b.roomId) ?? "?")}, ${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)}${(b.paid ?? 0) > 0 ? ` · đã nhận ${esc(money(b.paid))} (giữ trong sổ, xử lý theo chính sách)` : ""}`);
      const text = `🚫 <b>Khách không đến — đã tự động hủy</b>\n${rows.join("\n")}`;
      await Promise.allSettled((await staffChats(["owner", "manager"])).map((c) => tg.sendMessage(c.id, text)));
    }
    return { expired: expired.length, noShows: noShows.length };
  }

  /** Nhắc khách có lịch nhận phòng vào ngày mai (chạy buổi sáng). */
  async function reminders() {
    const tomorrow = addDays(todayVN(now()), 1);
    const snap = await db.collection("bookings").where("checkIn", "==", tomorrow).get();
    let sent = 0;
    for (const d of snap.docs) { const r = await dispatch(d.id, "reminder"); if (r.email || r.telegram) sent++; }
    // Xin đánh giá: khách online đã trả phòng 1–3 ngày trước và chưa viết cảm nhận.
    const t = todayVN(now());
    const done = await db.collection("bookings").where("checkOut", ">=", addDays(t, -3)).get();
    let asked = 0;
    for (const d of done.docs) {
      const b = d.data();
      if (b.status !== "checked_out" || b.source !== "online" || b.checkOut >= t || !b.createdBy) continue;
      if ((await db.doc(`reviews/${b.createdBy}`).get()).exists) continue; // đã có cảm nhận
      const r = await dispatch(d.id, "review");
      if (r.email || r.telegram) asked++;
    }
    return { sent, asked };
  }

  /** Báo quản lý khi hệ thống phải sửa giá do khách gửi lên khác bảng giá. */
  async function alertCorrected(id, v) {
    if (!v?.corrected || !tg) return 0;
    const b = await get(`bookings/${id}`);
    const chats = await staffChats(["owner", "manager"]);
    const text = `⚠️ <b>Giá được hệ thống điều chỉnh</b>\nĐặt phòng ${esc(codeOf(b ?? { id }))}: khách gửi ${esc(money(v.from))}, theo bảng giá là <b>${esc(money(v.to))}</b>. Đã cập nhật lại; nếu bạn thấy đáng ngờ hãy liên hệ khách.`;
    return (await Promise.allSettled(chats.map((c) => tg.sendMessage(c.id, text)))).filter((r) => r.status === "fulfilled").length;
  }

  return { verifyBooking, dispatch, sweep, reminders, alertCorrected, expireStale, render };
}

module.exports = { createGuest, createMailer, KINDS };
