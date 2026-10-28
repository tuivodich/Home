import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { EMPTY_BANK, type Bank } from "./banks";
import { DEFAULT_BOOKING_CFG, DEFAULT_PRICING, parseBookingCfg, parsePricing, type BookingCfg, type PricingCfg } from "./pricing";

/** Bảng giá + chính sách đặt phòng (settings/pricing, settings/booking): công khai; chưa cấu hình thì dùng mặc định (không phụ thu). */
export function usePricingConfig() {
  const [pricing, setPricing] = useState<PricingCfg>(DEFAULT_PRICING);
  const [cfg, setCfg] = useState<BookingCfg>(DEFAULT_BOOKING_CFG);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let got = 0;
    const done = () => { got++; if (got >= 2) setLoading(false); };
    const a = onSnapshot(doc(db, "settings", "pricing"), (s) => { setPricing(s.exists() ? parsePricing(s.data()) : DEFAULT_PRICING); done(); }, done);
    const b = onSnapshot(doc(db, "settings", "booking"), (s) => { setCfg(s.exists() ? parseBookingCfg(s.data()) : DEFAULT_BOOKING_CFG); done(); }, done);
    return () => { a(); b(); };
  }, []);
  return { pricing, cfg, loading };
}

/** Tài khoản nhận cọc (settings/bank): chỉ người đã đăng nhập đọc được. `null` khi chưa thiết lập hoặc chưa đăng nhập. */
export function useBank(enabled = true) {
  const [bank, setBank] = useState<Bank | null>(null);
  useEffect(() => {
    if (!enabled) { setBank(null); return; }
    return onSnapshot(doc(db, "settings", "bank"), (s) => {
      const d = s.data();
      setBank(s.exists() ? { ...EMPTY_BANK, bankBin: String(d?.bankBin ?? ""), bankName: String(d?.bankName ?? ""), accountNo: String(d?.accountNo ?? ""), accountName: String(d?.accountName ?? "") } : null);
    }, () => setBank(null));
  }, [enabled]);
  return bank;
}
