/** Báo cáo doanh thu: thuần tính toán (kiểm thử ở scripts/report.test.mts). Doanh thu ghi nhận khi trả phòng, theo ngày trả phòng.
 *  Tiền cọc bị giữ (đặt phòng đã hủy / khách không đến mà còn tiền đã thu sau khi hoàn) tính riêng là "cọc giữ lại", ghi nhận theo ngày hủy
 *  (không có ngày hủy thì theo ngày nhận phòng) và cộng vào lợi nhuận. */
export interface RBooking {
  id: string; roomId: string; checkIn: string; checkOut: string; status: string; total: number; source?: string; paid?: number; cancelledAt?: { toMillis(): number };
  payLog?: { amount: number; at: { toMillis(): number } }[];
}
export interface RExpense { date: string; amount: number; category: string; paid: boolean }
export interface RRoom { id: string; name: string; status?: string }

const dayMs = 86400000;
export const nightsBetweenYmd = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / dayMs);
/** Ngày (địa phương) ghi nhận khoản cọc giữ lại của đặt phòng đã hủy. */
export function forfeitDate(b: RBooking): string {
  if (!b.cancelledAt) return b.checkIn;
  const d = new Date(b.cancelledAt.toMillis());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Số tiền cọc giữ lại: tiền còn lại của đặt phòng đã hủy (sau khi đã ghi nhận hoàn tiền). */
export const forfeitedAmount = (b: RBooking) => (b.status === "cancelled" ? Math.max(0, b.paid ?? 0) : 0);
const maxS = (a: string, b: string) => (a > b ? a : b);
const minS = (a: string, b: string) => (a < b ? a : b);
/** Số đêm của [in, out) nằm trong [from, to). */
export const overlapNights = (inD: string, outD: string, from: string, to: string) => Math.max(0, nightsBetweenYmd(maxS(inD, from), minS(outD, to)));

export interface RoomRow { roomId: string; name: string; revenue: number; nights: number; stays: number }
export interface Report {
  from: string; to: string; days: number;
  revenue: number; forfeited: number; forfeitedCount: number; stays: number; soldNights: number; adr: number;
  expected: number; cancelled: number; cancelRate: number;
  occupiedNights: number; occupancy: number;
  online: { revenue: number; stays: number }; staff: { revenue: number; stays: number };
  rooms: RoomRow[]; collected: number; expenses: number; profit: number; unpaidExpenses: number;
  receivable: number;
}

export function buildReport(bookings: RBooking[], expenses: RExpense[], rooms: RRoom[], from: string, to: string): Report {
  const days = nightsBetweenYmd(from, to);
  const done = bookings.filter((b) => b.status === "checked_out" && b.checkOut >= from && b.checkOut < to);
  const forf = bookings.filter((b) => forfeitedAmount(b) > 0 && forfeitDate(b) >= from && forfeitDate(b) < to);
  const forfeited = forf.reduce((s, b) => s + forfeitedAmount(b), 0);
  const revenue = done.reduce((s, b) => s + (b.total || 0), 0);
  const soldNights = done.reduce((s, b) => s + Math.max(0, nightsBetweenYmd(b.checkIn, b.checkOut)), 0);
  const expected = bookings.filter((b) => ["confirmed", "checked_in"].includes(b.status) && b.checkOut >= from && b.checkOut < to).reduce((s, b) => s + (b.total || 0), 0);
  const cancelled = bookings.filter((b) => b.status === "cancelled" && b.checkIn >= from && b.checkIn < to).length;
  const attempted = bookings.filter((b) => b.checkIn >= from && b.checkIn < to).length;
  const occupiedNights = bookings.filter((b) => ["checked_in", "checked_out"].includes(b.status)).reduce((s, b) => s + overlapNights(b.checkIn, b.checkOut, from, to), 0);
  const active = rooms.filter((r) => r.status !== "maintenance").length;
  const rowFor = (id: string): RoomRow => ({ roomId: id, name: rooms.find((r) => r.id === id)?.name ?? "?", revenue: 0, nights: 0, stays: 0 });
  const map = new Map<string, RoomRow>();
  for (const b of done) { const r = map.get(b.roomId) ?? rowFor(b.roomId); r.revenue += b.total || 0; r.nights += Math.max(0, nightsBetweenYmd(b.checkIn, b.checkOut)); r.stays++; map.set(b.roomId, r); }
  for (const r of rooms) if (!map.has(r.id)) map.set(r.id, rowFor(r.id));
  const src = (s: string) => { const l = done.filter((b) => (b.source ?? "staff") === s); return { revenue: l.reduce((t, b) => t + (b.total || 0), 0), stays: l.length }; };
  const fromMs = new Date(`${from}T00:00:00`).getTime(), toMs = new Date(`${to}T00:00:00`).getTime();
  const collected = bookings.reduce((s, b) => s + (b.payLog ?? []).filter((p) => p.at.toMillis() >= fromMs && p.at.toMillis() < toMs).reduce((t, p) => t + p.amount, 0), 0);
  const exp = expenses.filter((e) => e.date >= from && e.date < to);
  const expTotal = exp.reduce((s, e) => s + (e.amount || 0), 0);
  const receivable = bookings.filter((b) => ["confirmed", "checked_in", "checked_out"].includes(b.status)).reduce((s, b) => s + Math.max(0, (b.total || 0) - (b.paid ?? 0)), 0);
  return {
    from, to, days, revenue, forfeited, forfeitedCount: forf.length, stays: done.length, soldNights, adr: soldNights ? Math.round(revenue / soldNights) : 0, expected, cancelled, cancelRate: attempted ? cancelled / attempted : 0,
    occupiedNights, occupancy: active && days ? occupiedNights / (active * days) : 0, online: src("online"), staff: src("staff"),
    rooms: [...map.values()].sort((a, b) => b.revenue - a.revenue), collected, expenses: expTotal, profit: revenue + forfeited - expTotal,
    unpaidExpenses: exp.filter((e) => !e.paid).reduce((s, e) => s + (e.amount || 0), 0), receivable,
  };
}

/** 12 tháng của một năm: doanh thu, chi phí. */
export function monthlySeries(bookings: RBooking[], expenses: RExpense[], year: number) {
  return Array.from({ length: 12 }, (_, m) => {
    const ym = `${year}-${String(m + 1).padStart(2, "0")}`;
    const rev = bookings.filter((b) => b.status === "checked_out" && b.checkOut.startsWith(ym)).reduce((s, b) => s + (b.total || 0), 0);
    const exp = expenses.filter((e) => e.date.startsWith(ym)).reduce((s, e) => s + (e.amount || 0), 0);
    const forfeited = bookings.filter((b) => forfeitedAmount(b) > 0 && forfeitDate(b).startsWith(ym)).reduce((s, b) => s + forfeitedAmount(b), 0);
    return { ym, revenue: rev, forfeited, expenses: exp };
  });
}
