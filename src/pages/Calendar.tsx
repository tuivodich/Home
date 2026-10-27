import { useState } from "react";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { addDays, overlaps, todayStr } from "../lib/format";
import type { Booking, Room } from "../lib/types";

const DAYS = 14;

export default function CalendarPage() {
  const { t } = useI18n();
  const { data: rooms } = useCollection<Room>("rooms");
  const { data: bookings } = useCollection<Booking>("bookings");
  const [start, setStart] = useState(todayStr());
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
  const live = bookings.filter((b) => b.status !== "cancelled");

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
            {[...rooms].sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
              <tr key={r.id}>
                <th>{r.name}</th>
                {days.map((d) => {
                  const b = live.find((x) => x.roomId === r.id && overlaps(x.checkIn, x.checkOut, d, addDays(d, 1)));
                  return <td key={d} className={b ? `busy ${b.status}` : r.status === "maintenance" ? "maint" : ""} title={b?.guestName}>{b ? b.guestName.split(" ").pop() : ""}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
