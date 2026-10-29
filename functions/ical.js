"use strict";
const crypto = require("crypto");

const addDays = (s, n) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const todayVN = (now) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
const safeEq = (a, b) => { const x = Buffer.from(String(a ?? "")), y = Buffer.from(String(b ?? "")); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const sha = (s) => crypto.createHash("sha1").update(String(s)).digest("hex");
const overlaps = (aIn, aOut, bIn, bOut) => aIn < bOut && bIn < aOut;
/** Hậu tố UID của các sự kiện do chính hệ thống xuất ra: bỏ qua khi nhập lại để không tạo vòng lặp với các kênh bán phòng. */
const UID_SUFFIX = "@nhago.web.app";

/** "20261225" → "2026-12-25"; "20261225T140000Z" đổi sang ngày giờ Việt Nam. Không đọc được thì null. */
function icsDate(value) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const day = `${m[1]}-${m[2]}-${m[3]}`;
  if (m[7]) return new Date(Date.parse(`${day}T${m[4]}:${m[5]}:${m[6]}Z`) + 7 * 3600000).toISOString().slice(0, 10);
  return day;
}

/** Đọc nội dung .ics → [{ uid, from, to, summary }] (to là ngày kết thúc, không tính). Bỏ qua sự kiện đã hủy hoặc không đọc được ngày. */
function parseIcs(text) {
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const out = [];
  let cur = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT") {
      if (cur && cur.from && cur.status !== "CANCELLED") {
        let to = cur.to ?? addDays(cur.from, 1);
        if (to <= cur.from) to = addDays(cur.from, 1);
        out.push({ uid: cur.uid ?? `${cur.from}_${to}`, from: cur.from, to, summary: (cur.summary ?? "").slice(0, 100) });
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const i = line.indexOf(":");
    if (i < 0) continue;
    const name = line.slice(0, i).split(";")[0].toUpperCase(), value = line.slice(i + 1);
    if (name === "UID") cur.uid = value.trim().slice(0, 200);
    else if (name === "DTSTART") cur.from = icsDate(value) ?? undefined;
    else if (name === "DTEND") cur.to = icsDate(value) ?? undefined;
    else if (name === "SUMMARY") cur.summary = value.replace(/\\,/g, ",").replace(/\\n/gi, " ").trim();
    else if (name === "STATUS") cur.status = value.trim().toUpperCase();
  }
  return out;
}

const esc = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const compact = (d) => d.replace(/-/g, "");
const stampOf = (t) => new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

/** Dựng nội dung .ics cho một phòng. events: [{ uid, from, to, summary }]. Không chứa tên hay liên lạc của khách. */
function buildIcs(roomName, events, nowMs) {
  const stamp = stampOf(nowMs);
  const body = events.map((e) => ["BEGIN:VEVENT", `UID:${e.uid}${UID_SUFFIX}`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${compact(e.from)}`, `DTEND;VALUE=DATE:${compact(e.to)}`, `SUMMARY:${esc(e.summary)}`, "TRANSP:OPAQUE", "END:VEVENT"].join("\r\n"));
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nha Go Homestay//Lich phong//VI", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(roomName)}`, ...body, "END:VCALENDAR", ""].join("\r\n");
}

/** Địa chỉ nguồn nhập chỉ nhận https và không trỏ vào máy nội bộ (chống SSRF). */
function okFeedUrl(u) {
  try {
    const x = new URL(u);
    if (x.protocol !== "https:" || x.username || x.password) return false;
    const h = x.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(":")) return false; // địa chỉ IP
    return true;
  } catch { return false; }
}

