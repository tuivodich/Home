import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { fmtDate, todayStr } from "../lib/format";
import { FORGOT_HOURS, addDaysStr, fmtClock, fmtHours, lateMinutes, useQueryDocs, workedMs, type Att, type ScheduleEntry, type Shift } from "../lib/hr";
import { fill, useHr } from "../i18n/hr";

/** Trang chấm công của mỗi nhân viên: bấm Vào ca / Ra ca, xem ca hôm nay, lịch 7 ngày tới và các lượt gần đây. */
export default function Attendance() {
  const H = useHr();
  const { user, profile } = useAuth();
  const uid = user?.uid ?? "";
  const today = todayStr();
  const [tick, setTick] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { const i = setInterval(() => setTick(Date.now()), 30000); return () => clearInterval(i); }, []);

  const { data: shifts } = useCollection<Shift>("shifts");
  // Lượt của tôi (truy vấn theo uid; lọc/sắp xếp ở máy vì số lượng nhỏ) và lịch ca 7 ngày tới (lọc theo ngày, rồi theo uid ở máy).
  const mine = useQueryDocs<Att>(uid ? query(collection(db, "attendance"), where("uid", "==", uid)) : null, `att:${uid}`);
  const from = addDaysStr(today, -21), to = addDaysStr(today, 7);
  const sched = useQueryDocs<ScheduleEntry>(uid ? query(collection(db, "schedule"), where("date", ">=", from), where("date", "<=", to)) : null, `sch:${uid}:${today}`);

  const records = useMemo(() => [...mine.data].sort((a, b) => b.in.toMillis() - a.in.toMillis()), [mine.data]);
  const open = records.find((r) => !r.out);
  const openAgeH = open ? (tick - open.in.toMillis()) / 3600000 : 0;
  const forgot = !!open && openAgeH > FORGOT_HOURS;
  const working = !!open && !forgot;
  const shiftOf = (id: string) => shifts.find((s) => s.id === id);
  const myAll = sched.data.filter((e) => e.uid === uid);
  const myDays = myAll.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const todaysShift = shiftOf(myAll.find((e) => e.date === today)?.shiftId ?? "");

  const run = async (f: () => Promise<unknown>) => {
    setBusy(true); setErr("");
    try { await f(); } catch (ex) { console.error("attendance", ex); setErr(H.failed); } finally { setBusy(false); }
  };
  const clockIn = () => run(() => addDoc(collection(db, "attendance"), {
    uid, name: profile?.name || user?.displayName || user?.email || "", date: today, in: serverTimestamp(), source: "self",
  }));
  const clockOut = () => open && confirm(H.sureOut) && run(() => updateDoc(doc(db, "attendance", open.id), { out: serverTimestamp() }));

  const lateOf = (a: Att) => lateMinutes(a, shiftOf(myAll.find((e) => e.date === a.date)?.shiftId ?? ""));

  return (
    <section>
      <h2>{H.attendance}</h2>
      <div className="card clockcard">
        {working ? (
          <>
            <div className="clockbig">{fmtClock(open!.in.toDate())}</div>
            <div>{H.working} <b>{fmtClock(open!.in.toDate())}</b> · {fmtHours(tick - open!.in.toMillis())}</div>
            <button className="clockbtn out" disabled={busy} onClick={clockOut}>{H.clockOut}</button>
          </>
        ) : (
          <>
            <div className="clockbig">{fmtClock(new Date(tick))}</div>
            <div>{H.notWorking}</div>
            <button className="clockbtn" disabled={busy} onClick={clockIn}>{H.clockIn}</button>
          </>
        )}
        {forgot && <p className="warn">⚠ {fill(H.forgot, { d: fmtDate(open!.date) })}</p>}
        {err && <p className="error">{err}</p>}
        <div className="clockshift">
          <small>{H.todayShift}: </small>
          {todaysShift
            ? <b>{todaysShift.name} {todaysShift.start}–{todaysShift.end}</b>
            : <span>{H.noShiftToday}</span>}
          {todaysShift && open && !forgot && open.date === today && (() => {
            const m = lateMinutes(open, todaysShift);
            return <span className={m ? "overdue" : ""}> · {m ? fill(H.late, { m }) : H.onTime}</span>;
          })()}
        </div>
      </div>

      <div className="card">
        <h3>{H.mySchedule}</h3>
        {myDays.length === 0 && <p>{H.noSchedule}</p>}
        {myDays.map((e) => {
          const s = shiftOf(e.shiftId);
          return <div key={e.id} className="row between"><span>{fmtDate(e.date)}{e.date === today ? " (•)" : ""}</span><span>{s ? `${s.name} ${s.start}–${s.end}` : "?"}</span></div>;
        })}
      </div>

      <div className="card">
        <h3>{H.myHistory}</h3>
        {records.length === 0 && <p>{H.noRecords}</p>}
        {records.slice(0, 20).map((r) => {
          const m = lateOf(r);
          return (
            <div key={r.id} className="row between">
              <span>{fmtDate(r.date)} · {fmtClock(r.in.toDate())} → {r.out ? fmtClock(r.out.toDate()) : H.notOut}</span>
              <span>{r.out ? fmtHours(workedMs(r)) : ""}{m ? <span className="overdue"> · {fill(H.late, { m })}</span> : ""}{r.source === "admin" ? <small> · {H.adminEdited}</small> : ""}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
