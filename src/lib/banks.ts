/** Ngân hàng phổ biến (mã BIN theo NAPAS) để tạo mã VietQR chuyển khoản. Ngân hàng khác: nhập tay mã BIN 6 số. */
export const BANKS: { bin: string; name: string }[] = [
  { bin: "970436", name: "Vietcombank (VCB)" }, { bin: "970415", name: "VietinBank (CTG)" }, { bin: "970418", name: "BIDV" },
  { bin: "970405", name: "Agribank" }, { bin: "970407", name: "Techcombank (TCB)" }, { bin: "970422", name: "MB Bank" },
  { bin: "970416", name: "ACB" }, { bin: "970432", name: "VPBank" }, { bin: "970423", name: "TPBank" },
  { bin: "970403", name: "Sacombank (STB)" }, { bin: "970437", name: "HDBank" }, { bin: "970441", name: "VIB" },
  { bin: "970443", name: "SHB" }, { bin: "970448", name: "OCB" }, { bin: "970426", name: "MSB" },
  { bin: "970440", name: "SeABank" }, { bin: "970431", name: "Eximbank" }, { bin: "970449", name: "LPBank" },
];

export interface Bank { bankBin: string; bankName: string; accountNo: string; accountName: string }
export const EMPTY_BANK: Bank = { bankBin: "", bankName: "", accountNo: "", accountName: "" };

/** Mã đặt phòng ngắn hiển thị cho khách và ghi trong nội dung chuyển khoản (8 ký tự đầu của id, viết hoa). */
export const bookingCode = (id: string) => id.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
export const transferContent = (id: string) => `NHAGO ${bookingCode(id)}`;

/** Ảnh mã QR VietQR từ dịch vụ img.vietqr.io (khách quét bằng app ngân hàng, số tiền và nội dung điền sẵn). */
export function vietQrUrl(b: Bank, amount: number, info: string) {
  const q = new URLSearchParams({ addInfo: info, accountName: b.accountName });
  if (amount > 0) q.set("amount", String(Math.round(amount)));
  return `https://img.vietqr.io/image/${b.bankBin}-${b.accountNo}-compact2.png?${q.toString()}`;
}
export const isBankReady = (b: Bank | null | undefined): b is Bank => !!b && /^\d{6}$/.test(b.bankBin) && /^[0-9A-Za-z]{4,30}$/.test(b.accountNo) && !!b.accountName;
