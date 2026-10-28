"use strict";
const crypto = require("node:crypto");
const site = require("./site");
const pricing = require("./pricing");

/** Vai trò được nhận thông báo / thao tác qua bot. */
const FRONT = ["owner", "manager", "reception"];
const LIVE = ["confirmed", "checked_in", "checked_out"]; // chặn trùng khi xác nhận (giống ứng dụng)
const HELD = ["pending", "confirmed", "checked_in"]; // đang giữ phòng
const MANAGER = ["owner", "manager"];
const STAFF_ALL = ["owner", "manager", "reception", "housekeeping", "security"]; // giống isStaff() trong luật Firestore
const STATUS_VI = { pending: "⏳ đang chờ xác nhận", confirmed: "✅ đã xác nhận", checked_in: "🏠 đang lưu trú", checked_out: "👋 đã trả phòng", cancelled: "🚫 đã hủy" };
/** Đi muộn: quá giờ bắt đầu ca bấy nhiêu phút mà chưa vào ca thì báo quản lý. Quên ra ca: quá giờ kết thúc ca bấy nhiêu phút. */
const LATE_MIN = 15, FORGOT_MIN = 60, NO_SHIFT_FORGOT_H = 12;

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

/** Giới hạn tần suất khách nhắn (chat chưa liên kết): mỗi phút và mỗi ngày; vượt thì bỏ qua để không tốn quota. */
/** Menu lệnh riêng của chat đã liên kết nhân viên. */
const GUEST_COMMANDS = [
  { command: "trong", description: "Phòng còn trống (vd /trong 25/12 27/12)" },
  { command: "gia", description: "Báo giá nhanh (vd /gia 2 4 = 2 đêm, 4 khách)" },
  { command: "phong", description: "Các phòng và giá" },
  { command: "tiennghi", description: "Tiện nghi của homestay" },
  { command: "chinhsach", description: "Giờ nhận/trả phòng, đặt cọc, hủy phòng" },
  { command: "diachi", description: "Địa chỉ và bản đồ" },
  { command: "tra", description: "Tra trạng thái đặt phòng (vd /tra AB12CD34)" },
  { command: "lienhe", description: "Thông tin liên hệ" },
  { command: "dat", description: "Mở trang đặt phòng" },
];
const STAFF_COMMANDS = [
  { command: "homnay", description: "Nhận/trả phòng hôm nay và yêu cầu chờ" },
  { command: "cho", description: "Yêu cầu đang chờ xác nhận" },
  { command: "doanhthu", description: "Doanh thu tuần/tháng (chủ, quản lý)" },
  { command: "tra", description: "Tra đặt phòng theo mã (vd /tra AB12CD34)" },
  { command: "trong", description: "Phòng còn trống (vd /trong 25/12 27/12)" },
  { command: "phong", description: "Các phòng và giá" },
  { command: "huylienket", description: "Ngừng nhận thông báo ở chat này" },
];
const LIMITS = { memPerMin: 20, perMin: 6, perDay: 80 };

/** Bộ đếm trong bộ nhớ của từng instance: chặn lũ tin nhắn mà không tốn lượt đọc/ghi Firestore nào. */
function memAllow(mem, chatId, nowMs) {
  const e = mem.get(chatId);
  if (!e || nowMs - e.t >= 60000) { mem.set(chatId, { t: nowMs, n: 1 }); if (mem.size > 5000) for (const [k, v] of mem) if (nowMs - v.t >= 60000) mem.delete(k); return true; }
  e.n++;
  return e.n <= LIMITS.memPerMin;
}

