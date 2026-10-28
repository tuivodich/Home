import { useEffect, useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useI18n } from "../i18n";
import DateInput from "../components/DateInput";
import { BANKS, EMPTY_BANK, isBankReady, vietQrUrl, type Bank } from "../lib/banks";
import { DEFAULT_BOOKING_CFG, DEFAULT_PRICING, type BookingCfg, type PricingCfg, type PriceRule, type ServiceDef } from "../lib/pricing";
import { useBank, usePricingConfig } from "../lib/usePricing";
import { TIME_RE } from "../lib/hr";
import NumInput from "../components/NumInput";

const DAYS: [number, string, string][] = [[1, "T2", "Mon"], [2, "T3", "Tue"], [3, "T4", "Wed"], [4, "T5", "Thu"], [5, "T6", "Fri"], [6, "T7", "Sat"], [0, "CN", "Sun"]];
const newId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Giá & chính sách (chủ/quản lý): giá cuối tuần/mùa/lễ/ở dài ngày, đặt cọc, giờ nhận-trả phòng, chính sách hủy, phụ thu, dịch vụ đi kèm; tài khoản nhận cọc (chỉ chủ). */
export default function PricingPage() {
  const { lang } = useI18n();
  const T = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const { pricing: savedP, cfg: savedC, loading } = usePricingConfig();
  const savedB = useBank(isOwner);
  const [p, setP] = useState<PricingCfg>(DEFAULT_PRICING);
  const [c, setC] = useState<BookingCfg>(DEFAULT_BOOKING_CFG);
  const [b, setB] = useState<Bank>(EMPTY_BANK);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [otherBank, setOtherBank] = useState(false);

  // Nạp dữ liệu đã lưu vào bản nháp (khi dữ liệu thật đổi, ví dụ lần đầu tải xong hoặc sau khi lưu).
  useEffect(() => { if (!loading) { setP(clone(savedP)); setC(clone(savedC)); } }, [loading, savedP, savedC]);
  useEffect(() => { setB(savedB ?? EMPTY_BANK); setOtherBank(!!savedB?.bankBin && !BANKS.some((x) => x.bin === savedB.bankBin)); }, [savedB]);

  const dirty = useMemo(() => JSON.stringify([p, c, isOwner ? b : null]) !== JSON.stringify([savedP, savedC, isOwner ? (savedB ?? EMPTY_BANK) : null]), [p, c, b, savedP, savedC, savedB, isOwner]);
  const timesOk = TIME_RE.test(c.checkInTime) && TIME_RE.test(c.checkOutTime);
  const rulesOk = [...p.seasons, ...p.holidays].every((r) => r.from && r.to && r.from <= r.to);
  const bankFilled = b.bankBin || b.accountNo || b.accountName;
  const bankOk = !isOwner || !bankFilled || (/^\d{6}$/.test(b.bankBin) && /^[0-9A-Za-z]{4,30}$/.test(b.accountNo) && !!b.accountName.trim());
  const canSave = dirty && timesOk && rulesOk && bankOk && !busy;

  const patchRule = (key: "seasons" | "holidays", i: number, v: Partial<PriceRule>) => setP({ ...p, [key]: p[key].map((r, k) => (k === i ? { ...r, ...v } : r)) });
  const patchSvc = (i: number, v: Partial<ServiceDef>) => setC({ ...c, services: c.services.map((s, k) => (k === i ? { ...s, ...v } : s)) });

  const save = async () => {
    setBusy(true); setMsg(""); setErr("");
    try {
      await setDoc(doc(db, "settings", "pricing"), {
        weekendDays: p.weekendDays, weekendPercent: p.weekendPercent,
        seasons: p.seasons.map((r) => ({ name: r.name.trim(), from: r.from, to: r.to, percent: r.percent })),
        holidays: p.holidays.map((r) => ({ name: r.name.trim(), from: r.from, to: r.to, percent: r.percent })),
        longStay: p.longStay.filter((r) => r.minNights >= 2).map((r) => ({ minNights: Math.floor(r.minNights), percent: -Math.abs(r.percent) })),
      });
      await setDoc(doc(db, "settings", "booking"), {
        depositPercent: c.depositPercent, checkInTime: c.checkInTime, checkOutTime: c.checkOutTime,
        cancelTiers: c.cancelTiers.map((t) => ({ daysBefore: Math.max(0, Math.floor(t.daysBefore)), refundPercent: Math.min(100, Math.max(0, t.refundPercent)) })),
        cancelNote: c.cancelNote.trim(), extraGuestFee: c.extraGuestFee, earlyCheckInFee: c.earlyCheckInFee, lateCheckOutFee: c.lateCheckOutFee,
        services: c.services.filter((s) => s.name.trim()).map((s) => ({ id: s.id, name: s.name.trim(), price: Math.max(0, s.price), unit: s.unit, active: s.active })),
      });
      if (isOwner && bankFilled) await setDoc(doc(db, "settings", "bank"), { bankBin: b.bankBin, bankName: b.bankName.trim(), accountNo: b.accountNo.trim(), accountName: b.accountName.trim().toUpperCase() });
      setMsg(T("Đã lưu giá và chính sách.", "Prices and policies saved."));
    } catch (ex) { console.error("save pricing", ex); setErr(T("Không lưu được. Vui lòng thử lại.", "Could not save. Please try again.")); } finally { setBusy(false); }
  };
  const discard = () => { setP(clone(savedP)); setC(clone(savedC)); setB(savedB ?? EMPTY_BANK); setMsg(""); setErr(""); };
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <section>
      <h2>{T("Giá & chính sách", "Prices & policies")}</h2>
      <p><small>{T("Giá phòng gốc đặt ở trang Phòng; ở đây chỉ chỉnh phần tăng/giảm. Mã giảm giá vẫn áp thêm cho tiền ở (không áp lên dịch vụ, nhận sớm, trả muộn).", "Base prices are set on the Rooms page; here you set the markups/discounts. Coupons still apply on top of the lodging charge (not on services or early/late fees).")}</small></p>
      {msg && <p className="ok-msg" role="status">{msg}</p>}
      {err && <p className="error">{err}</p>}

      <div className="card" id="price-rules">
        <h3>{T("Giá theo ngày", "Price rules")}</h3>
        <label>{T("Tăng giá cuối tuần (%)", "Weekend markup (%)")}<NumInput min={-50} max={300} value={p.weekendPercent} onChange={(e) => setP({ ...p, weekendPercent: num(e.target.value) })} /></label>
        <div className="row">
          <small>{T("Đêm cuối tuần (đêm bắt đầu từ ngày):", "Weekend nights (night starting on):")}</small>
          {DAYS.map(([d, vi, en]) => (
            <label key={d} className="check"><input type="checkbox" checked={p.weekendDays.includes(d)} onChange={(e) => setP({ ...p, weekendDays: e.target.checked ? [...p.weekendDays, d] : p.weekendDays.filter((x) => x !== d) })} /><span>{lang === "vi" ? vi : en}</span></label>
          ))}
        </div>
        {(["seasons", "holidays"] as const).map((key) => (
          <div key={key}>
            <h4 className="sub">{key === "seasons" ? T("Mùa cao/thấp điểm (cộng thêm cuối tuần)", "Seasons (weekend markup adds on top)") : T("Ngày lễ / Tết (thay cho giá cuối tuần)", "Holidays (replace the weekend markup)")}</h4>
            {p[key].map((r, i) => (
              <div className="row shiftform" key={i}>
                <label>{T("Tên", "Name")}<input value={r.name} maxLength={40} onChange={(e) => patchRule(key, i, { name: e.target.value })} /></label>
                <label>{T("Từ ngày", "From")}<DateInput value={r.from} onChange={(v) => patchRule(key, i, { from: v })} /></label>
                <label>{T("Đến ngày", "To")}<DateInput value={r.to} onChange={(v) => patchRule(key, i, { to: v })} /></label>
                <label>{T("Tăng/giảm %", "Change %")}<NumInput min={-50} max={300} value={r.percent} onChange={(e) => patchRule(key, i, { percent: num(e.target.value) })} /></label>
                <button type="button" className="ghost danger" onClick={() => setP({ ...p, [key]: p[key].filter((_, k) => k !== i) })}>{T("Xóa", "Remove")}</button>
              </div>
            ))}
            <button type="button" className="ghost" onClick={() => setP({ ...p, [key]: [...p[key], { name: "", from: "", to: "", percent: 20 }] })}>+ {T("Thêm", "Add")}</button>
          </div>
        ))}
        <div>
          <h4 className="sub">{T("Giảm giá ở dài ngày", "Long-stay discount")}</h4>
          {p.longStay.map((r, i) => (
            <div className="row shiftform" key={i}>
              <label>{T("Từ số đêm", "From nights")}<NumInput min={2} max={60} value={r.minNights} onChange={(e) => setP({ ...p, longStay: p.longStay.map((x, k) => (k === i ? { ...x, minNights: num(e.target.value) } : x)) })} /></label>
              <label>{T("Giảm (%)", "Discount (%)")}<NumInput min={0} max={50} value={Math.abs(r.percent)} onChange={(e) => setP({ ...p, longStay: p.longStay.map((x, k) => (k === i ? { ...x, percent: -Math.abs(num(e.target.value)) } : x)) })} /></label>
              <button type="button" className="ghost danger" onClick={() => setP({ ...p, longStay: p.longStay.filter((_, k) => k !== i) })}>{T("Xóa", "Remove")}</button>
            </div>
          ))}
          <button type="button" className="ghost" onClick={() => setP({ ...p, longStay: [...p.longStay, { minNights: 3, percent: -5 }] })}>+ {T("Thêm mức", "Add tier")}</button>
        </div>
        {!rulesOk && <p className="error">{T("Mỗi mùa/ngày lễ cần có ngày bắt đầu và kết thúc (kết thúc không trước bắt đầu).", "Each season/holiday needs a start and end date (end not before start).")}</p>}
      </div>

      <div className="card" id="deposit-policy">
        <h3>{T("Đặt cọc, giờ nhận/trả phòng, chính sách hủy", "Deposit, check-in/out times, cancellation")}</h3>
        <label>{T("Tiền cọc (% tổng tiền; 0 = không cọc)", "Deposit (% of total; 0 = none)")}<NumInput min={0} max={100} value={c.depositPercent} onChange={(e) => setC({ ...c, depositPercent: Math.min(100, Math.max(0, num(e.target.value))) })} /></label>
        <div className="row shiftform">
          <label>{T("Giờ nhận phòng", "Check-in time")}<input value={c.checkInTime} maxLength={5} placeholder="14:00" onChange={(e) => setC({ ...c, checkInTime: e.target.value })} /></label>
          <label>{T("Giờ trả phòng", "Check-out time")}<input value={c.checkOutTime} maxLength={5} placeholder="12:00" onChange={(e) => setC({ ...c, checkOutTime: e.target.value })} /></label>
        </div>
        {!timesOk && <p className="error">{T("Giờ phải dạng HH:MM, ví dụ 14:00.", "Time must be HH:MM, e.g. 14:00.")}</p>}
        <h4 className="sub">{T("Hoàn cọc khi hủy (theo số ngày trước ngày nhận phòng)", "Refund when cancelling (by days before check-in)")}</h4>
        {c.cancelTiers.map((t, i) => (
          <div className="row shiftform" key={i}>
            <label>{T("Hủy trước ít nhất (ngày)", "Cancel at least (days) before")}<NumInput min={0} max={365} value={t.daysBefore} onChange={(e) => setC({ ...c, cancelTiers: c.cancelTiers.map((x, k) => (k === i ? { ...x, daysBefore: num(e.target.value) } : x)) })} /></label>
            <label>{T("Hoàn lại (%)", "Refund (%)")}<NumInput min={0} max={100} value={t.refundPercent} onChange={(e) => setC({ ...c, cancelTiers: c.cancelTiers.map((x, k) => (k === i ? { ...x, refundPercent: Math.min(100, Math.max(0, num(e.target.value))) } : x)) })} /></label>
            <button type="button" className="ghost danger" onClick={() => setC({ ...c, cancelTiers: c.cancelTiers.filter((_, k) => k !== i) })}>{T("Xóa", "Remove")}</button>
          </div>
        ))}
        <button type="button" className="ghost" onClick={() => setC({ ...c, cancelTiers: [...c.cancelTiers, { daysBefore: 1, refundPercent: 0 }] })}>+ {T("Thêm mức", "Add tier")}</button>
        <small>{T("Ví dụ: ≥7 ngày hoàn 100%, ≥3 ngày hoàn 50%, 0 ngày hoàn 0%. Mức không khớp thì không hoàn.", "E.g. ≥7 days 100%, ≥3 days 50%, 0 days 0%. If no tier matches, nothing is refunded.")}</small>
        <label>{T("Ghi chú chính sách hủy (hiện cho khách)", "Cancellation note (shown to guests)")}<textarea rows={3} maxLength={1000} value={c.cancelNote} onChange={(e) => setC({ ...c, cancelNote: e.target.value })} /></label>
      </div>

      <div className="card" id="surcharges">
        <h3>{T("Phụ thu", "Surcharges")}</h3>
        <label>{T("Thêm khách (VNĐ / người / đêm, khi vượt số khách đã gồm trong giá của phòng)", "Extra guest (VND / person / night, above the guests included in the room price)")}<NumInput min={0} step={10000} value={c.extraGuestFee} onChange={(e) => setC({ ...c, extraGuestFee: Math.max(0, num(e.target.value)) })} /></label>
        <label>{T("Nhận phòng sớm (VNĐ, khách tự chọn khi đặt)", "Early check-in (VND, optional for the guest)")}<NumInput min={0} step={10000} value={c.earlyCheckInFee} onChange={(e) => setC({ ...c, earlyCheckInFee: Math.max(0, num(e.target.value)) })} /></label>
        <label>{T("Trả phòng muộn (VNĐ, khách tự chọn khi đặt)", "Late check-out (VND, optional for the guest)")}<NumInput min={0} step={10000} value={c.lateCheckOutFee} onChange={(e) => setC({ ...c, lateCheckOutFee: Math.max(0, num(e.target.value)) })} /></label>
        <small>{T("Để 0 thì không hiện lựa chọn nhận sớm / trả muộn khi đặt.", "Leave 0 to hide the early check-in / late check-out options when booking.")}</small>
      </div>

      <div className="card" id="services">
        <h3>{T("Dịch vụ đi kèm", "Add-on services")}</h3>
        <small>{T("Khách chọn số lượng khi đặt, tiền cộng vào hóa đơn. “Theo đêm” = nhân thêm số đêm ở (vd thuê xe máy, ăn sáng).", "Guests pick quantities when booking; the cost is added to the bill. “Per night” multiplies by the nights stayed (e.g. motorbike rental, breakfast).")}</small>
        {c.services.map((s, i) => (
          <div className="row shiftform" key={s.id}>
            <label>{T("Tên dịch vụ", "Service")}<input value={s.name} maxLength={60} onChange={(e) => patchSvc(i, { name: e.target.value })} /></label>
            <label>{T("Đơn giá (VNĐ)", "Price (VND)")}<NumInput min={0} step={10000} value={s.price} onChange={(e) => patchSvc(i, { price: Math.max(0, num(e.target.value)) })} /></label>
            <label>{T("Tính theo", "Charged")}
              <select value={s.unit} onChange={(e) => patchSvc(i, { unit: e.target.value as ServiceDef["unit"] })}>
                <option value="once">{T("Mỗi lượt / suất", "Per use")}</option><option value="night">{T("Theo đêm", "Per night")}</option>
              </select>
            </label>
            <label className="check"><input type="checkbox" checked={s.active} onChange={(e) => patchSvc(i, { active: e.target.checked })} /><span>{T("Đang bán", "Active")}</span></label>
            <button type="button" className="ghost danger" onClick={() => setC({ ...c, services: c.services.filter((_, k) => k !== i) })}>{T("Xóa", "Remove")}</button>
          </div>
        ))}
        <div className="row">
          <button type="button" className="ghost" onClick={() => setC({ ...c, services: [...c.services, { id: newId(), name: "", price: 0, unit: "once", active: true }] })}>+ {T("Thêm dịch vụ", "Add service")}</button>
          {c.services.length === 0 && <button type="button" className="ghost" onClick={() => setC({ ...c, services: [
            { id: newId(), name: "Đón đưa sân bay / bến xe", price: 300000, unit: "once", active: true },
            { id: newId(), name: "Thuê xe máy", price: 150000, unit: "night", active: true },
            { id: newId(), name: "Ăn sáng", price: 60000, unit: "night", active: true },
            { id: newId(), name: "Tiệc BBQ (suất)", price: 250000, unit: "once", active: true },
            { id: newId(), name: "Tour địa phương", price: 400000, unit: "once", active: true },
          ] })}>{T("Thêm 5 dịch vụ mẫu", "Add 5 sample services")}</button>}
        </div>
      </div>

      {isOwner && (
        <div className="card" id="bank">
          <h3>{T("Tài khoản nhận cọc (chỉ chủ)", "Deposit bank account (owner only)")}</h3>
          <small>{T("Dùng để tạo mã QR VietQR cho khách chuyển cọc. Khách chỉ thấy thông tin này sau khi đăng nhập và đặt phòng.", "Used to build the VietQR code for deposits. Guests only see it after signing in and booking.")}</small>
          <label>{T("Ngân hàng", "Bank")}
            <select value={otherBank ? "other" : b.bankBin} onChange={(e) => {
              if (e.target.value === "other") { setOtherBank(true); return; }
              const bank = BANKS.find((x) => x.bin === e.target.value);
              setOtherBank(false);
              setB(bank ? { ...b, bankBin: bank.bin, bankName: bank.name } : { ...b, bankBin: "", bankName: "" });
            }}>
              <option value="">—</option>
              {BANKS.map((x) => <option key={x.bin} value={x.bin}>{x.name}</option>)}
              <option value="other">{T("Ngân hàng khác (nhập mã BIN)", "Other bank (enter BIN)")}</option>
            </select>
          </label>
          {otherBank && (
            <div className="row shiftform">
              <label>{T("Mã BIN (6 số)", "BIN (6 digits)")}<input inputMode="numeric" maxLength={6} value={b.bankBin} onChange={(e) => setB({ ...b, bankBin: e.target.value.replace(/\D/g, "") })} /></label>
              <label>{T("Tên ngân hàng", "Bank name")}<input maxLength={80} value={b.bankName} onChange={(e) => setB({ ...b, bankName: e.target.value })} /></label>
            </div>
          )}
          <label>{T("Số tài khoản", "Account number")}<input inputMode="numeric" maxLength={30} value={b.accountNo} onChange={(e) => setB({ ...b, accountNo: e.target.value.replace(/\s/g, "") })} /></label>
          <label>{T("Tên chủ tài khoản (viết hoa, không dấu)", "Account holder (uppercase, no accents)")}<input maxLength={80} value={b.accountName} onChange={(e) => setB({ ...b, accountName: e.target.value.toUpperCase() })} /></label>
          {!bankOk && <p className="error">{T("Cần mã BIN 6 số, số tài khoản và tên chủ tài khoản.", "A 6-digit BIN, account number and holder name are required.")}</p>}
          {isBankReady(savedB) && (
            <div>
              <button type="button" className="ghost" onClick={() => setShowQr(!showQr)}>{showQr ? T("Ẩn mã QR thử", "Hide test QR") : T("Xem mã QR thử (10.000 VNĐ)", "Show test QR (10,000 VND)")}</button>
              {showQr && <div className="qrprev"><img src={vietQrUrl(savedB, 10000, "NHAGO TEST")} alt="VietQR" width="240" /><small>{T("Quét bằng app ngân hàng để kiểm tra đúng tài khoản trước khi dùng thật (không cần chuyển tiền).", "Scan with your banking app to check it is the right account (no need to transfer).")}</small></div>}
            </div>
          )}
        </div>
      )}

      <div className="rolebar">
        <button type="button" disabled={!canSave} onClick={save}>{T("Lưu lại", "Save")}</button>
        <button type="button" className="ghost" disabled={!dirty || busy} onClick={discard}>{T("Hủy bỏ", "Discard")}</button>
      </div>
    </section>
  );
}
