"use strict";
const crypto = require("crypto");

const safeEq = (a, b) => { const x = Buffer.from(String(a ?? "")), y = Buffer.from(String(b ?? "")); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const money = (n) => `${new Intl.NumberFormat("vi-VN").format(Math.round(n || 0))} VNĐ`;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : s ?? ""; };

/** Mã đặt phòng nằm sau chữ NHAGO trong nội dung chuyển khoản (ngân hàng có thể bỏ khoảng trắng, đổi hoa/thường). */
function extractCode(content) {
  const m = /NHAGO[\s._-]*([A-Z0-9]{8})/.exec(String(content ?? "").toUpperCase());
  return m ? m[1] : "";
}

/**
 * Chuẩn hóa giao dịch từ dịch vụ báo biến động số dư. Hỗ trợ:
 * - SePay: một giao dịch { id, transferType: "in"|"out", transferAmount, content/description, transactionDate, accountNumber, referenceCode }.
 * - Casso: { error: 0, data: [{ id|tid, amount, description, when, subAccId }] } (chỉ tiền vào: amount > 0).
 * Trả về { txs: [{ source, id, amount, content, when, account }] }; tiền ra bị bỏ.
 */
function normalize(body) {
  const txs = [];
  const b = body && typeof body === "object" ? body : {};
  if (Array.isArray(b.data)) {
    for (const t of b.data) {
      const amount = Number(t?.amount);
      const id = String(t?.id ?? t?.tid ?? "");
      if (id && amount > 0) txs.push({ source: "casso", id, amount, content: String(t.description ?? t.content ?? ""), when: String(t.when ?? ""), account: String(t.bank_sub_acc_id ?? t.subAccId ?? "") });
    }
  } else if (b.id != null && b.transferType) {
    const amount = Number(b.transferAmount);
    if (b.transferType === "in" && amount > 0) txs.push({ source: "sepay", id: String(b.id), amount, content: String(b.content ?? b.description ?? ""), when: String(b.transactionDate ?? ""), account: String(b.accountNumber ?? "") });
  }
  return txs;
}

function createBankHook({ db, notify, now = () => new Date() } = {}) {
  const FieldValue = require("firebase-admin/firestore").FieldValue;
  const Timestamp = require("firebase-admin/firestore").Timestamp;
  const get = async (path) => { const s = await db.doc(path).get(); return s.exists ? { id: s.id, ...s.data() } : null; };
  const audit = async (summary, bookingId) => {
    if ((await get("settings/audit"))?.enabled === false) return;
    await db.collection("auditLog").add({ at: FieldValue.serverTimestamp(), by: "bank", byName: "Ngân hàng (tự động)", role: "bank", action: "payment.in", summary: summary.slice(0, 300), targetType: "booking", targetId: bookingId }).catch(() => {});
  };

  async function findBooking(code) {
    if (!code) return null;
    let hit = (await db.collection("bookings").where("code", "==", code).limit(1).get()).docs[0];
    if (!hit) hit = (await db.collection("bookings").get()).docs.find((d) => !d.data().code && String(d.id).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() === code);
    return hit ? { id: hit.id, ...hit.data() } : null;
  }

  /** Ghi nhận một khoản tiền vào đặt phòng (giao dịch Firestore để không mất khi nhân viên cùng lúc sửa). */
  async function credit(bookingId, amount, note) {
    const ref = db.doc(`bookings/${bookingId}`);
    return db.runTransaction(async (tx) => {
      const b = (await tx.get(ref)).data();
      const paid = (b.paid ?? 0) + amount;
      tx.update(ref, { paid, payLog: [...(b.payLog ?? []), { amount, at: Timestamp.fromMillis(now().getTime()), by: "bank", note }] });
      return { paid, deposit: b.deposit ?? 0, total: b.total ?? 0 };
    });
  }

  async function processTx(t) {
    const key = crypto.createHash("sha1").update(`${t.source}|${t.id}`).digest("hex");
    const ref = db.doc(`bankTx/${key}`);
    const code = extractCode(t.content);
    const base = { source: t.source, txId: t.id, amount: t.amount, content: t.content.slice(0, 300), when: t.when, account: t.account, code, at: FieldValue.serverTimestamp() };
    try { await ref.create({ ...base, matched: false, reason: "" }); } catch { return { id: t.id, result: "duplicate" }; } // đã xử lý giao dịch này
    const b = await findBooking(code);
    let reason = "";
    if (!code) reason = "Nội dung không có mã NHAGO";
    else if (!b) reason = `Không có đặt phòng mã ${code}`;
    else if (b.status === "cancelled") reason = `Đặt phòng ${code} đã hủy`;
    if (reason) {
      await ref.update({ reason });
      if (notify) await notify(`🏦 <b>Nhận ${money(t.amount)} nhưng chưa khớp đặt phòng</b>\n${esc(reason)}\nNội dung: <code>${esc(t.content.slice(0, 120))}</code>\nGán thủ công ở trang quản trị → Tài chính → Đối soát chuyển khoản.`);
      return { id: t.id, result: "unmatched" };
    }
    const r = await credit(b.id, t.amount, `Chuyển khoản ngân hàng (${t.source}${t.id ? ` #${t.id}` : ""})`);
    await ref.update({ matched: true, bookingId: b.id, reason: "" });
    await audit(`Nhận ${money(t.amount)} qua ngân hàng — ${b.guestName} (${code})`, b.id);
    if (notify) {
      const enough = r.deposit > 0 && r.paid >= r.deposit;
      const text = `💰 <b>Đã nhận ${money(t.amount)} qua chuyển khoản</b>\n${esc(b.guestName)} · ${esc(code)} · ${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)}\nĐã thu ${money(r.paid)}${r.deposit ? ` / cọc ${money(r.deposit)}${enough ? " ✅" : " ⚠️ chưa đủ"}` : ""}${r.total ? ` / tổng ${money(r.total)}` : ""}`;
      await notify(text, b.status === "pending" ? { reply_markup: { inline_keyboard: [[{ text: "✅ Xác nhận đặt phòng", callback_data: `cf:${b.id}` }]] } } : undefined);
    }
    return { id: t.id, result: "matched", bookingId: b.id };
  }

  /** Xử lý một lần gọi webhook. headers: tên header viết thường. */
  async function handle(body, headers = {}) {
    const cfg = await get("settings/bankhook");
    if (!cfg?.token) return { status: 503, json: { success: false, error: 1, message: "not configured" } };
    const auth = String(headers.authorization ?? "").replace(/^(Apikey|Bearer)\s+/i, "");
    if (!safeEq(auth, cfg.token) && !safeEq(headers["secure-token"], cfg.token)) return { status: 401, json: { success: false, error: 1, message: "unauthorized" } };
    const txs = normalize(body);
    const results = [];
    for (const t of txs) {
      try { results.push(await processTx(t)); } catch (e) { console.error("bank tx", t.id, e.message); results.push({ id: t.id, result: "error" }); }
    }
    return { status: 200, json: { success: true, error: 0, results } };
  }

  return { handle };
}

module.exports = { createBankHook, extractCode, normalize };
