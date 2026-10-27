import { useMemo, useState } from "react";
import DateInput from "../components/DateInput";
import { useL } from "../i18n";
import { useMoney } from "../lib/useRate";
import { addDays, nightsBetween, todayStr } from "../lib/format";
import type { Busy, Room } from "../lib/types";
import { nightState, rangeState, type Cell, type Search } from "./availability";

const DAYS = 14;
const WEEKDAYS_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const WEEKDAYS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function Availability({ rooms, busy, search, setSearch, onBook }: {
  rooms: Room[]; busy: Busy[]; search: Search; setSearch: (s: Search) => void; onBook: (roomId: string) => void;
}) {
  const L = useL();
  const { money } = useMoney();
  const isVi = L.nav.home === "Trang chủ";
  const [start, setStart] = useState(todayStr());
  const set = (patch: Partial<Search>) => setSearch({ ...search, ...patch });

  const nights = nightsBetween(search.checkIn, search.checkOut);
  const error = !search.checkIn || !search.checkOut || nights < 1 ? L.booking.errDates
    : search.checkIn < todayStr() ? L.booking.errPast
    : nights > 30 ? L.booking.errLong : "";

  const shown = useMemo(() => rooms.filter((r) => !search.roomId || r.id === search.roomId), [rooms, search.roomId]);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
  const label: Record<Cell, string> = { free: L.booking.free, booked: L.booking.booked, held: L.booking.held, maint: L.booking.maintenance };

  return (
    <section id="booking" className="lp-section book">
      <div className="lp-wrap">
        <div className="lp-head reveal">
          <span className="lp-eyebrow">{L.booking.eyebrow}</span>
          <h2>{L.booking.title}</h2>
          <p>{L.booking.sub}</p>
        </div>

        <div className="lp-panel reveal">
          <div className="lp-filters">
            <label>{L.search.checkIn}
              <DateInput min={todayStr()} value={search.checkIn}
                onChange={(v) => { set({ checkIn: v, checkOut: search.checkOut <= v ? addDays(v, 1) : search.checkOut }); if (v) setStart(v); }} />
            </label>
            <label>{L.search.checkOut}
              <DateInput min={addDays(search.checkIn || todayStr(), 1)} value={search.checkOut} onChange={(v) => set({ checkOut: v })} />
            </label>
            <label>{L.search.room}
              <select value={search.roomId} onChange={(e) => set({ roomId: e.target.value })}>
                <option value="">{L.search.allRooms}</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
            <label>{L.search.guests}
              <input type="number" min={1} max={30} value={search.guests} onChange={(e) => set({ guests: Math.max(1, +e.target.value || 1) })} />
            </label>
          </div>
          {error && <p className="lp-error">{error}</p>}

          <div className="lp-results">
            {!error && shown.map((r) => {
              const st = rangeState(r, busy, search.checkIn, search.checkOut);
              const over = search.guests > r.capacity;
              const ok = st === "free" && !over;
              const note = st === "maint" ? L.booking.maintNote : st === "held" ? L.booking.heldNote : st === "booked" ? L.booking.unavailable : over ? L.booking.fullCap : L.booking.available;
              return (
                <div key={r.id} className={`lp-result ${ok ? "ok" : "no"}`}>
                  <div>
                    <strong>{r.name}</strong>
                    <div className="lp-muted">👤 {r.capacity} · {r.type === "wood" ? L.rooms.wood : L.rooms.concrete}</div>
                  </div>
                  <div className="lp-result-mid">
                    <span className={`lp-badge ${ok ? "free" : st === "held" ? "held" : "booked"}`}>{note}</span>
                    {ok && <div className="lp-muted">{L.booking.estimate}: {money(r.price * nights)} · {nights} {L.booking.nights}</div>}
                  </div>
                  <button className="lp-btn primary sm" disabled={!ok} onClick={() => onBook(r.id)}>{L.booking.book}</button>
                </div>
              );
            })}
          </div>
          {!error && <p className="lp-muted lp-small">{L.booking.final}</p>}
        </div>

        <div className="lp-panel reveal">
          <div className="lp-cal-bar">
            <strong>{L.booking.calendarFor}</strong>
            <div>
              <button className="lp-pill" onClick={() => setStart(addDays(start, -7))}>{L.booking.prev}</button>
              <button className="lp-pill" onClick={() => setStart(todayStr())}>{L.booking.today}</button>
              <button className="lp-pill" onClick={() => setStart(addDays(start, 7))}>{L.booking.next}</button>
            </div>
          </div>
          <div className="lp-legend">
            {(["free", "booked", "held", "maint"] as Cell[]).map((c) => <span key={c}><i className={`dot ${c}`} />{label[c]}</span>)}
          </div>
          <div className="lp-scroll">
            <table className="lp-cal">
              <thead>
                <tr>
                  <th />
                  {days.map((d) => {
                    const wd = new Date(d + "T00:00:00").getDay();
                    return <th key={d} className={d === todayStr() ? "today" : ""}><small>{(isVi ? WEEKDAYS_VI : WEEKDAYS_EN)[wd]}</small>{d.slice(8)}<small>/{d.slice(5, 7)}</small></th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <th scope="row">{r.name}</th>
                    {days.map((d) => {
                      const past = d < todayStr();
                      const s = past ? "past" : nightState(r, busy, d);
                      const inRange = d >= search.checkIn && d < search.checkOut;
                      return <td key={d} className={`${s} ${inRange ? "sel" : ""}`} title={s === "past" ? "" : label[s as Cell]} />;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
