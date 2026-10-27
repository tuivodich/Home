"use strict";
const crypto = require("node:crypto");

/** Vai trò được nhận thông báo / thao tác qua bot. */
const FRONT = ["owner", "manager", "reception"];
const LIVE = ["confirmed", "checked_in", "checked_out"]; // chặn trùng khi xác nhận (giống ứng dụng)
const HELD = ["pending", "confirmed", "checked_in"]; // đang giữ phòng

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmtDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : s ?? ""; };
const money = (n) => `${new Intl.NumberFormat("vi-VN").format(Math.round(n || 0))} VNĐ`;
const nights = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
const addDays = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const overlaps = (aIn, aOut, bIn, bOut) => aIn < bOut && bIn < aOut;
/** Ngày hôm nay theo giờ Việt Nam (yyyy-mm-dd). */
const todayVN = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);

/** Đọc "dd/mm/yyyy", "dd/mm" hoặc "yyyy-mm-dd" thành yyyy-mm-dd; sai thì trả null. */
function parseDate(text, today) {
  const t = String(text ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return t;
  m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{4}))?$/.exec(t);
  if (!m) return null;
  const y = m[3] ?? today.slice(0, 4);
  const iso = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return Number.isNaN(Date.parse(iso + "T00:00:00Z")) || new Date(iso + "T00:00:00Z").toISOString().slice(0, 10) !== iso ? null : iso;
}

/** Mã bí mật gắn webhook: suy ra từ token để không cần thêm secret thứ hai. */
const webhookSecret = (token) => crypto.createHmac("sha256", token).update("nhago-telegram-webhook").digest("hex").slice(0, 48);

const safeEq = (a, b) => { const x = Buffer.from(String(a ?? "")), y = Buffer.from(String(b ?? "")); return x.length === y.length && crypto.timingSafeEqual(x, y); };

