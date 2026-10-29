import { useMemo, useState, type FormEvent } from "react";
import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { addDays, fmtDate, nightsBetween, overlaps, todayStr } from "../lib/format";
import { blockBusyId, type RoomBlock } from "../lib/blocks";
import { useAudit } from "../lib/audit";
import DateInput from "../components/DateInput";
import type { Booking, Room } from "../lib/types";

/** Đặt phòng → Khóa phòng theo ngày: chặn nhận đặt một phòng trong khoảng ngày (bảo trì, giữ chỗ cho gia đình…) mà không cần tạo đặt phòng giả. */
export default function RoomBlocksPage() {
  const { lang } = useI18n();
  const T = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const { user, profile } = useAuth();
  const audit = useAudit();
  const { data: rooms } = useCollection<Room>("rooms");
  const { data: blocks } = useCollection<RoomBlock>("roomBlocks");
  const { data: bookings } = useCollection<Booking>("bookings");
  const today = todayStr();
  const [roomId, setRoomId] = useState("");
  const [from, setFrom] = useState(today);
  const [last, setLast] = useState(today); // ngày cuối cùng còn khóa (tính cả ngày này)
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const sortedRooms = useMemo(() => [...rooms].sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true })), [rooms]);
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? "?";
  const upcoming = useMemo(() => blocks.filter((b) => b.to > today).sort((a, b) => a.from.localeCompare(b.from)), [blocks, today]);
  const to = addDays(last, 1); // ngày kết thúc (không tính) lưu trong dữ liệu
  const rid = roomId || sortedRooms[0]?.id || "";
  const clashes = bookings.filter((b) => b.roomId === rid && ["pending", "confirmed", "checked_in"].includes(b.status) && overlaps(b.checkIn, b.checkOut, from, to));
  const invalid = !rid || !from || !last || last < from || from < today;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(""); setMsg("");
    if (invalid) return setErr(T("Chọn phòng và khoảng ngày hợp lệ (từ hôm nay trở đi).", "Pick a room and a valid date range (today or later)."));
    if (clashes.length) return setErr(T(`Phòng đã có ${clashes.length} đặt phòng trong khoảng này (${clashes.map((b) => `${b.guestName} ${fmtDate(b.checkIn)}→${fmtDate(b.checkOut)}`).join("; ")}). Hãy xử lý các đặt phòng đó trước.`, `The room has ${clashes.length} booking(s) in this range. Resolve them first.`));
    setBusy(true);
    try {
      const ref = doc(collection(db, "roomBlocks"));
      const w = writeBatch(db);
      w.set(ref, { roomId: rid, from, to, reason: reason.trim(), createdBy: user?.uid ?? "", createdByName: profile?.name || user?.displayName || user?.email || "", createdAt: serverTimestamp() });
      w.set(doc(db, "busy", blockBusyId(ref.id)), { roomId: rid, checkIn: from, checkOut: to, status: "confirmed" });
      await w.commit();
      audit("block.create", `${roomName(rid)}: ${fmtDate(from)} → ${fmtDate(last)}${reason.trim() ? ` (${reason.trim()})` : ""}`, { type: "room", id: rid });
      setReason(""); setMsg(T("Đã khóa phòng.", "Room blocked."));
    } catch (ex) { console.error("block", ex); setErr(T("Không lưu được. Vui lòng thử lại.", "Could not save.")); } finally { setBusy(false); }
  };

  const remove = async (b: RoomBlock) => {
    if (!confirm(T(`Mở khóa ${roomName(b.roomId)} từ ${fmtDate(b.from)} đến hết ${fmtDate(addDays(b.to, -1))}?`, "Unblock this room?"))) return;
    const w = writeBatch(db);
    w.delete(doc(db, "roomBlocks", b.id));
    w.delete(doc(db, "busy", blockBusyId(b.id)));
    await w.commit();
    audit("block.delete", `${roomName(b.roomId)}: ${fmtDate(b.from)} → ${fmtDate(addDays(b.to, -1))}`, { type: "room", id: b.roomId });
  };

  return (
    <section id="room-blocks">
      <h2>{T("Khóa phòng theo ngày", "Block rooms by date")}</h2>
      <p><small>{T("Phòng bị khóa không nhận đặt trên website, bot Telegram và khi xác nhận đặt phòng; hiện màu xám trên Lịch phòng. Dùng cho sửa chữa, vệ sinh lớn hoặc để dành cho gia đình.", "A blocked room takes no bookings on the website, Telegram bot or when confirming; it shows grey on the room calendar. Use it for repairs, deep cleaning or family stays.")}</small></p>
      <form className="card" onSubmit={submit}>
        <label>{T("Phòng", "Room")}
          <select value={rid} onChange={(e) => setRoomId(e.target.value)}>{sortedRooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </label>
        <div className="row">
          <label>{T("Từ ngày", "From")}<DateInput required min={today} value={from} onChange={(v) => { setFrom(v); if (last < v) setLast(v); }} /></label>
          <label>{T("Đến hết ngày", "Until (inclusive)")}<DateInput required min={from} value={last} onChange={setLast} /></label>
        </div>
        <label>{T("Lý do (không bắt buộc)", "Reason (optional)")}<input maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={T("Sửa mái, sơn lại, gia đình ở…", "Roof repair, repainting, family stay…")} /></label>
        {!invalid && <small>{T(`Khóa ${nightsBetween(from, to)} đêm: từ ${fmtDate(from)} đến hết ${fmtDate(last)} (khách khác nhận phòng được từ ${fmtDate(to)}).`, `Blocks ${nightsBetween(from, to)} night(s) until ${fmtDate(last)} inclusive.`)}</small>}
        {clashes.length > 0 && <p className="error">{T(`Đang có ${clashes.length} đặt phòng trùng khoảng này: ${clashes.map((b) => `${b.guestName} (${fmtDate(b.checkIn)}→${fmtDate(b.checkOut)})`).join("; ")}.`, `${clashes.length} booking(s) overlap this range.`)}</p>}
        {err && <p className="error">{err}</p>}
        {msg && <p className="ok-msg" role="status">{msg}</p>}
        <div className="rolebar"><button type="submit" disabled={busy || invalid || clashes.length > 0}>{T("Khóa phòng", "Block room")}</button></div>
      </form>

      <div className="card">
        <h3>{T("Đang và sắp khóa", "Current and upcoming blocks")}</h3>
        {upcoming.length === 0 && <small>{T("Chưa có phòng nào bị khóa.", "No blocked rooms.")}</small>}
        {upcoming.map((b) => (
          <div className="row between" key={b.id}>
            <span><b>{roomName(b.roomId)}</b> · {fmtDate(b.from)} → {fmtDate(addDays(b.to, -1))}{b.from <= today && <span className="overdue"> · {T("đang khóa", "active")}</span>}{b.reason && <small> · {b.reason}</small>}</span>
            {b.source === "ical" ? <small>{T("Tự đồng bộ từ", "Synced from")} {b.sourceName || "iCal"}</small> : <button type="button" className="ghost danger" onClick={() => remove(b)}>{T("Mở khóa", "Unblock")}</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
