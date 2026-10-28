import { useI18n } from "./index";
import type { BookingCfg } from "../lib/pricing";

const vi = {
  breakdown: "Chi tiết giá", total: "Tổng cộng", deposit: "Tiền cọc", depositNote: "chuyển khoản để giữ phòng", balance: "Còn lại", paid: "Đã thanh toán", dueAtArrival: "thanh toán khi nhận phòng",
  addons: "Dịch vụ đi kèm", addonsHint: "Chọn số lượng nếu cần; tiền được cộng vào hóa đơn.", perNight: "/ đêm", perUse: "/ lượt", early: "Nhận phòng sớm", late: "Trả phòng muộn", fee: "phụ thu",
  policy: "Giờ nhận/trả phòng & chính sách hủy", checkInFrom: "Nhận phòng từ {t}", checkOutBefore: "Trả phòng trước {t}",
  refundTier: "Hủy trước ít nhất {d} ngày: hoàn {p}% tiền đã cọc", refundNone: "Hủy sát ngày nhận phòng hoặc không đến: không hoàn cọc", refundLate: "Hủy sát ngày nhận phòng: hoàn {p}% tiền đã cọc", refundAlways: "Hủy bất kỳ lúc nào: hoàn {p}% tiền đã cọc",
  extraGuestNote: "Vượt {n} khách/phòng: phụ thu {f} / người / đêm",
  payTitle: "Chuyển khoản đặt cọc", payScan: "Quét mã bằng app ngân hàng; số tiền và nội dung đã điền sẵn.", payBank: "Ngân hàng", payAccount: "Số tài khoản", payHolder: "Chủ tài khoản", payAmount: "Số tiền cọc", payContent: "Nội dung chuyển khoản",
  qrFail: "Không tải được mã QR. Bạn vẫn có thể chuyển khoản theo thông tin bên dưới.", copy: "Sao chép", copied: "Đã chép", payNote: "Giữ nguyên nội dung chuyển khoản để nhân viên đối soát. Sau khi nhận được cọc, homestay sẽ xác nhận đặt phòng.", noBank: "Homestay chưa thiết lập tài khoản nhận cọc; nhân viên sẽ liên hệ hướng dẫn thanh toán.",
  bookingCode: "Mã đặt phòng", payNow: "Thanh toán cọc", depositReceived: "Đã nhận cọc", depositDue: "Cần cọc", refundDue: "Hoàn lại theo chính sách",
  invoice: "Hóa đơn", invoiceNo: "Hóa đơn / Phiếu thu", print: "In / Lưu PDF", back: "Quay lại",
};
const en: typeof vi = {
  breakdown: "Price details", total: "Total", deposit: "Deposit", depositNote: "bank transfer to hold the room", balance: "Balance", paid: "Paid", dueAtArrival: "payable on arrival",
  addons: "Add-on services", addonsHint: "Pick quantities if you need them; the cost is added to your bill.", perNight: "/ night", perUse: "/ use", early: "Early check-in", late: "Late check-out", fee: "surcharge",
  policy: "Check-in/out times & cancellation policy", checkInFrom: "Check-in from {t}", checkOutBefore: "Check-out before {t}",
  refundTier: "Cancel at least {d} days before: {p}% of the deposit refunded", refundNone: "Cancel closer to arrival or no-show: deposit not refunded", refundLate: "Cancel close to arrival: {p}% of the deposit refunded", refundAlways: "Cancel any time: {p}% of the deposit refunded",
  extraGuestNote: "Above {n} guests per room: {f} / person / night",
  payTitle: "Pay the deposit by bank transfer", payScan: "Scan with your banking app; amount and note are pre-filled.", payBank: "Bank", payAccount: "Account number", payHolder: "Account holder", payAmount: "Deposit amount", payContent: "Transfer note",
  qrFail: "The QR code could not be loaded. You can still transfer using the details below.", copy: "Copy", copied: "Copied", payNote: "Keep the transfer note unchanged so staff can match your payment. Once the deposit is received the homestay will confirm your booking.", noBank: "The homestay has not set up a deposit account yet; staff will contact you with payment instructions.",
  bookingCode: "Booking code", payNow: "Pay deposit", depositReceived: "Deposit received", depositDue: "Deposit due", refundDue: "Refund per policy",
  invoice: "Invoice", invoiceNo: "Invoice / Receipt", print: "Print / Save PDF", back: "Back",
};
export type PricingText = typeof vi;
export const fillP = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
export function useP() { const { lang } = useI18n(); return lang === "vi" ? vi : en; }

/** Các dòng chính sách (giờ nhận/trả phòng, hoàn cọc) từ cấu hình; dùng ở hộp thoại đặt phòng, Tài khoản và trang web. */
export function policyLines(P: PricingText, cfg: BookingCfg, fmtMoney: (n: number) => string, baseGuests?: number): string[] {
  const out = [fillP(P.checkInFrom, { t: cfg.checkInTime }) + " · " + fillP(P.checkOutBefore, { t: cfg.checkOutTime })];
  if (cfg.depositPercent > 0) {
    const tiers = [...cfg.cancelTiers].sort((a, b) => b.daysBefore - a.daysBefore);
    if (tiers.length === 1 && tiers[0].daysBefore === 0) out.push(fillP(P.refundAlways, { p: tiers[0].refundPercent }));
    else {
      for (const t of tiers) if (t.daysBefore > 0) out.push(fillP(P.refundTier, { d: t.daysBefore, p: t.refundPercent }));
      if (!tiers.some((t) => t.daysBefore === 0)) out.push(P.refundNone);
      else { const z = tiers.find((t) => t.daysBefore === 0)!; out.push(z.refundPercent === 0 ? P.refundNone : fillP(P.refundLate, { p: z.refundPercent })); }
    }
  }
  if (cfg.extraGuestFee > 0 && baseGuests) out.push(fillP(P.extraGuestNote, { n: baseGuests, f: fmtMoney(cfg.extraGuestFee) }));
  if (cfg.cancelNote.trim()) out.push(cfg.cancelNote.trim());
  return out;
}
