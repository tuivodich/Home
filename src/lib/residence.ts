/** Danh sách khai báo lưu trú: gom hồ sơ khách (giấy tờ) với đặt phòng/phòng trong một khoảng ngày để xuất file hoặc in. Thuần tính toán, có kiểm thử. */

export interface ResGuest { id: string; fullName: string; docType: string; docNumber: string; nationality: string; dob: string; phone: string; bookingId: string }
export interface ResBooking { id: string; roomId: string; checkIn: string; checkOut: string; status: string; code?: string }
export interface ResRoom { id: string; name: string }

export interface ResRow {
  guestId: string; bookingId: string; fullName: string; dob: string; docType: string; docNumber: string; nationality: string; foreign: boolean;
  phone: string; room: string; checkIn: string; checkOut: string; status: string; missing: string[];
}

const STAYING = ["confirmed", "checked_in", "checked_out"];
const bookingCode = (id: string) => id.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();

/** Người nước ngoài: quốc tịch có nhập và khác Việt Nam (nhận cả "Vietnam", "Việt Nam", "VN"). */
export function isForeign(nationality: string): boolean {
  const n = nationality.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/[^a-z]/g, "");
  return !!n && !["vietnam", "vietnamese", "vn", "vnm"].includes(n);
}

/**
 * Khách có thời gian lưu trú giao với [from, to] (cả hai đầu, yyyy-mm-dd): nhận phòng ≤ to và trả phòng ≥ from.
 * Chỉ tính đặt phòng đã xác nhận / đang ở / đã trả; sắp theo ngày nhận rồi họ tên. `missing` liệt kê trường còn thiếu cần bổ sung trước khi khai báo.
 */
export function buildResidence(guests: ResGuest[], bookings: ResBooking[], rooms: ResRoom[], from: string, to: string): ResRow[] {
  const byBooking = new Map(bookings.map((b) => [b.id, b]));
  const roomName = new Map(rooms.map((r) => [r.id, r.name]));
  const rows: ResRow[] = [];
  for (const g of guests) {
    const b = byBooking.get(g.bookingId);
    if (!b || !STAYING.includes(b.status) || b.checkIn > to || b.checkOut < from) continue;
    const missing: string[] = [];
    if (!g.fullName.trim()) missing.push("fullName");
    if (!g.docNumber.trim()) missing.push("docNumber");
    if (!g.dob) missing.push("dob");
    if (!g.nationality.trim()) missing.push("nationality");
    rows.push({
      guestId: g.id, bookingId: b.id, fullName: g.fullName.trim(), dob: g.dob, docType: g.docType, docNumber: g.docNumber.trim(), nationality: g.nationality.trim(),
      foreign: isForeign(g.nationality), phone: g.phone.trim(), room: roomName.get(b.roomId) ?? "?", checkIn: b.checkIn, checkOut: b.checkOut, status: b.status, missing,
    });
  }
  return rows.sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.room.localeCompare(b.room, "vi", { numeric: true }) || a.fullName.localeCompare(b.fullName, "vi"));
}

const dmy = (s: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : s ?? ""; };
/** Excel hiểu số giấy tờ/điện thoại là số và cắt số 0 đầu; ="…" ép thành chữ. */
const asText = (s: string) => (s ? `="${s.replace(/"/g, "")}"` : "");

export interface ResLabels { head: string[]; docType: (t: string) => string; foreign: string; local: string }

/** Bảng CSV: STT, họ tên, ngày sinh, loại + số giấy tờ, quốc tịch, điện thoại, phòng, ngày đến, ngày đi, mã đặt phòng, ghi chú. */
export function residenceCsv(rows: ResRow[], L: ResLabels): (string | number)[][] {
  return [L.head, ...rows.map((r, i) => [i + 1, r.fullName, dmy(r.dob), L.docType(r.docType), asText(r.docNumber), r.nationality, r.foreign ? L.foreign : L.local, asText(r.phone), r.room, dmy(r.checkIn), dmy(r.checkOut), bookingCode(r.bookingId)])];
}
