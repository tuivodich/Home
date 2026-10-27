import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useMoney } from "../lib/useRate";
import { useI18n } from "../i18n";
import { addDays, nightsBetween, overlaps, todayStr } from "../lib/format";
import GuestInfo from "../components/GuestInfo";
import type { Booking, Guest, Room } from "../lib/types";

const DAYS = 14;

export default function CalendarPage() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const { money } = useMoney();
  // Chỉ chủ / quản lý / lễ tân được đọc dữ liệu khách (theo Firestore rules).
  const canSeeGuests = ["owner", "manager", "reception"].includes(profile?.role ?? "");
  const { data: rooms } = useCollection<Room>("rooms");
  const { data: bookings } = useCollection<Booking>("bookings");
  const { data: guests } = useCollection<Guest>("guests", canSeeGuests);
  const [start, setStart] = useState(todayStr());
  const [openId, setOpenId] = useState("");
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
  const live = bookings.filter((b) => b.status !== "cancelled");

  const open = bookings.find((b) => b.id === openId);
  const openRoom = rooms.find((r) => r.id === open?.roomId);
  const linked = guests.filter((g) => g.bookingId === openId);
  const unlinked = guests.filter((g) => !g.bookingId);

  return (
    <section>
      <h2>{t("calendar")}</h2>
      <div className="row">
        <button className="ghost" onClick={() => setStart(addDays(start, -7))}>‹ 7</button>
        <button className="ghost" onClick={() => setStart(todayStr())}>{t("dashboard")}</button>
        <button className="ghost" onClick={() => setStart(addDays(start, 7))}>7 ›</button>
      </div>
      <div className="scroll">
        <table className="cal">
          <thead>
            <tr><th>{t("room")}</th>{days.map((d) => <th key={d} className={d === todayStr() ? "today" : ""}>{d.slice(8)}<br /><small>{d.slice(5, 7)}</small></th>)}</tr>
          </thead>
          <tbody>
            {[...rooms].sort((a, b) => a.name.localeCompare(b.name)).map((r) => {
              const cells = [];
              for (let i = 0; i < DAYS;) {
                const d = days[i];
                const b = live.find((x) => x.roomId === r.id && overlaps(x.checkIn, x.checkOut, d, addDays(d, 1)));
                if (!b) {
                  cells.push(<td key={d} className={r.status === "maintenance" ? "maint" : ""} />);
                  i++;
                  continue;
                }
                let span = 1; // gộp các ngày liên tiếp của cùng một đặt phòng thành một ô
                while (i + span < DAYS && days[i + span] < b.checkOut) span++;
                cells.push(
                  <td key={d} colSpan={span} className={`busy ${b.status}`}>
                    <button className="namebtn" onClick={() => setOpenId(b.id)}>{b.guestName}</button>
                  </td>,
                );
                i += span;
              }
              return <tr key={r.id}><th>{r.name}</th>{cells}</tr>;
            })}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="overlay" onClick={() => setOpenId("")}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <div className="row between">
              <h3>{t("bookingDetails")}</h3>
              <button className="ghost" onClick={() => setOpenId("")}>{t("close")}</button>
            </div>
            <div>
              <strong>{open.guestName}</strong> <span className={`tag ${open.status}`}>{t(open.status)}</span>
              <div>{open.checkIn} → {open.checkOut} ({nightsBetween(open.checkIn, open.checkOut)} {t("nights")})</div>
              <div>{t("numGuests")}: {open.guests}</div>
              {open.phone && <div>{t("phone")}: {open.phone}</div>}
              {open.email && <div>{t("email")}: {open.email}</div>}
              <div>{t("total")}: {money(open.total)}</div>
              {open.couponCode && <div>🏷 {t("couponApplied")} {open.couponCode} (−{open.discountPercent}%)</div>}
              {open.note && <div>{t("note")}: {open.note}</div>}
            </div>
            <h4>{t("roomInfo")}</h4>
            {openRoom ? (
              <div>
                <strong>{openRoom.name}</strong> · {t(openRoom.type)} · {openRoom.capacity} 👤
                <div>{money(openRoom.price)} / {t("nights")}</div>
              </div>
            ) : <small>?</small>}

            {canSeeGuests && (
              <>
                <h4>{t("linkedGuests")}</h4>
                {linked.length === 0 && <small>{t("noLinkedGuests")}</small>}
                {linked.map((g) => <GuestInfo key={g.id} g={g} large />)}
                {linked.length === 0 && unlinked.length > 0 && (
                  <label>{t("linkGuest")}
                    <select value="" onChange={(e) => e.target.value && updateDoc(doc(db, "guests", e.target.value), { bookingId: openId })}>
                      <option value="">{t("none2")}</option>
                      {unlinked.map((g) => <option key={g.id} value={g.id}>{g.fullName} · {g.docNumber}</option>)}
                    </select>
                  </label>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
