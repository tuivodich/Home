import { useState, type FormEvent } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useMoney } from "../lib/useRate";
import { useI18n } from "../i18n";
import { addDays, nightsBetween, overlaps, todayStr } from "../lib/format";
import type { Booking, BookingStatus, Room } from "../lib/types";

export default function Bookings() {
  const { t } = useI18n();
  const { money } = useMoney();
  const { data: rooms } = useCollection<Room>("rooms");
  const { data: bookings } = useCollection<Booking>("bookings");
  const [err, setErr] = useState("");
  const [f, setF] = useState({
    roomId: "", guestName: "", phone: "", checkIn: todayStr(), checkOut: addDays(todayStr(), 1), guests: 2, total: 0, note: "",
  });

  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? "?";
  const nights = nightsBetween(f.checkIn, f.checkOut);
  const room = rooms.find((r) => r.id === f.roomId);
  const suggested = room ? room.price * Math.max(nights, 0) : 0;

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (nights < 1) return setErr(t("badDates"));
    const clash = bookings.some((b) => b.roomId === f.roomId && b.status !== "cancelled"
      && overlaps(b.checkIn, b.checkOut, f.checkIn, f.checkOut));
    if (clash) return setErr(t("overlap"));
    await addDoc(collection(db, "bookings"), { ...f, total: f.total || suggested, status: "confirmed" });
    setF({ ...f, guestName: "", phone: "", total: 0, note: "" });
  };

  const setStatus = (id: string, status: BookingStatus) => updateDoc(doc(db, "bookings", id), { status });

  const sorted = [...bookings].sort((a, b) => b.checkIn.localeCompare(a.checkIn));

  return (
    <section>
      <h2>{t("bookings")}</h2>
      <form className="card" onSubmit={create}>
        <h3>{t("newBooking")}</h3>
        <label>{t("room")}
          <select required value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}>
            <option value="">—</option>
            {rooms.filter((r) => r.status === "active").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label>{t("guestName")}<input required value={f.guestName} onChange={(e) => setF({ ...f, guestName: e.target.value })} /></label>
        <label>{t("phone")}<input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <div className="row">
          <label>{t("checkIn")}<input type="date" required value={f.checkIn} onChange={(e) => setF({ ...f, checkIn: e.target.value })} /></label>
          <label>{t("checkOut")}<input type="date" required value={f.checkOut} onChange={(e) => setF({ ...f, checkOut: e.target.value })} /></label>
        </div>
        <label>{t("numGuests")}<input type="number" min={1} value={f.guests} onChange={(e) => setF({ ...f, guests: +e.target.value })} /></label>
        <label>{t("total")} (₫) — {nights > 0 ? `${nights} ${t("nights")} = ${money(suggested)}` : ""}
          <input type="number" min={0} step={10000} placeholder={String(suggested)} value={f.total || ""} onChange={(e) => setF({ ...f, total: +e.target.value })} />
        </label>
        <label>{t("note")}<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        {err && <p className="error">{err}</p>}
        <button type="submit">{t("add")}</button>
      </form>

      {sorted.length === 0 && <p>{t("noData")}</p>}
      {sorted.map((b) => (
        <div className="card" key={b.id}>
          <div className="row between">
            <strong>{b.guestName}</strong><span className={`tag ${b.status}`}>{t(b.status)}</span>
          </div>
          <div>{roomName(b.roomId)} · {b.checkIn} → {b.checkOut} ({nightsBetween(b.checkIn, b.checkOut)} {t("nights")})</div>
          <div>{money(b.total)}{b.phone && ` · ${b.phone}`}</div>
          {b.note && <small>{b.note}</small>}
          <div className="row">
            {b.status === "confirmed" && <button onClick={() => setStatus(b.id, "checked_in")}>{t("doCheckIn")}</button>}
            {b.status === "checked_in" && <button onClick={() => setStatus(b.id, "checked_out")}>{t("doCheckOut")}</button>}
            {(b.status === "confirmed" || b.status === "checked_in") && (
              <button className="ghost danger" onClick={() => confirm(t("sure")) && setStatus(b.id, "cancelled")}>{t("doCancel")}</button>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