function createBot({ db, tg, now = () => new Date(), randomCode }) {
  const FieldValue = require("firebase-admin/firestore").FieldValue;
  const code8 = randomCode ?? (() => crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "x").slice(0, 8).toUpperCase());
  const get = async (path) => { const s = await db.doc(path).get(); return s.exists ? { id: s.id, ...s.data() } : null; };

  const roomName = async (id) => (await get(`rooms/${id}`))?.name ?? "?";
  const staffChats = async () => {
    const snap = await db.collection("tgChats").get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => FRONT.includes(c.role));
  };
  const sendAll = async (text, extra) => {
    const chats = await staffChats();
    const results = await Promise.allSettled(chats.map((c) => tg.sendMessage(c.id, text, extra)));
    return results.filter((r) => r.status === "fulfilled").length;
  };
  /** Ghi dấu đã gửi; trả false nếu thông báo này đã gửi trước đó (create() lỗi khi tài liệu đã có). */
  const once = async (key) => { try { await db.doc(`tgSent/${key}`).create({ at: FieldValue.serverTimestamp() }); return true; } catch { return false; } };

  const bookingText = async (b, head) => [
    head,
    `👤 <b>${esc(b.guestName)}</b> · ${esc(b.phone)}${b.email ? ` · ${esc(b.email)}` : ""}`,
    `🛏 ${esc(await roomName(b.roomId))} · ${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)} (${nights(b.checkIn, b.checkOut)} đêm) · ${b.guests} khách`,
    `💰 ${money(b.total)}${b.couponCode ? ` · 🏷 ${esc(b.couponCode)} (−${b.discountPercent}%)` : ""}`,
    b.note ? `📝 ${esc(b.note)}` : "",
  ].filter(Boolean).join("\n");
  const buttons = (id) => ({ reply_markup: { inline_keyboard: [[{ text: "✅ Xác nhận", callback_data: `cf:${id}` }, { text: "❌ Từ chối", callback_data: `rj:${id}` }]] } });

  // ===== Thông báo do ứng dụng gọi (đã xác thực tài khoản khách) =====
  async function notify(uid, { type, id }) {
    if (type === "booking") {
      const b = await get(`bookings/${id}`);
      if (!b || b.createdBy !== uid || b.status !== "pending" || b.source !== "online") return { sent: 0 };
      if (!(await once(`b_${id}`))) return { sent: 0 };
      return { sent: await sendAll(await bookingText(b, "🔔 <b>Yêu cầu đặt phòng mới</b>"), buttons(id)) };
    }
    if (type === "cancel") {
      const b = await get(`bookings/${id}`);
      if (!b || b.createdBy !== uid || b.status !== "cancelled" || b.cancelReason !== "customer") return { sent: 0 };
      if (!(await once(`c_${id}`))) return { sent: 0 };
      return { sent: await sendAll(await bookingText(b, "🚫 <b>Khách đã hủy đặt phòng</b>")) };
    }
    if (type === "review") {
      const r = await get(`reviews/${uid}`);
      if (!r || r.status !== "pending") return { sent: 0 };
      const h = crypto.createHash("sha1").update(`${r.name}|${r.rating}|${r.comment}`).digest("hex").slice(0, 12);
      if (!(await once(`r_${uid}_${h}`))) return { sent: 0 };
      return { sent: await sendAll(`⭐ <b>Cảm nhận mới chờ duyệt</b> (${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)})\n<b>${esc(r.name)}</b>: ${esc(r.comment)}\n\nDuyệt ở trang quản trị → Nội dung → Cảm nhận khách.`) };
    }
    return { sent: 0 };
  }

  // ===== Liên kết tài khoản nhân viên với chat Telegram =====
  async function linkCode(uid) {
    const u = await get(`users/${uid}`);
    if (!u || !FRONT.includes(u.role)) throw Object.assign(new Error("Chỉ chủ, quản lý, lễ tân mới liên kết được."), { code: "permission-denied" });
    const code = code8();
    await db.doc(`tgLinks/${code}`).set({ uid, exp: now().getTime() + 30 * 60 * 1000 });
    const me = await tg.getMe();
    return { code, username: me.username, link: `https://t.me/${me.username}?start=${code}` };
  }

  // ===== Xử lý hành động trên yêu cầu đặt phòng =====
  async function decide(action, id, actor) {
    const b = await get(`bookings/${id}`);
    if (!b) return { ok: false, text: "Không tìm thấy đặt phòng (có thể đã bị xóa)." };
    if (b.status !== "pending") return { ok: false, text: `Yêu cầu này đã được xử lý (${b.status === "cancelled" ? "đã hủy/từ chối" : "đã xác nhận"}).` };
    if (action === "cf") {
      const all = (await db.collection("bookings").where("roomId", "==", b.roomId).get()).docs;
      const clash = all.find((d) => d.id !== id && LIVE.includes(d.data().status) && overlaps(d.data().checkIn, d.data().checkOut, b.checkIn, b.checkOut));
      if (clash) return { ok: false, text: "⚠️ Trùng lịch với một đặt phòng đã xác nhận cùng phòng. Hãy xử lý trên trang quản trị." };
      const w = db.batch();
      w.update(db.doc(`bookings/${id}`), { status: "confirmed" });
      w.set(db.doc(`busy/${id}`), { roomId: b.roomId, checkIn: b.checkIn, checkOut: b.checkOut, status: "confirmed" });
      if (b.slotId) w.delete(db.doc(`pend/${b.slotId}`));
      await w.commit();
      return { ok: true, text: `✅ Đã xác nhận bởi ${esc(actor)}` };
    }
    const w = db.batch();
    w.update(db.doc(`bookings/${id}`), { status: "cancelled" });
    w.delete(db.doc(`busy/${id}`));
    if (b.slotId) w.delete(db.doc(`pend/${b.slotId}`));
    await w.commit();
    return { ok: true, text: `❌ Đã từ chối bởi ${esc(actor)}` };
  }

  // ===== Lệnh trong chat =====
  const HELP = "Lệnh:\n/homnay — khách nhận/trả phòng hôm nay\n/cho — yêu cầu đang chờ xác nhận\n/trong [ngày] — phòng còn trống (vd /trong 25/12)\n/huylienket — ngừng nhận thông báo ở chat này";

  async function today() {
    const d = todayVN(now());
    const [bk, rooms] = await Promise.all([db.collection("bookings").get(), db.collection("rooms").get()]);
    const names = new Map(rooms.docs.map((r) => [r.id, r.data().name]));
    const list = bk.docs.map((x) => ({ id: x.id, ...x.data() }));
    const line = (b) => `• ${esc(b.guestName)} — ${esc(names.get(b.roomId) ?? "?")} (${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)})`;
    const arr = list.filter((b) => b.checkIn === d && ["confirmed", "pending"].includes(b.status));
    const dep = list.filter((b) => b.checkOut === d && b.status === "checked_in");
    const inn = list.filter((b) => b.status === "checked_in");
    return [`📅 <b>Hôm nay ${fmtDate(d)}</b>`,
      `\n🛬 Nhận phòng (${arr.length}):`, ...(arr.length ? arr.map((b) => line(b) + (b.status === "pending" ? " — chờ xác nhận" : "")) : ["• không có"]),
      `\n🛫 Trả phòng (${dep.length}):`, ...(dep.length ? dep.map(line) : ["• không có"]),
      `\n🏠 Đang ở: ${inn.length} đặt phòng`].join("\n");
  }

  async function pendingList(chatId) {
    const snap = await db.collection("bookings").where("status", "==", "pending").get();
    const items = snap.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    if (!items.length) return tg.sendMessage(chatId, "Không có yêu cầu nào đang chờ xác nhận 👍");
    for (const b of items.slice(0, 10)) await tg.sendMessage(chatId, await bookingText(b, "⏳ <b>Chờ xác nhận</b>"), buttons(b.id));
    if (items.length > 10) await tg.sendMessage(chatId, `… và ${items.length - 10} yêu cầu nữa, xem trên trang quản trị.`);
  }

  async function freeRooms(arg) {
    const d = arg ? parseDate(arg, todayVN(now())) : todayVN(now());
    if (!d) return "Ngày không hợp lệ. Ví dụ: /trong 25/12 hoặc /trong 25/12/2026";
    const [rooms, busy] = await Promise.all([db.collection("rooms").get(), db.collection("busy").get()]);
    const held = busy.docs.map((x) => x.data()).filter((x) => HELD.includes(x.status) && overlaps(x.checkIn, x.checkOut, d, addDays(d, 1)));
    const free = rooms.docs.map((r) => ({ id: r.id, ...r.data() })).filter((r) => r.status !== "maintenance" && !held.some((x) => x.roomId === r.id));
    return `🛏 <b>Đêm ${fmtDate(d)}</b>: còn ${free.length}/${rooms.size} phòng trống` + (free.length ? "\n" + free.map((r) => `• ${esc(r.name)} — ${money(r.price)}`).join("\n") : "");
  }

  async function handleMessage(msg) {
    const chatId = String(msg.chat.id);
    const text = String(msg.text ?? "").trim();
    if (!text.startsWith("/")) return;
    const [cmdRaw, ...rest] = text.split(/\s+/);
    const cmd = cmdRaw.split("@")[0].toLowerCase();
    const linked = await get(`tgChats/${chatId}`);

    if (cmd === "/start") {
      const code = (rest[0] ?? "").toUpperCase();
      if (!code) {
        return tg.sendMessage(chatId, linked
          ? `Chat này đã liên kết. ${HELP}`
          : `Xin chào! Để nhận thông báo, vào trang quản trị → Cài đặt → Bot Telegram → “Liên kết Telegram của tôi”, rồi bấm đường dẫn nhận được.\n\nMã chat: <code>${chatId}</code>`);
      }
      const link = await get(`tgLinks/${code}`);
      if (!link || link.exp < now().getTime()) return tg.sendMessage(chatId, "Mã liên kết không đúng hoặc đã hết hạn (30 phút). Hãy tạo mã mới ở trang quản trị.");
      const u = await get(`users/${link.uid}`);
      if (!u || !FRONT.includes(u.role)) return tg.sendMessage(chatId, "Tài khoản này không còn quyền nhân viên.");
      await db.doc(`tgChats/${chatId}`).set({ uid: link.uid, role: u.role, email: u.email ?? "", name: msg.chat.title ?? msg.from?.first_name ?? "", type: msg.chat.type, linkedAt: FieldValue.serverTimestamp() });
      await db.doc(`tgLinks/${code}`).delete();
      return tg.sendMessage(chatId, `✅ Đã liên kết với ${esc(u.email ?? "tài khoản của bạn")}. Từ giờ chat này nhận thông báo đặt phòng.\n\n${HELP}`);
    }

    if (!linked) return tg.sendMessage(chatId, "Chat này chưa liên kết. Gửi /start để xem cách liên kết.");
    // Kiểm tra lại vai trò hiện tại của người đã liên kết (bị hạ quyền thì mất quyền dùng bot).
    const u = await get(`users/${linked.uid}`);
    if (!u || !FRONT.includes(u.role)) { await db.doc(`tgChats/${chatId}`).delete(); return tg.sendMessage(chatId, "Tài khoản liên kết không còn quyền nhân viên; đã ngắt liên kết."); }

    if (cmd === "/homnay") return tg.sendMessage(chatId, await today());
    if (cmd === "/cho") return pendingList(chatId);
    if (cmd === "/trong") return tg.sendMessage(chatId, await freeRooms(rest.join(" ")));
    if (cmd === "/huylienket") { await db.doc(`tgChats/${chatId}`).delete(); return tg.sendMessage(chatId, "Đã ngừng nhận thông báo ở chat này."); }
    return tg.sendMessage(chatId, HELP);
  }

  async function handleCallback(cb) {
    const chatId = String(cb.message?.chat?.id ?? "");
    const [action, id] = String(cb.data ?? "").split(":");
    if (!["cf", "rj"].includes(action) || !id) return tg.answerCallbackQuery(cb.id, "Thao tác không hợp lệ");
    const linked = await get(`tgChats/${chatId}`);
    const u = linked && (await get(`users/${linked.uid}`));
    if (!u || !FRONT.includes(u.role)) return tg.answerCallbackQuery(cb.id, "Chat chưa liên kết hoặc không đủ quyền");
    const actor = cb.from?.first_name || u.email || "nhân viên";
    const r = await decide(action, id, actor);
    await tg.answerCallbackQuery(cb.id, r.ok ? "Đã xong" : r.text.replace(/<[^>]+>/g, "").slice(0, 150));
    if (cb.message) {
      const base = cb.message.text ?? "";
      // Giữ nguyên nội dung cũ, thay hàng nút bằng kết quả.
      await tg.editMessageText(chatId, cb.message.message_id, `${esc(base)}\n\n${r.text}`, { reply_markup: { inline_keyboard: [] } }).catch(() => {});
    }
  }

  async function handleUpdate(update) {
    if (update.message) return handleMessage(update.message);
    if (update.callback_query) return handleCallback(update.callback_query);
  }

  return { notify, linkCode, handleUpdate, decide };
}

module.exports = { createBot, webhookSecret, safeEq, parseDate, todayVN, FRONT };
