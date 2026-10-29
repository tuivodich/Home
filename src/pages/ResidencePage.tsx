import { useMemo, useState } from "react";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { addDays, fmtDate, todayStr } from "../lib/format";
import { downloadCsv } from "../lib/hr";
import { buildResidence, residenceCsv, type ResBooking } from "../lib/residence";
import DateInput from "../components/DateInput";
import type { Booking, Guest, Room } from "../lib/types";

/** Khách hàng → Khai báo lưu trú: danh sách khách (giấy tờ) đang/đã lưu trú trong một khoảng ngày để khai báo tạm trú; tải CSV (mở bằng Excel) hoặc in. */
export default function ResidencePage() {
  const { t, lang } = useI18n();
  const T = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const { data: guests } = useCollection<Guest>("guests");
  const { data: bookings } = useCollection<Booking>("bookings");
  const { data: rooms } = useCollection<Room>("rooms");
  const today = todayStr();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [off, setOff] = useState<Set<string>>(new Set()); // khách bỏ chọn

  const rows = useMemo(() => buildResidence(guests, bookings as ResBooking[], rooms, from, to), [guests, bookings, rooms, from, to]);
  const chosen = rows.filter((r) => !off.has(r.guestId));
  const foreign = chosen.filter((r) => r.foreign).length;
  const incomplete = chosen.filter((r) => r.missing.length).length;
  const bad = from > to;
  const colLabel = (k: string) => ({ fullName: T("họ tên", "name"), docNumber: T("số giấy tờ", "document no."), dob: T("ngày sinh", "date of birth"), nationality: T("quốc tịch", "nationality") } as Record<string, string>)[k] ?? k;

  const preset = (a: string, b: string) => { setFrom(a); setTo(b); setOff(new Set()); };
  const toggle = (id: string) => setOff((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const exportCsv = () => downloadCsv(`khai-bao-luu-tru-${from}_${to}.csv`, residenceCsv(chosen, {
    head: [T("STT", "No."), T("Họ và tên", "Full name"), T("Ngày sinh", "Date of birth"), T("Loại giấy tờ", "Document type"), T("Số giấy tờ", "Document number"), T("Quốc tịch", "Nationality"), T("Đối tượng", "Category"), T("Điện thoại", "Phone"), T("Phòng", "Room"), T("Ngày đến", "Arrival"), T("Ngày đi", "Departure"), T("Mã đặt phòng", "Booking code")],
    docType: (d) => t(d as "cccd"), foreign: T("Người nước ngoài", "Foreigner"), local: T("Công dân Việt Nam", "Vietnamese citizen"),
  }));

  return (
    <section className="residence">
      <h2>{T("Khai báo lưu trú", "Guest registration list")}</h2>
      <p className="no-print"><small>{T("Danh sách khách có hồ sơ giấy tờ và thời gian lưu trú giao với khoảng ngày bạn chọn, để nhập vào cổng khai báo lưu trú của địa phương hoặc nộp cho công an phường/xã. Mẫu và thời hạn khai báo khác nhau tùy địa phương và đối tượng (công dân Việt Nam / người nước ngoài) — hãy kiểm tra với cơ quan quản lý. Giới tính chưa có trong hồ sơ khách; điền thêm khi khai báo nếu mẫu yêu cầu.", "Guests with an ID record whose stay overlaps the chosen dates, ready to enter into the local registration portal or hand to the ward police. Forms and deadlines differ by locality and by guest type — check with the authority. Gender is not stored in guest records; add it when the form needs it.")}</small></p>
      <div className="card no-print">
        <div className="row">
          <label>{T("Từ ngày", "From")}<DateInput value={from} onChange={(v) => preset(v, v > to ? v : to)} /></label>
          <label>{T("Đến ngày", "To")}<DateInput value={to} min={from} onChange={(v) => { setTo(v); setOff(new Set()); }} /></label>
        </div>
        <div className="row">
          <button type="button" className="ghost" onClick={() => preset(today, today)}>{T("Hôm nay", "Today")}</button>
          <button type="button" className="ghost" onClick={() => preset(addDays(today, -1), addDays(today, -1))}>{T("Hôm qua", "Yesterday")}</button>
          <button type="button" className="ghost" onClick={() => preset(addDays(today, -6), today)}>{T("7 ngày qua", "Last 7 days")}</button>
          <button type="button" className="ghost" onClick={() => preset(today, addDays(today, 7))}>{T("7 ngày tới", "Next 7 days")}</button>
        </div>
        {bad && <p className="error">{T("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.", "The start date must not be after the end date.")}</p>}
      </div>

      <div className="card">
        <div className="row between no-print">
          <strong>{chosen.length} {T("khách", "guests")} · {foreign} {T("người nước ngoài", "foreigners")}{incomplete > 0 && <span className="overdue"> · {incomplete} {T("hồ sơ còn thiếu thông tin", "incomplete records")}</span>}</strong>
          <span className="row">
            <button type="button" disabled={!chosen.length} onClick={exportCsv}>⬇ {T("Tải CSV (Excel)", "Download CSV (Excel)")}</button>
            <button type="button" className="ghost" disabled={!chosen.length} onClick={() => window.print()}>🖨 {T("In", "Print")}</button>
          </span>
        </div>
        <p className="print-only">{T("Danh sách khai báo lưu trú", "Guest registration list")}: {fmtDate(from)} – {fmtDate(to)}</p>
        {rows.length === 0 ? <p>{T("Không có khách nào trong khoảng ngày này.", "No guests in this date range.")}</p> : (
          <div className="rostscroll">
            <table className="rosttbl restbl">
              <thead><tr><th className="no-print" /><th>#</th><th>{T("Họ và tên", "Full name")}</th><th>{T("Ngày sinh", "Born")}</th><th>{T("Giấy tờ", "Document")}</th><th>{T("Quốc tịch", "Nationality")}</th><th>{T("Điện thoại", "Phone")}</th><th>{T("Phòng", "Room")}</th><th>{T("Đến", "In")}</th><th>{T("Đi", "Out")}</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.guestId} className={`${off.has(r.guestId) ? "off no-print" : ""}${r.missing.length ? " warnrow" : ""}`}>
                    <td className="no-print"><input type="checkbox" checked={!off.has(r.guestId)} onChange={() => toggle(r.guestId)} aria-label={r.fullName} /></td>
                    <td>{i + 1}</td>
                    <td>{r.fullName}{r.missing.length > 0 && <small className="overdue"> ⚠ {T("thiếu", "missing")}: {r.missing.map(colLabel).join(", ")}</small>}</td>
                    <td>{fmtDate(r.dob)}</td>
                    <td>{t(r.docType as "cccd")}: {r.docNumber}</td>
                    <td>{r.nationality}{r.foreign && " 🌐"}</td>
                    <td>{r.phone}</td>
                    <td>{r.room}</td>
                    <td>{fmtDate(r.checkIn)}</td>
                    <td>{fmtDate(r.checkOut)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
