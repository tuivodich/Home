import { useEffect, useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { fmtDate, todayStr } from "../lib/format";
import { dueTasks, markTaskDone, saveRoomNote, setRoomStatus, toggleCheck, useHkConfig, type HkConfig, type RoomClean, type RoomStatusDoc } from "../lib/housekeeping";
import type { Booking, Room } from "../lib/types";

const LABEL: Record<RoomClean, [string, string]> = { ready: ["Sẵn sàng", "Ready"], dirty: ["Cần dọn", "Needs cleaning"], cleaning: ["Đang dọn", "Cleaning"] };

/** Chủ/quản lý: sửa danh sách kiểm tra dọn phòng và các việc định kỳ (mỗi dòng một việc; việc định kỳ viết "tên | số ngày"). */
function ConfigEditor({ cfg, T }: { cfg: HkConfig; T: (vi: string, en: string) => string }) {
  const [open, setOpen] = useState(false);
  const [check, setCheck] = useState("");
  const [per, setPer] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { setCheck(cfg.checklist.map((c) => c.label).join("\n")); setPer(cfg.periodic.map((p) => `${p.label} | ${p.everyDays}`).join("\n")); }, [cfg]);
  const slug = (s: string, i: number) => `${i}-${s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24)}`;
  const save = async () => {
    const checklist = check.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 30).map((label, i) => ({ id: slug(label, i), label: label.slice(0, 100) }));
    const periodic: { id: string; label: string; everyDays: number }[] = [];
    for (const [i, l] of per.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 30).entries()) {
      const m = l.match(/^(.*?)\s*\|\s*(\d{1,3})$/);
      if (!m || !m[1].trim() || +m[2] < 1) { setMsg(T(`Dòng việc định kỳ chưa đúng: “${l}”. Viết dạng: Vệ sinh máy lạnh | 30`, `Invalid periodic line: “${l}”. Use: Clean A/C | 30`)); return; }
      periodic.push({ id: slug(m[1], i), label: m[1].trim().slice(0, 100), everyDays: +m[2] });
    }
    try { await setDoc(doc(db, "settings", "housekeeping"), { checklist, periodic }); setMsg(T("Đã lưu.", "Saved.")); } catch (e) { console.error("hk cfg", e); setMsg(T("Không lưu được.", "Could not save.")); }
  };
  return (
    <div className="card">
      <button type="button" className="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>⚙ {T("Danh sách kiểm tra & việc định kỳ", "Checklist & recurring tasks")}</button>
      {open && (
        <>
          <label>{T("Danh sách kiểm tra khi dọn phòng (mỗi dòng một việc)", "Cleaning checklist (one per line)")}
            <textarea rows={6} value={check} onChange={(e) => setCheck(e.target.value)} />
          </label>
          <label>{T("Việc định kỳ cho từng phòng — “tên việc | số ngày” (mỗi dòng một việc)", "Recurring tasks per room — “task | days” (one per line)")}
            <textarea rows={4} value={per} placeholder={T("Vệ sinh máy lạnh | 30\nKiểm tra bình cứu hỏa | 90", "Clean A/C | 30\nCheck fire extinguisher | 90")} onChange={(e) => setPer(e.target.value)} />
          </label>
          <small>{T("Việc định kỳ đến hạn sẽ hiện ở trang này và được nhắc cho chủ/quản lý qua Telegram mỗi ngày.", "Due recurring tasks show here and are reminded to owner/managers on Telegram daily.")}</small>
          <div className="row"><button type="button" onClick={save}>{T("Lưu", "Save")}</button>{msg && <small role="status">{msg}</small>}</div>
        </>
      )}
    </div>
  );
}

