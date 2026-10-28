import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { fmtDate, todayStr } from "../lib/format";
import { setRoomStatus, type RoomClean, type RoomStatusDoc } from "../lib/housekeeping";
import type { Booking, Room } from "../lib/types";

const LABEL: Record<RoomClean, [string, string]> = { ready: ["Sẵn sàng", "Ready"], dirty: ["Cần dọn", "Needs cleaning"], cleaning: ["Đang dọn", "Cleaning"] };

/** Quản lý buồng phòng: trạng thái bẩn / đang dọn / sẵn sàng của từng phòng, việc ưu tiên trong ngày, nhận dọn, ghi chú. */
export default function HousekeepingPage() {
  const { lang } = useI18n();
  const T = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const { user, profile } = useAuth();
  const { data: rooms } = useCollection<Room>("rooms");
  const { data: statuses } = useCollection<RoomStatusDoc>("roomStatus");
  const { data: bookings } = useCollection<Booking>("bookings");
  const [err, setErr] = useState("");
  const [filter, setFilter] = useState<RoomClean | "all">("all");
  const today = todayStr();
  const me = { uid: user?.uid ?? "", name: profile?.name || user?.displayName || user?.email || "" };

  const rows = useMemo(() => [...rooms].sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true })).map((r) => {
    const st = statuses.find((s) => s.id === r.id);
    const live = bookings.filter((b) => b.roomId === r.id);
    return {
      room: r, status: (st?.status ?? "ready") as RoomClean, doc: st,
      occupied: live.some((b) => b.status === "checked_in"),
      departing: live.some((b) => b.status === "checked_in" && b.checkOut <= today),
      arrivingToday: live.find((b) => ["confirmed", "pending"].includes(b.status) && b.checkIn === today),
      nextArrival: live.filter((b) => ["confirmed"].includes(b.status) && b.checkIn > today).sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0],
    };
  }), [rooms, statuses, bookings, today]);
  const urgent = rows.filter((r) => r.status !== "ready" && r.arrivingToday).length;
  const shown = rows.filter((r) => filter === "all" || r.status === filter);
  const run = async (f: () => Promise<unknown>) => { setErr(""); try { await f(); } catch (ex) { console.error("housekeeping", ex); setErr(T("Không cập nhật được. Vui lòng thử lại.", "Could not update. Please try again.")); } };

  return (
    <section>
      <h2>{T("Quản lý buồng phòng", "Housekeeping")}</h2>
      <p><small>{T("Phòng tự chuyển “Cần dọn” khi khách trả phòng (và có tin nhắn Telegram kèm nút “Đã dọn xong”).", "A room becomes “Needs cleaning” when the guest checks out (with a Telegram message and a “Cleaned” button).")}</small></p>
      {err && <p className="error">{err}</p>}
      {urgent > 0 && <p className="warn">⚠ {urgent} {T("phòng chưa sẵn sàng mà có khách nhận phòng hôm nay — ưu tiên dọn!", "room(s) not ready with a guest arriving today — clean first!")}</p>}
      <div className="card">
        <div className="segbar" role="group">
          {(["all", "dirty", "cleaning", "ready"] as const).map((k) => (
            <button key={k} type="button" className={`seg ${filter === k ? "on" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {k === "all" ? T("Tất cả", "All") : LABEL[k][lang === "vi" ? 0 : 1]} ({k === "all" ? rows.length : rows.filter((r) => r.status === k).length})
            </button>
          ))}
        </div>
      </div>
      <div className="grid">
        {shown.map(({ room, status, doc: d, occupied, departing, arrivingToday, nextArrival }) => (
          <div className={`card hk hk-${status}`} key={room.id} data-room={room.name}>
            <div className="row between"><strong>{room.name}</strong><span className={`tag hk-tag-${status}`}>{LABEL[status][lang === "vi" ? 0 : 1]}</span></div>
            <small>
              {occupied ? `🛏 ${T("Có khách", "Occupied")}${departing ? ` · ${T("trả phòng hôm nay", "check-out due")}` : ""}` : `✔ ${T("Trống", "Vacant")}`}
              {arrivingToday && <b className={status === "ready" ? "" : "overdue"}> · {T("khách đến hôm nay", "guest arriving today")}</b>}
              {!arrivingToday && nextArrival && ` · ${T("khách kế tiếp", "next guest")} ${fmtDate(nextArrival.checkIn)}`}
            </small>
            {d?.assignedName && <small>🧹 {d.assignedName}</small>}
            {d?.note && <small>📝 {d.note}</small>}
            <div className="row">
              {status !== "dirty" && <button className="ghost" onClick={() => run(() => setRoomStatus(room.id, "dirty", me))}>{T("Báo bẩn", "Mark dirty")}</button>}
              {status !== "cleaning" && <button className="ghost" onClick={() => run(() => setRoomStatus(room.id, "cleaning", me, { assignedTo: me.uid, assignedName: me.name }))}>{T("Nhận dọn", "Start cleaning")}</button>}
              {status !== "ready" && <button onClick={() => run(() => setRoomStatus(room.id, "ready", me))}>✅ {T("Đã dọn xong", "Cleaned")}</button>}
              <button className="ghost" onClick={() => { const n = prompt(T("Ghi chú cho phòng này:", "Note for this room:"), d?.note ?? ""); if (n !== null) run(() => setRoomStatus(room.id, status, me, { note: n.trim(), assignedTo: d?.assignedTo, assignedName: d?.assignedName })); }}>📝</button>
            </div>
          </div>
        ))}
      </div>
      {rows.length === 0 && <p>{T("Chưa có phòng.", "No rooms yet.")}</p>}
    </section>
  );
}
