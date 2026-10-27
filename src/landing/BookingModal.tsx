import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { collection, doc, writeBatch } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";
import { useL } from "../i18n";
import { useMoney } from "../lib/useRate";
import { nightsBetween } from "../lib/format";
import type { Busy, Room, UserDoc } from "../lib/types";
import { rangeState, type Search } from "./availability";

export default function BookingModal({ room, search, user, profile, busy, onClose }: {
  room: Room; search: Search; user: User; profile: UserDoc | null; busy: Busy[]; onClose: () => void;
}) {
  const L = useL();
  const { money } = useMoney();
  const nights = nightsBetween(search.checkIn, search.checkOut);
  const [name, setName] = useState(profile?.name || user.displayName || "");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState(Math.min(search.guests, room.capacity));
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busyNow, setBusyNow] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    // Kiểm tra lại trên dữ liệu mới nhất phòng vừa bị giữ chỗ hay chưa.
    if (rangeState(room, busy, search.checkIn, search.checkOut) !== "free") return setErr(L.modal.clash);
    setBusyNow(true);
    try {
      const id = doc(collection(db, "bookings")).id;
      const b = writeBatch(db);
      b.set(doc(db, "bookings", id), {
        roomId: room.id, guestName: name.trim(), phone: phone.trim(), email: user.email ?? "",
        checkIn: search.checkIn, checkOut: search.checkOut, guests, total: room.price * nights,
        status: "pending", note: note.trim(), source: "online", createdBy: user.uid,
      });
      // Bản sao công khai (không có dữ liệu cá nhân) để mọi người thấy phòng đang được giữ chỗ.
      b.set(doc(db, "busy", id), { roomId: room.id, checkIn: search.checkIn, checkOut: search.checkOut, status: "pending" });
      await b.commit();
      setDone(true);
    } catch (ex) {
      console.error("booking failed", ex);
      setErr(L.modal.err);
    } finally { setBusyNow(false); }
  };

  return (
    <div className="lm-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="lm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="lm-x" onClick={onClose} aria-label={L.modal.cancel}>×</button>
        {done ? (
          <div className="lm-done">
            <div className="lm-tick">✓</div>
            <h3>{L.modal.doneTitle}</h3>
            <p>{L.modal.doneText}</p>
            <Link className="lm-btn" to="/account">{L.modal.viewMine}</Link>
            <button className="lm-link" onClick={onClose}>{L.modal.cancel}</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3>{L.modal.title}</h3>
            <div className="lm-summary">
              <strong>{room.name}</strong>
              <div>{search.checkIn} → {search.checkOut} · {nights} {L.booking.nights}</div>
              <div>{L.booking.estimate}: <b>{money(room.price * nights)}</b></div>
            </div>
            <label>{L.modal.name}<input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>{L.modal.phone}<input required type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
            <label>{L.modal.guests}<input type="number" min={1} max={room.capacity} value={guests} onChange={(e) => setGuests(Math.max(1, Math.min(room.capacity, +e.target.value || 1)))} /></label>
            <label>{L.modal.note}<textarea maxLength={500} rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            {err && <p className="lm-err">{err}</p>}
            <button className="lm-btn" type="submit" disabled={busyNow}>{busyNow ? L.modal.sending : L.modal.send}</button>
            <p className="lm-muted lm-small">{L.booking.final}</p>
          </form>
        )}
      </div>
    </div>
  );
}
