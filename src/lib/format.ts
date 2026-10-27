export const DEFAULT_USD_RATE = 25000;

export function formatVnd(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(n)) + " VNĐ";
}

/** "2026-10-27" → "27/10/2026" (hiển thị thống nhất toàn trang; dữ liệu vẫn lưu dạng yyyy-mm-dd). */
export function fmtDate(s: string | undefined | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s ?? "";
}

/** "1.500.000 VNĐ (≈ $60)" — kèm quy đổi USD để khách nước ngoài dễ hiểu. */
export function usdText(vnd: number, usdRate = DEFAULT_USD_RATE): string {
  const usd = vnd / (usdRate || DEFAULT_USD_RATE);
  return `≈ $${new Intl.NumberFormat("en-US", { maximumFractionDigits: usd < 100 ? 1 : 0 }).format(usd)}`;
}

export function formatMoney(vnd: number, usdRate = DEFAULT_USD_RATE): string {
  return `${formatVnd(vnd)} (${usdText(vnd, usdRate)})`;
}

export const todayStr = () => toDateStr(new Date());

export function toDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(s: string, n: number): string {
  const d = new Date(s + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function nightsBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);
}

/** Khoảng [in, out) giao nhau: ngày trả phòng cũng là ngày có thể nhận phòng mới. */
export function overlaps(aIn: string, aOut: string, bIn: string, bOut: string): boolean {
  return aIn < bOut && bIn < aOut;
}

/** So khớp tên không phân biệt hoa thường, dấu và khoảng trắng thừa. */
export const normName = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d").replace(/\s+/g, " ").trim();

/** Chuẩn hóa số giấy tờ: bỏ khoảng trắng, dấu chấm, gạch ngang; viết hoa. */
export const normDocNumber = (s: string) => s.replace(/[\s.-]/g, "").toUpperCase();
