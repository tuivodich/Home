import { useMemo, useState } from "react";
import { Timestamp, addDoc, collection, deleteDoc, doc, query, setDoc, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { fmtDate, todayStr } from "../lib/format";
import { GRACE_MIN, dateOf, downloadCsv, fmtClock, fmtHours, lastMonths, lateMinutes, monthRange, toLocalInput, useQueryDocs, workedMs, type Att, type ScheduleEntry, type Shift } from "../lib/hr";
import { isStaffRole, type UserDoc } from "../lib/types";
import { fill, useHr } from "../i18n/hr";
import { useI18n } from "../i18n";
import { DateTimeInput } from "../components/DateInput";

type Staff = UserDoc & { id: string };
interface Draft { id?: string; uid: string; inV: string; outV: string }

/** Bảng chấm công theo tháng (chủ/quản lý): tổng hợp từng nhân viên, chi tiết từng lượt, sửa/thêm/xóa, xuất CSV. */
export default function Timesheet() {
  const H = useHr();
  const { t } = useI18n();
  const { user } = useAuth();
  const months = useMemo(() => lastMonths(12), []);
  const [month, setMonth] = useState(months[0]);
  const [from, to] = monthRange(month);
  const [uidSel, setUidSel] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const today = todayStr();

  const { data: users } = useCollection<Staff>("users");
  const { data: shifts } = useCollection<Shift>("shifts");
  const att = useQueryDocs<Att>(query(collection(db, "attendance"), where("date", ">=", from), where("date", "<", to)), `ts:att:${month}`);
  const sched = useQueryDocs<ScheduleEntry>(query(collection(db, "schedule"), where("date", ">=", from), where("date", "<", to)), `ts:sch:${month}`);

  const staff = useMemo(() => users.filter((u) => isStaffRole(u.role)).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "vi")), [users]);
  const nameOf = (uid: string) => { const u = users.find((x) => x.id === uid); return u ? u.name || u.email : att.data.find((a) => a.uid === uid)?.name || uid; };
  const shiftFor = (uid: string, date: string) => shifts.find((s) => s.id === sched.data.find((e) => e.id === `${date}_${uid}`)?.shiftId);

  const rows = useMemo(() => {
    const ids = new Set<string>([...staff.map((u) => u.id), ...att.data.map((a) => a.uid)]);
    return [...ids].map((uid) => {
      const mine = att.data.filter((a) => a.uid === uid);
      const dates = new Set(mine.map((a) => a.date));
      const scheduled = sched.data.filter((e) => e.uid === uid);
      return {
        uid, days: dates.size, ms: mine.reduce((s, a) => s + workedMs(a), 0),
        lates: mine.filter((a) => lateMinutes(a, shiftFor(uid, a.date)) > 0).length,
        open: mine.filter((a) => !a.out).length,
        absent: scheduled.filter((e) => e.date < today && !dates.has(e.date)).map((e) => e.date).sort(),
      };
    }).sort((a, b) => nameOf(a.uid).localeCompare(nameOf(b.uid), "vi"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, att.data, sched.data, shifts, users, today]);

  const sel = rows.find((r) => r.uid === uidSel);
  const detail = useMemo(() => att.data.filter((a) => a.uid === uidSel).sort((a, b) => b.in.toMillis() - a.in.toMillis()), [att.data, uidSel]);
  const guard = async (f: () => Promise<unknown>) => { setErr(""); setMsg(""); try { await f(); } catch (ex) { console.error("timesheet", ex); setErr(t("error")); } };

  const startNew = () => setDraft({ uid: uidSel, inV: `${today}T08:00`, outV: `${today}T17:00` });
  const startEdit = (a: Att) => setDraft({ id: a.id, uid: a.uid, inV: toLocalInput(a.in.toDate()), outV: a.out ? toLocalInput(a.out.toDate()) : "" });
  const badOrder = !!draft && !!draft.outV && new Date(draft.outV) <= new Date(draft.inV);
  const canSave = !!draft && !!draft.inV && !Number.isNaN(new Date(draft.inV).getTime()) && !badOrder;
  const save = () => draft && guard(async () => {
    const inD = new Date(draft.inV);
    const data: Record<string, unknown> = { uid: draft.uid, name: nameOf(draft.uid), date: dateOf(inD), in: Timestamp.fromDate(inD), source: "admin", editedBy: user?.uid ?? "" };
    if (draft.outV) data.out = Timestamp.fromDate(new Date(draft.outV));
    if (draft.id) {
      // Sửa: ghi lại toàn bộ lượt (bỏ trống giờ ra thì lượt trở về "chưa ra ca").
      await setDoc(doc(db, "attendance", draft.id), data);
    } else await addDoc(collection(db, "attendance"), data);
    setDraft(null); setMsg(H.saved);
  });

  const exportCsv = () => {
    const out: (string | number)[][] = [[H.staff, H.workDays, H.totalHours, H.lates, H.absences, H.openShifts]];
    rows.forEach((r) => out.push([nameOf(r.uid), r.days, fmtHours(r.ms), r.lates, r.absent.length, r.open]));
    out.push([], [H.staff, H.day, H.shift, H.in, H.out, H.hours, `${H.lates} (min)`]);
    [...att.data].sort((a, b) => nameOf(a.uid).localeCompare(nameOf(b.uid), "vi") || a.in.toMillis() - b.in.toMillis()).forEach((a) => {
      const s = shiftFor(a.uid, a.date);
      out.push([nameOf(a.uid), fmtDate(a.date), s ? s.name : "", fmtClock(a.in.toDate()), a.out ? fmtClock(a.out.toDate()) : "", a.out ? fmtHours(workedMs(a)) : "", lateMinutes(a, s)]);
    });
    downloadCsv(`cham-cong-${month}.csv`, out);
  };

  return (
    <section>
      <h2>{H.timesheet}</h2>
      <p><small>{fill(H.timesheetHint, { g: GRACE_MIN })}</small></p>
      {err && <p className="error">{err}</p>}
      {msg && <p className="ok-msg" role="status">{msg}</p>}
      <div className="card">
        <div className="row between">
          <label>{H.month}
            <select value={month} onChange={(e) => { setMonth(e.target.value); setUidSel(""); setDraft(null); }}>
              {months.map((m) => <option key={m} value={m}>{m.slice(5)}/{m.slice(0, 4)}</option>)}
            </select>
          </label>
          <button className="ghost" onClick={exportCsv}>⬇ {H.exportCsv}</button>
        </div>
        <div className="rostscroll">
          <table className="rosttbl sumtbl">
            <thead><tr><th>{H.staff}</th><th>{H.workDays}</th><th>{H.totalHours}</th><th>{H.lates}</th><th>{H.absences}</th><th>{H.openShifts}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.uid} className={`clickrow ${uidSel === r.uid ? "sel" : ""}`} onClick={() => { setUidSel(r.uid); setDraft(null); }}>
                  <th scope="row">{nameOf(r.uid)}</th><td>{r.days}</td><td>{fmtHours(r.ms)}</td>
                  <td className={r.lates ? "overdue" : ""}>{r.lates}</td><td className={r.absent.length ? "overdue" : ""}>{r.absent.length}</td><td>{r.open}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p>{H.noStaff}</p>}
      </div>

      {sel && (
        <div className="card">
          <div className="row between"><h3>{H.details}: {nameOf(sel.uid)}</h3><button onClick={startNew}>+ {H.addEntry}</button></div>
          {sel.absent.length > 0 && <p className="overdue">{H.absentOn}: {sel.absent.map(fmtDate).join(", ")}</p>}
          {draft && (
            <div className="card shiftform">
              <label>{H.in}<DateTimeInput required value={draft.inV} onChange={(v) => setDraft({ ...draft, inV: v })} /></label>
              <label>{H.out}<DateTimeInput value={draft.outV} onChange={(v) => setDraft({ ...draft, outV: v })} /></label>
              {badOrder && <p className="error">{H.outBeforeIn}</p>}
              <div className="row"><button type="button" disabled={!canSave} onClick={save}>{H.save}</button><button type="button" className="ghost" onClick={() => setDraft(null)}>{H.cancel}</button></div>
            </div>
          )}
          {detail.length === 0 && <p>{H.noRecords}</p>}
          {detail.map((a) => {
            const s = shiftFor(a.uid, a.date), m = lateMinutes(a, s);
            return (
              <div key={a.id} className="row between">
                <span>{fmtDate(a.date)}{s ? ` · ${s.name}` : ""} · {fmtClock(a.in.toDate())} → {a.out ? fmtClock(a.out.toDate()) : <b className="overdue">{H.notOut}</b>}</span>
                <span>
                  {a.out ? fmtHours(workedMs(a)) : ""}{m ? <span className="overdue"> · {fill(H.late, { m })}</span> : ""}{a.source === "admin" ? <small> · {H.adminEdited}</small> : ""}{" "}
                  <button className="ghost" onClick={() => startEdit(a)}>{H.edit}</button>{" "}
                  <button className="ghost danger" onClick={() => confirm(H.sureDelete) && guard(() => deleteDoc(doc(db, "attendance", a.id)))}>{H.delete}</button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