/** Quản lý dọn phòng: trạng thái bẩn / đang dọn / sẵn sàng của từng phòng, việc ưu tiên trong ngày, nhận dọn, ghi chú. */
export default function HousekeepingPage() {
  const { lang } = useI18n();
  const T = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const { user, profile } = useAuth();
  const { data: rooms } = useCollection<Room>("rooms");
  const { data: statuses } = useCollection<RoomStatusDoc>("roomStatus");
  const { data: bookings } = useCollection<Booking>("bookings");
  const { data: notes } = useCollection<{ id: string; text: string; updatedByName?: string }>("roomNotes");
  const hk = useHkConfig();
  const isAdmin = profile?.role === "owner" || profile?.role === "manager";
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
      <h2>{T("Quản lý dọn phòng", "Room cleaning")}</h2>
      <p><small>{T("Phòng tự chuyển “Cần dọn” khi khách trả phòng (và có tin nhắn Telegram kèm nút “Đã dọn xong”).", "A room becomes “Needs cleaning” when the guest checks out (with a Telegram message and a “Cleaned” button).")}</small></p>
      {err && <p className="error">{err}</p>}
      {isAdmin && <ConfigEditor cfg={hk} T={T} />}
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
            {notes.find((n) => n.id === room.id)?.text && <small className="hk-note">📌 {notes.find((n) => n.id === room.id)!.text}</small>}
            {status !== "ready" && hk.checklist.length > 0 && (
              <div className="hk-check" role="group" aria-label={T("Danh sách kiểm tra dọn phòng", "Cleaning checklist")}>
                {hk.checklist.map((c) => (
                  <label key={c.id} className="hk-item"><input type="checkbox" checked={(d?.done ?? []).includes(c.id)} onChange={(e) => run(() => toggleCheck(room.id, status, c.id, e.target.checked, me))} /> {c.label}</label>
                ))}
                <small>{(d?.done ?? []).filter((x) => hk.checklist.some((c) => c.id === x)).length}/{hk.checklist.length}</small>
              </div>
            )}
            {dueTasks(hk.periodic, d?.tasks, today).map((t) => (
              <div className="row between hk-due" key={t.id}>
                <small className="overdue">⏰ {t.label}{d?.tasks?.[t.id] ? ` (${T("lần cuối", "last")} ${fmtDate(d.tasks[t.id])})` : ` (${T("chưa làm lần nào", "never done")})`}</small>
                <button type="button" className="ghost" onClick={() => run(() => markTaskDone(room.id, status, t.id, today, me))}>✓ {T("Đã làm", "Done")}</button>
              </div>
            ))}
            <div className="row">
              {status !== "dirty" && <button className="ghost" onClick={() => run(() => setRoomStatus(room.id, "dirty", me))}>{T("Báo bẩn", "Mark dirty")}</button>}
              {status !== "cleaning" && <button className="ghost" onClick={() => run(() => setRoomStatus(room.id, "cleaning", me, { assignedTo: me.uid, assignedName: me.name }))}>{T("Nhận dọn", "Start cleaning")}</button>}
              {status !== "ready" && <button onClick={() => {
                const left = hk.checklist.filter((c) => !(d?.done ?? []).includes(c.id)).length;
                if (left > 0 && !confirm(T(`Còn ${left} việc trong danh sách kiểm tra chưa tích. Vẫn đánh dấu đã dọn xong?`, `${left} checklist item(s) are not ticked. Mark as cleaned anyway?`))) return;
                run(() => setRoomStatus(room.id, "ready", me));
              }}>✅ {T("Đã dọn xong", "Cleaned")}</button>}
              <button className="ghost" title={T("Ghi chú nội bộ của phòng", "Internal room note")} onClick={() => { const n = prompt(T("Ghi chú nội bộ cho phòng này (chỉ nhân viên thấy; để trống để xóa):", "Internal note for this room (staff only; empty to clear):"), notes.find((x) => x.id === room.id)?.text ?? ""); if (n !== null) run(() => saveRoomNote(room.id, n.trim(), me.name)); }}>📝</button>
            </div>
          </div>
        ))}
      </div>
      {rows.length === 0 && <p>{T("Chưa có phòng.", "No rooms yet.")}</p>}
    </section>
  );
}
