import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { fmtDate, todayStr } from "../lib/format";
import { TIME_RE, addDaysStr, mondayOf, shiftEnd, useQueryDocs, weekOf, type ScheduleEntry, type Shift } from "../lib/hr";
import { isStaffRole, type UserDoc } from "../lib/types";
import { useHr } from "../i18n/hr";
import { useI18n } from "../i18n";

const SAMPLES = [
  { name: "Ca sáng", start: "06:00", end: "14:00" },
  { name: "Ca chiều", start: "14:00", end: "22:00" },
  { name: "Ca tối", start: "22:00", end: "06:00" },
];
const WD_VI = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"], WD_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Staff = UserDoc & { id: string };

/** Lịch ca (chủ/quản lý): danh mục ca và bảng xếp ca theo tuần cho từng nhân viên. */
export default function Roster() {
  const H = useHr();
  const { t, lang } = useI18n();
  const { data: shifts } = useCollection<Shift>("shifts");
  const { data: users } = useCollection<Staff>("users");
  const [monday, setMonday] = useState(mondayOf(todayStr()));
  const days = weekOf(monday);
  const prev = addDaysStr(monday, -7);
  // Nghe cả tuần trước để có thể sao chép sang tuần này.
  const sched = useQueryDocs<ScheduleEntry>(query(collection(db, "schedule"), where("date", ">=", prev), where("date", "<=", days[6])), `ros:${monday}`);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  // Ô đã chọn nhưng chưa lưu: khóa "yyyy-mm-dd_uid" → mã ca ("" = nghỉ). Chỉ áp dụng khi bấm "Lưu lại".
  const [draft, setDraft] = useState<Record<string, { uid: string; date: string; name: string; shiftId: string }>>({});
  const [saving, setSaving] = useState(false);
  const dirty = Object.keys(draft).length;

  const staff = useMemo(() => users.filter((u) => isStaffRole(u.role)).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "vi")), [users]);
  const nameOf = (u: Staff) => u.name || u.email;
  const entry = (uid: string, d: string) => sched.data.find((e) => e.id === `${d}_${uid}`);
  const activeShifts = shifts.filter((s) => s.active).sort((a, b) => a.start.localeCompare(b.start));

  /** Giá trị đang hiển thị của ô: bản nháp nếu có, không thì lịch đã lưu. */
  const cellValue = (uid: string, d: string) => draft[`${d}_${uid}`]?.shiftId ?? entry(uid, d)?.shiftId ?? "";
  const setCell = (u: Staff, d: string, shiftId: string) => {
    setMsg(""); setErr("");
    setDraft((cur) => {
      const next = { ...cur }, key = `${d}_${u.id}`;
      if ((entry(u.id, d)?.shiftId ?? "") === shiftId) delete next[key]; // chọn lại đúng giá trị cũ = không thay đổi
      else next[key] = { uid: u.id, date: d, name: nameOf(u), shiftId };
      return next;
    });
  };

  // Sao chép tuần trước vào bản nháp (các ô còn trống); chỉ ghi khi bấm "Lưu lại".
  const copyPrev = () => {
    setMsg(""); setErr("");
    setDraft((cur) => {
      const next = { ...cur };
      for (const e of sched.data) {
        if (e.date < prev || e.date >= monday) continue;
        const d = addDaysStr(e.date, 7), key = `${d}_${e.uid}`;
        if (entry(e.uid, d) || next[key]) continue; // không ghi đè ô đã xếp hoặc đang chọn
        next[key] = { uid: e.uid, date: d, name: e.name, shiftId: e.shiftId };
      }
      return next;
    });
  };

  const save = async () => {
    setSaving(true); setErr(""); setMsg("");
    try {
      const w = writeBatch(db);
      for (const [key, c] of Object.entries(draft)) {
        if (c.shiftId) w.set(doc(db, "schedule", key), { date: c.date, uid: c.uid, name: c.name, shiftId: c.shiftId });
        else w.delete(doc(db, "schedule", key));
      }
      await w.commit();
      setDraft({}); setMsg(H.rosterSaved);
    } catch (ex) { console.error("roster save", ex); setErr(t("error")); } finally { setSaving(false); }
  };

  return (
    <section>
      <h2>{H.roster}</h2>
      <p><small>{H.rosterHint}</small></p>
      {err && <p className="error">{err}</p>}
      {msg && <p className="ok-msg" role="status">{msg}</p>}

      <div className="card">
        <div className="row between">
          <button className="ghost" onClick={() => setMonday(addDaysStr(monday, -7))}>{H.prevWeek}</button>
          <strong>{H.week} {fmtDate(days[0])} – {fmtDate(days[6])}</strong>
          <button className="ghost" onClick={() => setMonday(addDaysStr(monday, 7))}>{H.nextWeek}</button>
        </div>
        <div className="row">
          <button className="ghost" onClick={() => setMonday(mondayOf(todayStr()))}>{H.thisWeek}</button>
          <button className="ghost" disabled={saving} onClick={copyPrev}>{H.copyPrev}</button>
        </div>
        {staff.length === 0 ? <p>{H.noStaff}</p> : (
          <div className="rostscroll">
            <table className="rosttbl">
              <thead>
                <tr><th>{H.staff}</th>{days.map((d, i) => <th key={d} className={d === todayStr() ? "today" : ""}>{(lang === "vi" ? WD_VI : WD_EN)[i]}<br /><small>{d.slice(8)}/{d.slice(5, 7)}</small></th>)}</tr>
              </thead>
              <tbody>
                {staff.map((u) => (
                  <tr key={u.id}>
                    <th scope="row">{nameOf(u)}<br /><small>{t(u.role)}</small></th>
                    {days.map((d) => {
                      const v = cellValue(u.id, d);
                      const known = !v || shifts.some((s) => s.id === v);
                      return (
                        <td key={d} className={draft[`${d}_${u.id}`] ? "changed" : ""}>
                          <select value={v} disabled={saving} aria-label={`${nameOf(u)} ${d}`} onChange={(ev) => setCell(u, d, ev.target.value)}>
                            <option value="">{H.dayOff}</option>
                            {!known && <option value={v}>?</option>}
                            {shifts.filter((s) => s.active || s.id === v).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="rolebar">
          <button type="button" disabled={dirty === 0 || saving} onClick={save}>{H.rosterSave}{dirty > 0 && ` (${dirty})`}</button>
          <button type="button" className="ghost" disabled={dirty === 0 || saving} onClick={() => { setDraft({}); setMsg(""); setErr(""); }}>{H.rosterCancel}</button>
        </div>
        {activeShifts.length === 0 && <p className="warn">{H.shiftsTitle}: {H.seedShifts}</p>}
      </div>

      <ShiftTypes shifts={shifts} />
    </section>
  );
}

function ShiftTypes({ shifts }: { shifts: Shift[] }) {
  const H = useHr();
  const [f, setF] = useState({ name: "", start: "06:00", end: "14:00" });
  const [err, setErr] = useState("");
  const sorted = [...shifts].sort((a, b) => a.start.localeCompare(b.start));
  const valid = f.name.trim() && TIME_RE.test(f.start) && TIME_RE.test(f.end);
  const add = async () => {
    setErr("");
    if (!valid) return setErr(H.badTime);
    await addDoc(collection(db, "shifts"), { name: f.name.trim(), start: f.start, end: f.end, active: true });
    setF({ name: "", start: "06:00", end: "14:00" });
  };
  const seed = async () => { const w = writeBatch(db); SAMPLES.forEach((s) => w.set(doc(collection(db, "shifts")), { ...s, active: true })); await w.commit(); };

  return (
    <div className="card">
      <h3>{H.shiftsTitle}</h3>
      {shifts.length === 0 && <button onClick={seed}>{H.seedShifts}</button>}
      {sorted.map((s) => <ShiftRow key={s.id} s={s} />)}
      <div className="row shiftform">
        <label>{H.shiftName}<input value={f.name} maxLength={40} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label>{H.start}<input value={f.start} maxLength={5} placeholder="06:00" onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
        <label>{H.end}<input value={f.end} maxLength={5} placeholder="14:00" onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
        <button type="button" disabled={!valid} onClick={add}>{H.addShift}</button>
      </div>
      {err && <p className="error">{err}</p>}
    </div>
  );
}

function ShiftRow({ s }: { s: Shift }) {
  const H = useHr();
  const [v, setV] = useState({ name: s.name, start: s.start, end: s.end });
  const dirty = v.name !== s.name || v.start !== s.start || v.end !== s.end;
  const ok = v.name.trim() && TIME_RE.test(v.start) && TIME_RE.test(v.end);
  const over = shiftEnd("2000-01-01", { ...s, start: v.start, end: v.end }).getDate() !== 1 && TIME_RE.test(v.start) && TIME_RE.test(v.end);
  return (
    <div className="row shiftform">
      <label>{H.shiftName}<input value={v.name} maxLength={40} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
      <label>{H.start}<input value={v.start} maxLength={5} onChange={(e) => setV({ ...v, start: e.target.value })} /></label>
      <label>{H.end}<input value={v.end} maxLength={5} onChange={(e) => setV({ ...v, end: e.target.value })} /></label>
      {over && <small>{H.overnight}</small>}
      <label className="check"><input type="checkbox" checked={s.active} onChange={(e) => updateDoc(doc(db, "shifts", s.id), { active: e.target.checked })} /><span>{H.active}</span></label>
      {dirty && <button type="button" disabled={!ok} onClick={() => updateDoc(doc(db, "shifts", s.id), { name: v.name.trim(), start: v.start, end: v.end })}>{H.save}</button>}
      <button type="button" className="ghost danger" onClick={() => confirm(H.sureDeleteShift) && deleteDoc(doc(db, "shifts", s.id))}>{H.delete}</button>
    </div>
  );
}
