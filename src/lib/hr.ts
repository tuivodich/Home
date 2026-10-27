import { useEffect, useState } from "react";
import { onSnapshot, type Query, type Timestamp } from "firebase/firestore";

/** Danh mục ca làm: giờ dạng "HH:MM"; ca qua đêm có giờ kết thúc nhỏ hơn hoặc bằng giờ bắt đầu (vd 22:00–06:00). */
export interface Shift { id: string; name: string; start: string; end: string; active: boolean }
/** Lịch ca: mỗi nhân viên một ca mỗi ngày, id = yyyy-mm-dd_uid. */
export interface ScheduleEntry { id: string; date: string; uid: string; name: string; shiftId: string }
/** Một lượt chấm công: vào ca (giờ máy chủ) và ra ca; `source` "admin" nếu chủ/quản lý nhập hoặc sửa. */
export interface Att { id: string; uid: string; name: string; date: string; in: Timestamp; out?: Timestamp; source: "self" | "admin"; editedBy?: string }

/** Vào ca trễ quá số phút này so với giờ bắt đầu ca thì tính là đi muộn. */
export const GRACE_MIN = 10;
/** Lượt chưa ra ca quá số giờ này coi là quên ra ca (cho phép vào ca mới, báo quản lý sửa). */
export const FORGOT_HOURS = 16;

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const at = (date: string, hhmm: string) => { const d = new Date(`${date}T00:00:00`); d.setMinutes(toMin(hhmm)); return d; };

export const shiftStart = (date: string, s: Shift) => at(date, s.start);
export function shiftEnd(date: string, s: Shift) {
  const e = at(date, s.end);
  if (toMin(s.end) <= toMin(s.start)) e.setDate(e.getDate() + 1); // ca qua đêm
  return e;
}

/** Số phút vào ca muộn so với giờ bắt đầu ca (0 nếu đúng giờ hoặc trong thời gian châm chước). */
export function lateMinutes(a: Pick<Att, "in" | "date">, shift?: Shift): number {
  if (!shift) return 0;
  const m = Math.floor((a.in.toMillis() - shiftStart(a.date, shift).getTime()) / 60000);
  return m > GRACE_MIN ? m : 0;
}

export const workedMs = (a: Pick<Att, "in" | "out">) => (a.out ? Math.max(0, a.out.toMillis() - a.in.toMillis()) : 0);
export const fmtHours = (ms: number) => { const m = Math.round(ms / 60000); return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`; };
export const fmtClock = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
/** Timestamp ↔ giá trị ô datetime-local (giờ máy người dùng). */
export const toLocalInput = (t: Date) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}T${fmtClock(t)}`;
export const dateOf = (t: Date) => toLocalInput(t).slice(0, 10);

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDaysStr = (s: string, n: number) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() + n); return ymd(d); };
/** Thứ Hai của tuần chứa ngày s. */
export const mondayOf = (s: string) => { const d = new Date(`${s}T00:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };
export const weekOf = (monday: string) => Array.from({ length: 7 }, (_, i) => addDaysStr(monday, i));
/** Khoảng [từ, đến) theo ngày của tháng "yyyy-mm". */
export function monthRange(ym: string): [string, string] {
  const [y, m] = ym.split("-").map(Number);
  return [`${ym}-01`, ymd(new Date(y, m, 1))];
}
export const monthOf = (s: string) => s.slice(0, 7);
export function lastMonths(count: number, from = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => { const d = new Date(from.getFullYear(), from.getMonth() - i, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; });
}

/** Nghe một truy vấn Firestore; `q` null thì không nghe. Tài liệu trả về kèm id. */
export function useQueryDocs<T extends { id: string }>(q: Query | null, key: string) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!q) { setData([]); setLoading(false); return; }
    setLoading(true);
    // serverTimestamps "estimate": giờ máy chủ chưa về (vừa bấm Vào ca) thì tạm dùng ước lượng thay vì null.
    return onSnapshot(q, (snap) => { setData(snap.docs.map((d) => ({ ...(d.data({ serverTimestamps: "estimate" }) as object), id: d.id }) as T)); setLoading(false); },
      (err) => { console.error("query", key, err); setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, loading };
}

/** Xuất CSV mở được bằng Excel (có BOM UTF-8 để không lỗi tiếng Việt). */
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const blob = new Blob(["﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
