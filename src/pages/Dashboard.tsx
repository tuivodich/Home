import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { todayStr } from "../lib/format";
import type { Booking, Room } from "../lib/types";

export default function Dashboard() {
  const { t } = useI18n();
  const { data: rooms } = useCollection<Room>("rooms");
  const { data: bookings } = useCollection<Booking>("bookings");
  const today = todayStr();
  const live = bookings.filter((b) => b.status !== "cancelled");
  const arrivals = live.filter((b) => b.checkIn === today && b.status === "confirmed");
  const departures = live.filter((b) => b.checkOut === today && b.status === "checked_in");
  const occupied = live.filter((b) => b.status === "checked_in").length;
  const name = (id: string) => rooms.find((r) => r.id === id)?.name ?? "?";

  return (
    <section>
      <h2>{t("dashboard")}</h2>
      <div className="grid stats">
        <div className="card"><big>{rooms.length}</big><div>{t("totalRooms")}</div></div>
        <div className="card"><big>{occupied}</big><div>{t("occupiedNow")}</div></div>
        <div className="card"><big>{arrivals.length}</big><div>{t("arrivalsToday")}</div></div>
        <div className="card"><big>{departures.length}</big><div>{t("departuresToday")}</div></div>
      </div>
      {[[t("arrivalsToday"), arrivals], [t("departuresToday"), departures]].map(([title, list]) => (
        <div className="card" key={title as string}>
          <h3>{title as string}</h3>
          {(list as Booking[]).length === 0 ? <small>{t("none")}</small> : (list as Booking[]).map((b) => <div key={b.id}>{b.guestName} — {name(b.roomId)}</div>)}
        </div>
      ))}
    </section>
  );
}