function createBot({ db, tg, now = () => new Date(), randomCode, mem = new Map() }) {
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
    b.deposit > 0 ? `🏦 Cọc: ${money(b.deposit)}${(b.paid ?? 0) >= b.deposit ? " (đã nhận)" : ""} · Mã chuyển khoản: <code>NHAGO ${String(b.id).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase()}</code>` : "",
    b.note ? `📝 ${esc(b.note)}` : "",
  ].filter(Boolean).join("\n");
  const buttons = (id, b) => ({ reply_markup: { inline_keyboard: [
    [{ text: "✅ Xác nhận", callback_data: `cf:${id}` }, { text: "❌ Từ chối", callback_data: `rj:${id}` }],
    ...(b && b.deposit > 0 && (b.paid ?? 0) < b.deposit ? [[{ text: "💰 Đã nhận cọc", callback_data: `pd:${id}` }]] : []),
  ] } });

  // ===== Thông báo do ứng dụng gọi (đã xác thực tài khoản khách) =====
  async function notify(uid, { type, id }) {
    if (type === "booking") {
      const b = await get(`bookings/${id}`);
      if (!b || b.createdBy !== uid || b.status !== "pending" || b.source !== "online") return { sent: 0 };
      if (!(await once(`b_${id}`))) return { sent: 0 };
      return { sent: await sendAll(await bookingText(b, "🔔 <b>Yêu cầu đặt phòng mới</b>"), buttons(id, b)) };
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
    if (type === "dirty") {
      const u = await get(`users/${uid}`);
      const rs = id && (await get(`roomStatus/${id}`));
      if (!u || !STAFF_ALL.includes(u.role) || !rs || rs.status !== "dirty") return { sent: 0 };
      const stamp = typeof rs.updatedAt?.toMillis === "function" ? rs.updatedAt.toMillis() : 0;
      if (!(await once(`d_${id}_${stamp}`))) return { sent: 0 };
      return { sent: await sendAll(`🧹 <b>${esc(await roomName(id))}</b> vừa trả phòng, cần dọn.`, { reply_markup: { inline_keyboard: [[{ text: "✅ Đã dọn xong", callback_data: `rd:${id}` }]] } }) };
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

  /** Ghi nhận khách đã chuyển cọc (nút "Đã nhận cọc"): cộng vào `paid` và ghi nhật ký thanh toán. */
  async function markDeposit(id, actor) {
    const b = await get(`bookings/${id}`);
    if (!b) return { ok: false, text: "Không tìm thấy đặt phòng." };
    const paid = b.paid ?? 0;
    if (!(b.deposit > 0) || paid >= b.deposit) return { ok: false, text: "Đặt phòng này đã nhận đủ cọc (hoặc không yêu cầu cọc)." };
    const amount = b.deposit - paid;
    const { Timestamp } = require("firebase-admin/firestore");
    await db.doc(`bookings/${id}`).update({ paid: paid + amount, payLog: [...(b.payLog ?? []), { amount, at: Timestamp.fromDate(now()), by: `telegram:${actor}`, note: "Đặt cọc" }] });
    return { ok: true, text: `💰 Đã ghi nhận cọc ${money(amount)} bởi ${esc(actor)}` };
  }

  /** Nút "Đã dọn xong": đưa phòng về sẵn sàng (chỉ khi đang bẩn/đang dọn). */
  async function markClean(roomId, actor, uid) {
    const rs = await get(`roomStatus/${roomId}`);
    if (!rs || !["dirty", "cleaning"].includes(rs.status)) return { ok: false, text: "Phòng này đã được đánh dấu sẵn sàng rồi." };
    await db.doc(`roomStatus/${roomId}`).set({ status: "ready", updatedAt: FieldValue.serverTimestamp(), updatedBy: uid, updatedByName: String(actor).slice(0, 100) });
    return { ok: true, text: `✅ ${esc(await roomName(roomId))} đã dọn xong (${esc(actor)})` };
  }

  // ===== Lệnh trong chat =====
  const STAFF_HELP = "Lệnh nhân viên:\n/homnay — khách nhận/trả phòng hôm nay và số yêu cầu chờ\n/cho — yêu cầu đang chờ xác nhận\n/doanhthu — doanh thu tuần hoặc tháng (<code>/doanhthu thang</code>; chủ, quản lý)\n/tra MÃ — tra đặt phòng theo mã\n/huylienket — ngừng nhận thông báo ở chat này\n\nLệnh chung: /trong, /gia, /phong, /tiennghi, /chinhsach, /diachi, /lienhe";
  const GUEST_HELP = "Tôi có thể giúp bạn:\n/trong — xem phòng còn trống (vd <code>/trong 25/12 27/12</code> hoặc <code>/trong 25/12</code> cho 1 đêm)\n/gia — báo giá nhanh (vd <code>/gia 2 4</code> = 2 đêm, 4 khách; thêm ngày nhận: <code>/gia 2 4 25/12</code>)\n/phong — các phòng và giá\n/tiennghi — tiện nghi\n/chinhsach — giờ nhận/trả phòng, đặt cọc, hủy phòng\n/diachi — địa chỉ và bản đồ\n/tra MÃ — tra trạng thái đặt phòng bằng mã\n/lienhe — thông tin liên hệ\n/dat — mở trang đặt phòng";
  const webBtn = (label, path = "") => ({ reply_markup: { inline_keyboard: [[{ text: label, url: `${site.url}${path}` }]] } });
  const bookPath = (inD, outD) => `/?checkIn=${inD}&checkOut=${outD}#booking`;

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
      `\n🏠 Đang ở: ${inn.length} đặt phòng`,
      `⏳ Yêu cầu chờ xác nhận: ${list.filter((b) => b.status === "pending").length}${list.some((b) => b.status === "pending") ? " (gõ /cho để xử lý)" : ""}`].join("\n");
  }

  async function pendingList(chatId) {
    const snap = await db.collection("bookings").where("status", "==", "pending").get();
    const items = snap.docs.map((x) => ({ id: x.id, ...x.data() })).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    if (!items.length) return tg.sendMessage(chatId, "Không có yêu cầu nào đang chờ xác nhận 👍");
    for (const b of items.slice(0, 10)) await tg.sendMessage(chatId, await bookingText(b, "⏳ <b>Chờ xác nhận</b>"), buttons(b.id, b));
    if (items.length > 10) await tg.sendMessage(chatId, `… và ${items.length - 10} yêu cầu nữa, xem trên trang quản trị.`);
  }

  /** Đọc tham số /trong: không có = đêm nay; một ngày = 1 đêm; hai ngày = nhận → trả. */
  function parseRange(arg) {
    const today = todayVN(now());
    const parts = String(arg ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length > 2) return { error: "Chỉ nhập tối đa 2 ngày: nhận phòng và trả phòng. Ví dụ: /trong 25/12 27/12" };
    // Không ghi năm: lấy lần tới của ngày đó (vd tháng 12 gõ 05/01 → 05/01 năm sau).
    const hasYear = (x) => /\d{4}/.test(x);
    const bump = (iso) => `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;
    let d1 = parts[0] ? parseDate(parts[0], today) : today;
    if (d1 && parts[0] && !hasYear(parts[0]) && d1 < today) d1 = bump(d1);
    let d2 = parts[1] ? parseDate(parts[1], today) : d1 && addDays(d1, 1);
    if (d1 && d2 && parts[1] && !hasYear(parts[1]) && d2 <= d1) d2 = bump(d2);
    if (!d1 || !d2) return { error: "Ngày không hợp lệ. Ví dụ: /trong 25/12 hoặc /trong 25/12 27/12 hoặc /trong 25/12/2026" };
    if (d1 < today) return { error: "Ngày nhận phòng đã qua. Hãy nhập ngày từ hôm nay trở đi." };
    if (d2 <= d1) return { error: "Ngày trả phòng phải sau ngày nhận phòng." };
    if (nights(d1, d2) > 30) return { error: "Tối đa 30 đêm mỗi lần tra." };
    return { d1, d2 };
  }

  async function availability(chatId, arg) {
    const r = parseRange(arg);
    if (r.error) return tg.sendMessage(chatId, r.error);
    const [rooms, busy] = await Promise.all([db.collection("rooms").get(), db.collection("busy").get()]);
    const held = busy.docs.map((x) => x.data()).filter((x) => HELD.includes(x.status) && overlaps(x.checkIn, x.checkOut, r.d1, r.d2));
    const all = rooms.docs.map((x) => ({ id: x.id, ...x.data() }));
    const free = all.filter((x) => x.status !== "maintenance" && !held.some((h) => h.roomId === x.id));
    const n = nights(r.d1, r.d2);
    const head = `🛏 <b>${fmtDate(r.d1)} → ${fmtDate(r.d2)}</b> (${n} đêm): còn ${free.length}/${all.length} phòng trống`;
    if (!free.length) return tg.sendMessage(chatId, `${head}\nRất tiếc, hết phòng trong thời gian này. Bạn thử ngày khác nhé.`);
    const lines = free.sort((a, b) => String(a.name).localeCompare(String(b.name), "vi", { numeric: true }))
      .map((x) => `• ${esc(x.name)} — ${money(x.price)}/đêm${n > 1 ? ` (≈ ${money(x.price * n)})` : ""}`);
    return tg.sendMessage(chatId, `${head}\n${lines.join("\n")}`, webBtn("🌐 Đặt phòng trên website", bookPath(r.d1, r.d2)));
  }

  async function roomList(chatId) {
    const rooms = (await db.collection("rooms").get()).docs.map((x) => ({ id: x.id, ...x.data() }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "vi", { numeric: true }));
    if (!rooms.length) return tg.sendMessage(chatId, "Danh sách phòng đang được cập nhật.", webBtn("🌐 Xem trên website"));
    const type = (x) => (x.type === "wood" ? "nhà gỗ, trên lầu" : "nhà xây dựng, riêng biệt");
    const lines = rooms.map((x) => `• <b>${esc(x.name)}</b> — ${type(x)}${x.capacity ? `, ${x.capacity} người` : ""} — ${money(x.price)}/đêm${x.status === "maintenance" ? " (tạm ngưng)" : ""}`);
    return tg.sendMessage(chatId, `🏡 <b>${esc(site.name)}</b>\n${lines.join("\n")}`, webBtn("🌐 Xem ảnh và đặt phòng", "/#rooms"));
  }

  const cfgs = async () => {
    const [p, b] = await Promise.all([get("settings/pricing"), get("settings/booking")]);
    return { pricing: pricing.parsePricing(p ?? undefined), cfg: pricing.parseBooking(b ?? undefined) };
  };

  /** /gia <số đêm> <số khách> [ngày nhận]: báo giá nhanh cho các phòng còn trống (chưa gồm mã giảm giá, dịch vụ, nhận sớm/trả muộn). */
  async function quickQuote(chatId, arg) {
    const usage = "Cú pháp: <code>/gia &lt;số đêm&gt; &lt;số khách&gt; [ngày nhận]</code>\nVí dụ: <code>/gia 2 4</code> (2 đêm, 4 khách, nhận hôm nay) hoặc <code>/gia 2 4 25/12</code>.";
    const parts = String(arg ?? "").trim().split(/\s+/).filter(Boolean);
    const today = todayVN(now());
    const dateTok = parts.find((x) => /[/.-]/.test(x));
    const nums = parts.filter((x) => /^\d{1,2}$/.test(x)).map(Number);
    if (nums.length < 2 || parts.length > 3 || parts.length - nums.length > (dateTok ? 1 : 0) || (!dateTok && parts.length !== nums.length)) return tg.sendMessage(chatId, usage);
    const [n, guests] = nums;
    if (n < 1 || n > 30 || guests < 1 || guests > 30) return tg.sendMessage(chatId, "Số đêm và số khách phải từ 1 đến 30.\n\n" + usage);
    let d1 = dateTok ? parseDate(dateTok, today) : today;
    if (d1 && dateTok && !/\d{4}/.test(dateTok) && d1 < today) d1 = `${Number(d1.slice(0, 4)) + 1}${d1.slice(4)}`;
    if (!d1 || d1 < today) return tg.sendMessage(chatId, "Ngày nhận phòng không hợp lệ hoặc đã qua.\n\n" + usage);
    const d2 = addDays(d1, n);
    const [{ pricing: pc, cfg }, rooms, busy] = await Promise.all([cfgs(), db.collection("rooms").get(), db.collection("busy").get()]);
    const held = busy.docs.map((x) => x.data()).filter((x) => HELD.includes(x.status) && overlaps(x.checkIn, x.checkOut, d1, d2));
    const all = rooms.docs.map((x) => ({ id: x.id, ...x.data() })).filter((x) => x.status !== "maintenance");
    const fits = all.filter((x) => !(Number.isFinite(x.capacity) && x.capacity > 0) || guests <= x.capacity);
    const free = fits.filter((x) => !held.some((h) => h.roomId === x.id)).sort((a, b) => String(a.name).localeCompare(String(b.name), "vi", { numeric: true }));
    const head = `💵 <b>Báo giá ${n} đêm, ${guests} khách</b>\n${fmtDate(d1)} → ${fmtDate(d2)}`;
    if (!fits.length) return tg.sendMessage(chatId, `${head}\nSố khách vượt sức chứa từng phòng. Bạn có thể đặt nhiều phòng hoặc liên hệ /lienhe để được tư vấn.`);
    if (!free.length) return tg.sendMessage(chatId, `${head}\nRất tiếc, các phòng phù hợp đã kín trong thời gian này. Bạn thử ngày khác nhé.`);
    const lines = free.map((x) => {
      const q = pricing.quote({ price: Number(x.price) || 0, capacity: x.capacity, baseGuests: x.baseGuests }, d1, n, guests, pc, cfg);
      return `• <b>${esc(x.name)}</b> — <b>${money(q.total)}</b>${n > 1 ? ` (≈ ${money(q.perNight)}/đêm)` : ""}${q.extra ? `, gồm phụ thu ${q.extra} khách thêm` : ""}${q.discount ? `, đã giảm ${money(q.discount)} ở dài ngày` : ""}${q.deposit ? `\n   Cọc ${cfg.depositPercent}%: ${money(q.deposit)}` : ""}`;
    });
    return tg.sendMessage(chatId, `${head}\n${lines.join("\n")}\n\n<i>Giá tham khảo, chưa gồm mã giảm giá và dịch vụ thêm; giá chính thức hiển thị khi đặt phòng.</i>`, webBtn("🌐 Đặt phòng trên website", bookPath(d1, d2)));
  }

  async function address(chatId) {
    const c = (await get("settings/contact")) ?? {};
    const addr = typeof c.address === "string" ? c.address.trim() : "";
    const map = typeof c.mapUrl === "string" && /^https?:\/\/\S+$/i.test(c.mapUrl.trim()) ? c.mapUrl.trim() : addr ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}` : "";
    if (!addr && !map) return tg.sendMessage(chatId, "Homestay chưa cập nhật địa chỉ. Bạn nhắn /lienhe để xem cách liên hệ nhé.");
    return tg.sendMessage(chatId, `📍 <b>${esc(site.name)}</b>${addr ? `\n${esc(addr)}` : ""}`, { reply_markup: { inline_keyboard: [...(map ? [[{ text: "🗺 Mở bản đồ", url: map }]] : []), [{ text: "🌐 Website", url: site.url }]] } });
  }

  const amenities = (chatId) => tg.sendMessage(chatId, `🌲 <b>Tiện nghi tại ${esc(site.name)}</b>\n${site.amenities.map(esc).join("\n")}`, webBtn("🌐 Xem ảnh và chi tiết", "/#features"));

  async function policy(chatId) {
    const { cfg } = await cfgs();
    const rows = [
      `🕑 Nhận phòng từ <b>${esc(cfg.checkInTime)}</b>, trả phòng trước <b>${esc(cfg.checkOutTime)}</b>.`,
      cfg.earlyCheckInFee || cfg.lateCheckOutFee ? `⏱ Phụ thu: ${[cfg.earlyCheckInFee && `nhận sớm ${money(cfg.earlyCheckInFee)}`, cfg.lateCheckOutFee && `trả muộn ${money(cfg.lateCheckOutFee)}`].filter(Boolean).join(", ")}.` : "",
      cfg.extraGuestFee ? `👥 Phụ thu thêm khách: ${money(cfg.extraGuestFee)}/người/đêm (vượt số khách tiêu chuẩn của phòng).` : "",
      cfg.depositPercent ? `🏦 Đặt cọc ${cfg.depositPercent}% tổng tiền để giữ phòng.` : "🏦 Hiện không yêu cầu đặt cọc.",
      "❌ <b>Hủy phòng</b> (hoàn cọc theo số ngày còn lại trước ngày nhận phòng):",
      ...cfg.cancelTiers.map((t) => `   • Từ ${t.daysBefore} ngày trở lên: hoàn ${t.refundPercent}%`),
      cfg.cancelNote ? `📝 ${esc(cfg.cancelNote)}` : "",
    ].filter(Boolean);
    return tg.sendMessage(chatId, `📜 <b>Chính sách của ${esc(site.name)}</b>\n${rows.join("\n")}`, webBtn("🌐 Đặt phòng", "/#booking"));
  }

  /** /tra MÃ: trạng thái đặt phòng theo mã; không hiển thị họ tên, điện thoại, email hay ghi chú. */
  async function lookup(chatId, arg) {
    const tok = String(arg ?? "").trim().split(/\s+/).filter(Boolean).pop() ?? "";
    const code = tok.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{4,12}$/.test(code)) return tg.sendMessage(chatId, "Cú pháp: <code>/tra MÃ</code>, ví dụ <code>/tra AB12CD34</code>. Mã đặt phòng nằm trong email/trang Tài khoản và là nội dung chuyển khoản (sau chữ NHAGO).");
    let hit = (await db.collection("bookings").where("code", "==", code).limit(1).get()).docs[0];
    if (!hit) hit = (await db.collection("bookings").get()).docs.find((d) => !d.data().code && String(d.id).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() === code); // đặt phòng cũ chưa có trường mã
    if (!hit) return tg.sendMessage(chatId, "Không tìm thấy đặt phòng với mã này. Bạn kiểm tra lại mã hoặc nhắn /lienhe để được hỗ trợ.");
    const b = hit.data();
    const n = nights(b.checkIn, b.checkOut);
    const dep = !(b.deposit > 0) ? "không yêu cầu cọc" : (b.paid ?? 0) >= b.deposit ? "đã nhận đủ cọc ✅" : `chưa nhận đủ cọc (cần ${money(b.deposit)}) ⚠️`;
    return tg.sendMessage(chatId, [`🔎 <b>Đặt phòng ${esc(code)}</b>`, `Trạng thái: ${STATUS_VI[b.status] ?? esc(b.status)}`, `🛏 ${esc(await roomName(b.roomId))} · ${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)} (${n} đêm)`, `👥 ${b.guests} khách`, `🏦 Cọc: ${dep}`].join("\n"));
  }

  /** /doanhthu [tuan|thang]: tổng hợp doanh thu theo ngày trả phòng, giống trang Báo cáo doanh thu (chỉ chủ/quản lý). */
  async function revenue(chatId, arg) {
    const monthly = /^th[aáàảãạ]ng$|^month$|^m$/i.test(String(arg ?? "").trim());
    const d = todayVN(now());
    let from, label;
    if (monthly) { from = `${d.slice(0, 7)}-01`; label = `Tháng ${d.slice(5, 7)}/${d.slice(0, 4)}`; }
    else { const dow = new Date(`${d}T00:00:00Z`).getUTCDay(); from = addDays(d, -((dow + 6) % 7)); label = `Tuần ${fmtDate(from)} → ${fmtDate(d)}`; }
    const to = addDays(d, 1); // [from, to) gồm cả hôm nay
    const [bk, ex, rooms] = await Promise.all([db.collection("bookings").get(), db.collection("expenses").get(), db.collection("rooms").get()]);
    const list = bk.docs.map((x) => x.data());
    const done = list.filter((b) => b.status === "checked_out" && b.checkOut >= from && b.checkOut < to);
    const rev = done.reduce((s, b) => s + (b.total || 0), 0);
    const sold = done.reduce((s, b) => s + Math.max(0, nights(b.checkIn, b.checkOut)), 0);
    const expected = list.filter((b) => ["confirmed", "checked_in"].includes(b.status) && b.checkOut >= from && b.checkOut < to).reduce((s, b) => s + (b.total || 0), 0);
    const exp = ex.docs.map((x) => x.data()).filter((e) => e.date >= from && e.date < to).reduce((s, e) => s + (e.amount || 0), 0);
    const days = nights(from, to);
    const active = rooms.docs.filter((r) => r.data().status !== "maintenance").length;
    const occ = list.filter((b) => ["checked_in", "checked_out"].includes(b.status)).reduce((s, b) => s + Math.max(0, nights(b.checkIn > from ? b.checkIn : from, b.checkOut < to ? b.checkOut : to)), 0);
    const cancelled = list.filter((b) => b.status === "cancelled" && b.checkIn >= from && b.checkIn < to).length;
    return tg.sendMessage(chatId, [`📊 <b>Doanh thu — ${label}</b>`, `💰 Doanh thu (đã trả phòng): <b>${money(rev)}</b> · ${done.length} lượt · ${sold} đêm`,
      `📈 Dự kiến thêm (đang ở/đã xác nhận): ${money(expected)}`, `🧾 Chi phí: ${money(exp)}`, `✅ Lợi nhuận tạm tính: <b>${money(rev - exp)}</b>`,
      `🛏 Công suất: ${active && days ? Math.round((occ / (active * days)) * 100) : 0}% · 🚫 Hủy: ${cancelled}`, "", `<i>Chi tiết ở trang quản trị → Tài chính → Báo cáo doanh thu.</i>`].join("\n"));
  }

  /** Thông tin liên hệ do chủ/quản lý nhập ở Cài đặt (settings/contact), cùng nguồn với chân trang website. */
  async function contact(chatId) {
    const c = (await get("settings/contact")) ?? {};
    const str = (k) => (typeof c[k] === "string" ? c[k].trim() : "");
    const http = (k) => (/^https?:\/\/\S+$/i.test(str(k)) ? str(k) : "");
    const rows = [
      str("phone") && `📞 ${esc(str("phone"))}`, str("zalo") && `💬 Zalo: ${esc(str("zalo"))}`, str("email") && `✉️ ${esc(str("email"))}`,
      str("address") && `📍 ${esc(str("address"))}`, http("facebook") && `👍 ${esc(http("facebook"))}`, http("mapUrl") && `🗺 ${esc(http("mapUrl"))}`,
    ].filter(Boolean);
    const body = rows.length ? rows.join("\n") : "Homestay chưa cập nhật thông tin liên hệ. Bạn gửi yêu cầu đặt phòng trên website, chúng tôi sẽ phản hồi sớm.";
    return tg.sendMessage(chatId, `📇 <b>${esc(site.name)}</b>\n${body}`, webBtn("🌐 Mở website", "/#contact"));
  }

  /** Giới hạn theo ngày/phút lưu ở Firestore (chỉ cho chat chưa liên kết). Trả {ok, first} — first: lần đầu bị chặn trong phút này (để báo một lần). */
  async function rateCheck(chatId) {
    const ref = db.doc(`tgRate/${chatId}`);
    const t = now().getTime();
    const minKey = Math.floor(t / 60000), dayKey = todayVN(now());
    return db.runTransaction(async (tx) => {
      const d = (await tx.get(ref)).data() ?? {};
      const m = d.minKey === minKey ? d.minN + 1 : 1;
      const dn = d.dayKey === dayKey ? d.dayN + 1 : 1;
      const blocked = m > LIMITS.perMin || dn > LIMITS.perDay;
      const warned = blocked && d.warnedKey === `${minKey}:${dayKey}`;
      tx.set(ref, { minKey, minN: m, dayKey, dayN: dn, warnedKey: blocked ? `${minKey}:${dayKey}` : d.warnedKey ?? "", expireAt: new Date(t + 2 * 86400000) });
      return { ok: !blocked, first: blocked && !warned, daily: dn > LIMITS.perDay };
    });
  }

  async function handleMessage(msg) {
    const chatId = String(msg.chat.id);
    const text = String(msg.text ?? "").trim();
    if (!text.startsWith("/")) return;
    const [cmdRaw, ...rest] = text.split(/\s+/);
    const cmd = cmdRaw.split("@")[0].toLowerCase();
    if (!memAllow(mem, chatId, now().getTime())) return; // lũ tin nhắn: bỏ qua im lặng
    const linked = await get(`tgChats/${chatId}`);

    // Khách (chat chưa liên kết) bị giới hạn tần suất; nhân viên đã liên kết thì không.
    if (!linked) {
      const rl = await rateCheck(chatId);
      if (!rl.ok) return rl.first ? tg.sendMessage(chatId, rl.daily ? "⏳ Bạn đã nhắn quá nhiều hôm nay. Vui lòng quay lại vào ngày mai hoặc đặt phòng trực tiếp trên website." : "⏳ Bạn nhắn quá nhanh, vui lòng thử lại sau 1 phút.") : undefined;
    }

    if (cmd === "/start") {
      const code = (rest[0] ?? "").toUpperCase();
      if (!/^[A-Z0-9]{8}$/.test(code)) {
        const hello = `Xin chào! Đây là bot của <b>${esc(site.name)}</b> 🌲\n\n${GUEST_HELP}`;
        return tg.sendMessage(chatId, linked ? `Chat này đã liên kết nhân viên.\n\n${STAFF_HELP}` : hello, webBtn("🌐 Đặt phòng trên website", "/#booking"));
      }
      const link = await get(`tgLinks/${code}`);
      if (!link || link.exp < now().getTime()) return tg.sendMessage(chatId, "Mã liên kết không đúng hoặc đã hết hạn (30 phút). Nhân viên hãy tạo mã mới ở trang quản trị.");
      const u = await get(`users/${link.uid}`);
      if (!u || !FRONT.includes(u.role)) return tg.sendMessage(chatId, "Tài khoản này không còn quyền nhân viên.");
      await db.doc(`tgChats/${chatId}`).set({ uid: link.uid, role: u.role, email: u.email ?? "", name: msg.chat.title ?? msg.from?.first_name ?? "", type: msg.chat.type, linkedAt: FieldValue.serverTimestamp() });
      await db.doc(`tgLinks/${code}`).delete();
      await tg.setMyCommands?.(STAFF_COMMANDS, { type: "chat", chat_id: Number(chatId) }).catch(() => {});
      return tg.sendMessage(chatId, `✅ Đã liên kết với ${esc(u.email ?? "tài khoản của bạn")}. Từ giờ chat này nhận thông báo đặt phòng.\n\n${STAFF_HELP}`);
    }

    // Lệnh dành cho mọi người (dữ liệu công khai, giống trang web).
    if (cmd === "/trong") return availability(chatId, rest.join(" "));
    if (cmd === "/phong") return roomList(chatId);
    if (cmd === "/lienhe") return contact(chatId);
    if (cmd === "/gia") return quickQuote(chatId, rest.join(" "));
    if (cmd === "/diachi") return address(chatId);
    if (cmd === "/tiennghi") return amenities(chatId);
    if (cmd === "/chinhsach") return policy(chatId);
    if (cmd === "/tra") return lookup(chatId, rest.join(" "));
    if (cmd === "/dat") { const r = parseRange(rest.join(" ")); return tg.sendMessage(chatId, "Bấm nút bên dưới để chọn phòng và gửi yêu cầu đặt phòng (cần đăng nhập Google hoặc email).", webBtn("🌐 Đặt phòng trên website", r.error ? "/#booking" : bookPath(r.d1, r.d2))); }

    // Lệnh nhân viên: chỉ chat đã liên kết.
    if (["/homnay", "/cho", "/doanhthu", "/huylienket"].includes(cmd)) {
      if (!linked) return tg.sendMessage(chatId, "Lệnh này dành cho nhân viên homestay.");
      // Kiểm tra lại vai trò hiện tại của người đã liên kết (bị hạ quyền thì mất quyền dùng bot).
      const u = await get(`users/${linked.uid}`);
      if (!u || !FRONT.includes(u.role)) { await db.doc(`tgChats/${chatId}`).delete(); return tg.sendMessage(chatId, "Tài khoản liên kết không còn quyền nhân viên; đã ngắt liên kết."); }
      if (cmd === "/homnay") return tg.sendMessage(chatId, await today());
      if (cmd === "/cho") return pendingList(chatId);
      if (cmd === "/doanhthu") return MANAGER.includes(u.role) ? revenue(chatId, rest.join(" ")) : tg.sendMessage(chatId, "Lệnh /doanhthu chỉ dành cho chủ và quản lý.");
      await db.doc(`tgChats/${chatId}`).delete();
      return tg.sendMessage(chatId, "Đã ngừng nhận thông báo ở chat này.");
    }
    return tg.sendMessage(chatId, linked ? STAFF_HELP : GUEST_HELP);
  }

  async function handleCallback(cb) {
    const chatId = String(cb.message?.chat?.id ?? "");
    if (!memAllow(mem, chatId, now().getTime())) return;
    const [action, id] = String(cb.data ?? "").split(":");
    if (!["cf", "rj", "pd", "rd"].includes(action) || !id) return tg.answerCallbackQuery(cb.id, "Thao tác không hợp lệ");
    const linked = await get(`tgChats/${chatId}`);
    const u = linked && (await get(`users/${linked.uid}`));
    if (!u || !FRONT.includes(u.role)) return tg.answerCallbackQuery(cb.id, "Chat chưa liên kết hoặc không đủ quyền");
    const actor = cb.from?.first_name || u.email || "nhân viên";
    const r = action === "pd" ? await markDeposit(id, actor) : action === "rd" ? await markClean(id, actor, linked.uid) : await decide(action, id, actor);
    await tg.answerCallbackQuery(cb.id, r.ok ? "Đã xong" : r.text.replace(/<[^>]+>/g, "").slice(0, 150));
    if (cb.message) {
      const base = cb.message.text ?? "";
      // Giữ nguyên nội dung cũ, thay hàng nút bằng kết quả.
      // Nút "Đã nhận cọc": giữ lại Xác nhận/Từ chối; Xác nhận/Từ chối: bỏ hết nút.
      const kb = action === "pd" && r.ok ? (cb.message.reply_markup?.inline_keyboard ?? []).map((row) => row.filter((x) => x.callback_data !== cb.data)).filter((row) => row.length) : [];
      await tg.editMessageText(chatId, cb.message.message_id, `${esc(base)}\n\n${r.text}`, { reply_markup: { inline_keyboard: kb } }).catch(() => {});
    }
  }

  async function handleUpdate(update) {
    if (update.message) return handleMessage(update.message);
    if (update.callback_query) return handleCallback(update.callback_query);
  }

  // ===== Cảnh báo/nhắc tự động cho quản lý (do lịch chạy gọi; mỗi việc chỉ báo một lần nhờ tgSent) =====
  const sendManagers = async (text, extra) => {
    const chats = (await staffChats()).filter((c) => MANAGER.includes(c.role));
    return (await Promise.allSettled(chats.map((c) => tg.sendMessage(c.id, text, extra)))).filter((r) => r.status === "fulfilled").length;
  };
  const vnMs = (date, hhmm) => Date.parse(`${date}T${hhmm}:00+07:00`);
  const shiftSpan = (date, sh) => { const st = vnMs(date, sh.start); let en = vnMs(date, sh.end); if (en <= st) en += 86400000; return [st, en]; };

  /** Nhân viên được xếp ca mà quá giờ vẫn chưa vào ca, hoặc đã hết ca mà chưa ra ca. */
  async function staffAlerts() {
    const t = now().getTime(), d = todayVN(now());
    const [sched, shifts, att] = await Promise.all([
      db.collection("schedule").where("date", ">=", addDays(d, -2)).get(),
      db.collection("shifts").get(),
      db.collection("attendance").where("date", ">=", addDays(d, -2)).get(),
    ]);
    const shiftOf = new Map(shifts.docs.map((x) => [x.id, x.data()]));
    const entries = sched.docs.map((x) => x.data());
    const records = att.docs.map((x) => ({ id: x.id, ...x.data() }));
    const lines = [];
    for (const e of entries.filter((x) => x.date === d)) {
      const sh = shiftOf.get(e.shiftId);
      if (!sh) continue;
      const [st, en] = shiftSpan(d, sh);
      if (t < st + LATE_MIN * 60000 || t >= en) continue;
      if (records.some((r) => r.uid === e.uid && r.date === d)) continue;
      if (await once(`late_${d}_${e.uid}`)) lines.push(`⏰ <b>${esc(e.name)}</b> chưa vào ca <b>${esc(sh.name)}</b> (bắt đầu ${esc(sh.start)}, đã trễ ${Math.floor((t - st) / 60000)} phút).`);
    }
    for (const r of records.filter((x) => !x.out && x.in)) {
      const inMs = typeof r.in.toMillis === "function" ? r.in.toMillis() : 0;
      const sh = shiftOf.get(entries.find((e) => e.date === r.date && e.uid === r.uid)?.shiftId);
      const limit = sh ? shiftSpan(r.date, sh)[1] + FORGOT_MIN * 60000 : inMs + NO_SHIFT_FORGOT_H * 3600000;
      if (t < limit) continue;
      if (await once(`forgot_${r.id}`)) lines.push(`🚪 <b>${esc(r.name)}</b> chưa ra ca (vào ca lúc ${new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }).format(new Date(inMs))}). Nhắc nhân viên hoặc sửa giờ ở Nhân sự → Chấm công.`);
    }
    if (!lines.length) return { sent: 0, alerts: 0 };
    return { sent: await sendManagers(`⚠️ <b>Chấm công</b>\n${lines.join("\n")}`), alerts: lines.length };
  }

  /** Nhắc quản lý: khách sắp nhận phòng mà chưa đủ cọc; khách vừa trả phòng mà chưa có hồ sơ lưu trú. */
  async function dailyReminders() {
    const d = todayVN(now()), soon = addDays(d, 2);
    const [bk, gs] = await Promise.all([db.collection("bookings").get(), db.collection("guests").get()]);
    const list = bk.docs.map((x) => ({ id: x.id, ...x.data() }));
    const profiled = new Set(gs.docs.map((x) => x.data().bookingId));
    let sent = 0;
    const dueDep = list.filter((b) => b.status === "confirmed" && b.deposit > 0 && (b.paid ?? 0) < b.deposit && b.checkIn >= d && b.checkIn <= soon).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
    const dep = [];
    for (const b of dueDep) if (await once(`dep_${b.id}_${d}`)) dep.push(b);
    if (dep.length) {
      const rows = [];
      for (const b of dep) rows.push(`• <b>${esc(b.guestName)}</b> · ${esc(b.phone)} — ${esc(await roomName(b.roomId))}, nhận ${fmtDate(b.checkIn)}${b.checkIn === d ? " (hôm nay)" : ""} — cần cọc ${money(b.deposit - (b.paid ?? 0))}`);
      sent += await sendManagers(`💸 <b>Sắp nhận phòng nhưng chưa đủ cọc</b>\n${rows.join("\n")}\n\nBấm nút nếu đã nhận cọc, hoặc liên hệ khách.`, { reply_markup: { inline_keyboard: dep.slice(0, 8).map((b) => [{ text: `💰 Đã nhận cọc — ${String(b.guestName).slice(0, 24)}`, callback_data: `pd:${b.id}` }]) } });
    }
    const noProfile = [];
    for (const b of list.filter((x) => x.status === "checked_out" && x.checkOut >= addDays(d, -1) && x.checkOut <= d && !profiled.has(x.id))) if (await once(`np_${b.id}`)) noProfile.push(b);
    if (noProfile.length) {
      const rows = [];
      for (const b of noProfile) rows.push(`• <b>${esc(b.guestName)}</b> · ${esc(b.phone)} — ${esc(await roomName(b.roomId))}, trả ${fmtDate(b.checkOut)}`);
      sent += await sendManagers(`📋 <b>Khách đã trả phòng nhưng chưa có hồ sơ lưu trú</b>\n${rows.join("\n")}\n\nBổ sung ở trang quản trị → Khách lưu trú.`);
    }
    return { sent, deposit: dep.length, noProfile: noProfile.length };
  }

  return { notify, linkCode, handleUpdate, decide, staffAlerts, dailyReminders };
}

module.exports = { createBot, webhookSecret, safeEq, parseDate, todayVN, FRONT, LIMITS, STAFF_COMMANDS, GUEST_COMMANDS };