function createIcal({ db, fetchImpl = fetch, now = () => new Date(), notify } = {}) {
  const get = async (path) => { const s = await db.doc(path).get(); return s.exists ? { id: s.id, ...s.data() } : null; };
  const FieldValue = require("firebase-admin/firestore").FieldValue;

  /** Nội dung .ics của một phòng, hoặc mã lỗi HTTP khi sai mã bí mật / không có phòng. */
  async function exportFor(roomId, token) {
    const cfg = await get("settings/ical");
    if (!cfg?.token || !safeEq(token, cfg.token)) return { status: 403, body: "forbidden" };
    const room = await get(`rooms/${roomId}`);
    if (!room) return { status: 404, body: "not found" };
    const today = todayVN(now());
    const [bk, bl] = await Promise.all([db.collection("bookings").where("roomId", "==", roomId).get(), db.collection("roomBlocks").where("roomId", "==", roomId).get()]);
    const events = [];
    for (const d of bk.docs) {
      const b = d.data();
      if (!["pending", "confirmed", "checked_in"].includes(b.status) || b.checkOut <= addDays(today, -1)) continue;
      events.push({ uid: `bk-${d.id}`, from: b.checkIn, to: b.checkOut, summary: "Reserved" });
    }
    for (const d of bl.docs) {
      const k = d.data();
      if (k.source === "ical" || k.to <= today) continue; // không xuất lại lịch nhập từ kênh khác
      events.push({ uid: `blk-${d.id}`, from: k.from, to: k.to, summary: "Blocked" });
    }
    return { status: 200, body: buildIcs(room.name ?? roomId, events.sort((a, b) => a.from.localeCompare(b.from)), now().getTime()) };
  }

  /** Nhập lịch từ các nguồn iCal đã cấu hình: tạo / cập nhật / gỡ khóa phòng `source: "ical"` và báo nếu trùng đặt phòng của mình. */
  async function syncAll() {
    const cfg = await get("settings/ical");
    const feeds = (Array.isArray(cfg?.feeds) ? cfg.feeds : []).filter((f) => f && typeof f.id === "string" && typeof f.roomId === "string" && okFeedUrl(f.url));
    const today = todayVN(now());
    const horizon = addDays(today, 540);
    const state = {};
    let added = 0, removed = 0, conflicts = 0;
    for (const f of feeds) {
      try {
        const room = await get(`rooms/${f.roomId}`);
        if (!room) throw new Error("Phòng không tồn tại");
        const res = await fetchImpl(f.url, { headers: { accept: "text/calendar, text/plain, */*", "user-agent": "NhaGo-iCal/1.0" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        if (text.length > 2_000_000) throw new Error("Tệp quá lớn");
        if (!/BEGIN:VCALENDAR/.test(text)) throw new Error("Không phải tệp lịch iCal");
        const events = parseIcs(text).filter((e) => e.to > today && e.from < horizon && !e.uid.endsWith(UID_SUFFIX));
        const want = new Map();
        for (const e of events) want.set(`ical_${f.id}_${sha(`${e.uid}|${e.from}|${e.to}`).slice(0, 12)}`, e);
        const existing = (await db.collection("roomBlocks").where("feedId", "==", f.id).get()).docs;
        const have = new Set(existing.map((d) => d.id));
        for (const d of existing) if (!want.has(d.id)) { await db.doc(`busy/blk_${d.id}`).delete(); await d.ref.delete(); removed++; }
        const bookings = (await db.collection("bookings").where("roomId", "==", f.roomId).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
        for (const [id, e] of want) {
          if (!have.has(id)) {
            await db.doc(`roomBlocks/${id}`).set({ roomId: f.roomId, from: e.from, to: e.to, reason: `${f.name || "iCal"}${e.summary ? `: ${e.summary}` : ""}`.slice(0, 200), source: "ical", feedId: f.id, sourceName: String(f.name ?? "").slice(0, 60), createdBy: "ical", createdByName: "Đồng bộ iCal", createdAt: FieldValue.serverTimestamp() });
            await db.doc(`busy/blk_${id}`).set({ roomId: f.roomId, checkIn: e.from, checkOut: e.to, status: "confirmed" });
            added++;
          }
          const clash = bookings.filter((b) => ["pending", "confirmed", "checked_in"].includes(b.status) && overlaps(b.checkIn, b.checkOut, e.from, e.to));
          if (clash.length && notify && (await db.doc(`tgSent/ic_${id}`).create({ at: FieldValue.serverTimestamp() }).then(() => true, () => false))) {
            conflicts++;
            await notify(`⚠️ <b>Trùng lịch với kênh ${String(f.name || "iCal").replace(/</g, "&lt;")}</b>\n${room.name}: kênh đã nhận ${e.from} → ${e.to}, nhưng đang có đặt phòng ${clash.map((b) => `${b.guestName} (${b.checkIn} → ${b.checkOut})`).join("; ")}.\nHãy kiểm tra và hủy một bên ngay.`);
          }
        }
        state[f.id] = { at: FieldValue.serverTimestamp(), ok: true, count: want.size };
      } catch (e) {
        console.error("ical sync", f.id, e.message);
        state[f.id] = { at: FieldValue.serverTimestamp(), ok: false, error: String(e.message).slice(0, 200) };
      }
    }
    await db.doc("settings/icalState").set({ feeds: state, at: FieldValue.serverTimestamp() });
    return { feeds: feeds.length, added, removed, conflicts };
  }

  return { exportFor, syncAll };
}

module.exports = { createIcal, parseIcs, buildIcs, icsDate, okFeedUrl, UID_SUFFIX };
