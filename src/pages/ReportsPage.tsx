import { useMemo, useState } from "react";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { useMoney } from "../lib/useRate";
import { downloadCsv, lastMonths, monthRange } from "../lib/hr";
import { buildReport, monthlySeries, type RBooking, type RExpense } from "../lib/report";
import type { Room } from "../lib/types";

const pct = (x: number) => `${(x * 100).toFixed(1).replace(/\.0$/, "")}%`;

/** Báo cáo doanh thu (chủ/quản lý): theo tháng hoặc năm — doanh thu, công suất, giá bình quân, theo phòng/nguồn, thu chi, lợi nhuận. */
export default function ReportsPage() {
  const { lang } = useI18n();
  const T = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const { money, moneyText } = useMoney();
  const { data: bookings } = useCollection<RBooking & { id: string }>("bookings");
  const { data: expenses } = useCollection<RExpense & { id: string }>("expenses");
  const { data: rooms } = useCollection<Room>("rooms");
  const months = useMemo(() => lastMonths(24), []);
  const thisYear = new Date().getFullYear();
  const [mode, setMode] = useState<"month" | "year">("month");
  const [month, setMonth] = useState(months[0]);
  const [year, setYear] = useState(thisYear);

  const [from, to] = mode === "month" ? monthRange(month) : [`${year}-01-01`, `${year + 1}-01-01`];
  const rep = useMemo(() => buildReport(bookings, expenses, rooms, from, to), [bookings, expenses, rooms, from, to]);
  const series = useMemo(() => monthlySeries(bookings, expenses, year), [bookings, expenses, year]);
  const maxBar = Math.max(1, ...series.map((m) => Math.max(m.revenue, m.expenses)));
  const maxRoom = Math.max(1, ...rep.rooms.map((r) => r.revenue));

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      [T("Kỳ", "Period"), `${from} → ${to}`], [T("Doanh thu (đã trả phòng)", "Revenue (checked out)"), rep.revenue], [T("Số lượt ở", "Stays"), rep.stays], [T("Đêm đã bán", "Nights sold"), rep.soldNights],
      [T("Giá bình quân / đêm", "ADR"), rep.adr], [T("Công suất", "Occupancy"), pct(rep.occupancy)], [T("Doanh thu dự kiến (chưa trả phòng)", "Expected revenue"), rep.expected],
      [T("Đã thu trong kỳ", "Cash collected"), rep.collected], [T("Chi phí", "Expenses"), rep.expenses], [T("Lợi nhuận", "Profit"), rep.profit], [],
      [T("Phòng", "Room"), T("Doanh thu", "Revenue"), T("Đêm", "Nights"), T("Lượt ở", "Stays")], ...rep.rooms.map((r) => [r.name, r.revenue, r.nights, r.stays]),
    ];
    downloadCsv(`bao-cao-${mode === "month" ? month : year}.csv`, rows);
  };

  return (
    <section>
      <h2>{T("Báo cáo doanh thu", "Revenue report")}</h2>
      <p><small>{T("Doanh thu ghi nhận khi khách trả phòng, theo ngày trả phòng. Công suất = số đêm có khách / (số phòng đang hoạt động × số ngày). Chi phí lấy từ trang Chi phí & công nợ.", "Revenue is recognised at check-out, by check-out date. Occupancy = occupied nights / (active rooms × days). Expenses come from the Expenses page.")}</small></p>
      <div className="card">
        <div className="row between">
          <div className="row">
            <button type="button" className={`seg ${mode === "month" ? "on" : ""}`} aria-pressed={mode === "month"} onClick={() => setMode("month")}>{T("Theo tháng", "By month")}</button>
            <button type="button" className={`seg ${mode === "year" ? "on" : ""}`} aria-pressed={mode === "year"} onClick={() => setMode("year")}>{T("Theo năm", "By year")}</button>
          </div>
          {mode === "month"
            ? <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label={T("Tháng", "Month")}>{months.map((m) => <option key={m} value={m}>{m.slice(5)}/{m.slice(0, 4)}</option>)}</select>
            : <select value={year} onChange={(e) => setYear(+e.target.value)} aria-label={T("Năm", "Year")}>{[thisYear, thisYear - 1, thisYear - 2].map((y) => <option key={y} value={y}>{y}</option>)}</select>}
          <button className="ghost" onClick={exportCsv}>⬇ CSV</button>
        </div>
      </div>

      <div className="grid stats" id="report-kpis">
        <div className="card"><big className="sm">{money(rep.revenue)}</big><div>{T("Doanh thu", "Revenue")}</div></div>
        <div className="card"><big className="sm">{money(rep.profit)}</big><div>{T("Lợi nhuận (sau chi phí)", "Profit")}</div></div>
        <div className="card"><big>{pct(rep.occupancy)}</big><div>{T("Công suất", "Occupancy")}</div></div>
        <div className="card"><big className="sm">{money(rep.adr)}</big><div>{T("Giá bình quân / đêm", "Avg. nightly rate")}</div></div>
        <div className="card"><big>{rep.stays}</big><div>{T("Lượt ở", "Stays")} · {rep.soldNights} {T("đêm", "nights")}</div></div>
        <div className="card"><big>{rep.cancelled}</big><div>{T("Hủy", "Cancelled")} ({pct(rep.cancelRate)})</div></div>
        <div className="card"><big className="sm">{money(rep.collected)}</big><div>{T("Đã thu trong kỳ (tiền vào)", "Cash collected")}</div></div>
        <div className="card"><big className="sm">{money(rep.expenses)}</big><div>{T("Chi phí", "Expenses")}</div></div>
        <div className="card"><big className="sm">{money(rep.expected)}</big><div>{T("Dự kiến (chưa trả phòng)", "Expected (not checked out)")}</div></div>
        <div className="card"><big className="sm">{money(rep.receivable)}</big><div>{T("Còn phải thu (mọi kỳ)", "Receivable (all time)")}</div></div>
      </div>

      {mode === "year" && (
        <div className="card" id="report-year">
          <h3>{T("Doanh thu và chi phí theo tháng", "Revenue and expenses by month")} {year}</h3>
          <svg viewBox="0 0 720 200" className="barchart" role="img" aria-label={T("Biểu đồ cột doanh thu và chi phí theo tháng", "Monthly revenue and expenses chart")}>
            {series.map((m, i) => {
              const x = 14 + i * 58, h = (v: number) => (v / maxBar) * 150;
              return (
                <g key={m.ym}>
                  <rect x={x} y={170 - h(m.revenue)} width="22" height={h(m.revenue)} rx="3" className="bar-rev"><title>{`${m.ym}: ${moneyText(m.revenue)}`}</title></rect>
                  <rect x={x + 24} y={170 - h(m.expenses)} width="22" height={h(m.expenses)} rx="3" className="bar-exp"><title>{`${m.ym}: ${T("chi phí", "expenses")} ${moneyText(m.expenses)}`}</title></rect>
                  <text x={x + 23} y="188" textAnchor="middle" className="bar-lbl">{m.ym.slice(5)}</text>
                </g>
              );
            })}
          </svg>
          <small><span className="legend-dot rev" /> {T("Doanh thu", "Revenue")} · <span className="legend-dot exp" /> {T("Chi phí", "Expenses")}</small>
        </div>
      )}

      <div className="card" id="report-rooms">
        <h3>{T("Theo phòng", "By room")}</h3>
        {rep.rooms.map((r) => (
          <div key={r.roomId} className="roombar">
            <span>{r.name}</span>
            <div className="bartrack"><div className="barfill" style={{ width: `${(r.revenue / maxRoom) * 100}%` }} /></div>
            <b>{money(r.revenue)}</b>
            <small>{r.nights} {T("đêm", "nights")} · {r.stays} {T("lượt", "stays")}</small>
          </div>
        ))}
        <h4 className="sub">{T("Theo nguồn đặt", "By source")}</h4>
        <div>{T("Khách tự đặt online", "Online")}: <b>{money(rep.online.revenue)}</b> ({rep.online.stays}) · {T("Nhân viên nhập", "Staff-entered")}: <b>{money(rep.staff.revenue)}</b> ({rep.staff.stays})</div>
      </div>
    </section>
  );
}
