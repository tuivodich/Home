import { useEffect, useMemo, useState } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc, Timestamp, writeBatch } from "firebase/firestore";
import { app, db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useQueryDocs } from "../lib/hr";
import { useI18n } from "../i18n";
import { useMoney } from "../lib/useRate";
import { bookingCode } from "../lib/banks";
import { copyText, randomToken } from "../lib/secret";
import { useAudit } from "../lib/audit";
import { fmtDate } from "../lib/format";
import type { Booking } from "../lib/types";

interface Tx { id: string; amount: number; content: string; when?: string; code?: string; matched: boolean; bookingId?: string; reason?: string; source?: string; at?: { toDate(): Date } }

/** Tài chính → Đối soát chuyển khoản: tiền vào tài khoản nhận cọc tự được ghi vào đúng đặt phòng (qua webhook SePay/Casso); giao dịch lạ gán tay ở đây. */
export default function BankSyncPage() {
  const { lang } = useI18n();
  const T = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const { user, profile } = useAuth();
  const audit = useAudit();
  const { moneyText } = useMoney();
  const owner = profile?.role === "owner";
  const { data: txs, loading } = useQueryDocs<Tx>(query(collection(db, "bankTx"), orderBy("at", "desc"), limit(100)), "banktx");
  const { data: bookings } = useCollection<Booking>("bookings");
  const [token, setToken] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unmatched">("unmatched");
  const [pick, setPick] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => { if (!owner) return; return onSnapshot(doc(db, "settings", "bankhook"), (s) => setToken(s.data()?.token ?? ""), () => setToken("")); }, [owner]);
  const hookUrl = `https://us-central1-${app.options.projectId}.cloudfunctions.net/bankHook`;
  const byCode = useMemo(() => new Map(bookings.map((b) => [bookingCode(b.id).toUpperCase(), b])), [bookings]);
  const codeOfBooking = (b: Booking) => (b.code || bookingCode(b.id)).toUpperCase();
  const find = (raw: string) => { const c = raw.trim().toUpperCase().replace(/^NHAGO\s*/, ""); return bookings.find((b) => codeOfBooking(b) === c) ?? byCode.get(c); };
  const shown = txs.filter((t) => filter === "all" || !t.matched);
  const unmatched = txs.filter((t) => !t.matched).length;

  const makeToken = async () => {
    if (token && !confirm(T("Tạo mã mới? Bạn phải cập nhật lại mã trong SePay/Casso, nếu không tiền vào sẽ không tự ghi nhận.", "Create a new code? You must update it in SePay/Casso or incoming payments will not be recorded."))) return;
    await setDoc(doc(db, "settings", "bankhook"), { token: randomToken(40) });
    audit("settings.bankhook", token ? "Đổi mã webhook ngân hàng" : "Tạo mã webhook ngân hàng");
  };
  const copy = async (k: string, v: string) => { if (await copyText(v)) { setCopied(k); setTimeout(() => setCopied(""), 1500); } };

  const assign = async (t: Tx) => {
    setMsg("");
    const b = find(pick[t.id] ?? "");
    if (!b) return setMsg(T("Không tìm thấy đặt phòng với mã này.", "No booking with this code."));
    if (b.status === "cancelled" && !confirm(T("Đặt phòng này đã hủy. Vẫn ghi nhận khoản tiền vào đó?", "This booking is cancelled. Record the payment anyway?"))) return;
    if (!confirm(T(`Ghi ${t.amount.toLocaleString("vi-VN")} VNĐ vào đặt phòng ${codeOfBooking(b)} (${b.guestName})?`, `Record ${t.amount.toLocaleString("en-US")} VND on booking ${codeOfBooking(b)} (${b.guestName})?`))) return;
    try {
      const w = writeBatch(db);
      w.update(doc(db, "bookings", b.id), { paid: Math.max(0, (b.paid ?? 0) + t.amount), payLog: [...(b.payLog ?? []), { amount: t.amount, at: Timestamp.now(), by: user?.uid ?? "", note: `Chuyển khoản ngân hàng (gán tay${t.source ? `, ${t.source}` : ""})` }] });
      w.update(doc(db, "bankTx", t.id), { matched: true, bookingId: b.id, reason: "", assignedBy: user?.uid ?? "" });
      await w.commit();
      audit("payment.in", `Gán tay ${t.amount.toLocaleString("vi-VN")} VNĐ chuyển khoản — ${b.guestName} (${codeOfBooking(b)})`, { type: "booking", id: b.id });
      setPick({ ...pick, [t.id]: "" });
      setMsg(T("Đã ghi nhận.", "Recorded."));
    } catch (e) { console.error("assign tx", e); setMsg(T("Không ghi nhận được.", "Could not record.")); }
  };

  return (
    <section id="bank-sync">
      <h2>{T("Đối soát chuyển khoản", "Bank reconciliation")}</h2>
      <p><small>{T("Khi khách chuyển cọc kèm nội dung “NHAGO + mã đặt phòng”, hệ thống tự cộng tiền vào đúng đặt phòng và báo chủ/quản lý qua Telegram (không tự xác nhận đặt phòng — bạn bấm xác nhận). Cần một dịch vụ báo biến động số dư (SePay, Casso…) gọi vào webhook bên dưới. Giao dịch không khớp mã được giữ lại để bạn gán tay.", "When a guest pays the deposit with the reference “NHAGO + booking code”, the amount is added to that booking and owner/managers are alerted on Telegram (the booking is not confirmed automatically). It needs a bank-notification service (SePay, Casso…) calling the webhook below. Payments that do not match a code are kept for manual assignment.")}</small></p>

      {owner && (
        <div className="card">
          <h3>{T("Kết nối (chỉ chủ)", "Setup (owner only)")}</h3>
          <div className="row between"><span>Webhook URL: <small className="ical-url">{hookUrl}</small></span><button type="button" className="ghost" onClick={() => copy("url", hookUrl)}>{copied === "url" ? T("Đã chép", "Copied") : T("Sao chép", "Copy")}</button></div>
          {token === null ? <small>…</small> : token ? (
            <div className="row between"><span>{T("Mã bí mật", "Secret code")}: <small className="ical-url">{token}</small></span><button type="button" className="ghost" onClick={() => copy("tok", token)}>{copied === "tok" ? T("Đã chép", "Copied") : T("Sao chép", "Copy")}</button></div>
          ) : <small>{T("Chưa có mã bí mật.", "No secret code yet.")}</small>}
          <div className="row"><button type="button" className={token ? "ghost danger" : ""} onClick={makeToken}>{token ? T("Tạo mã mới", "Create a new code") : T("Tạo mã bí mật", "Create secret code")}</button></div>
          <details>
            <summary>{T("Hướng dẫn cài đặt", "How to set up")}</summary>
            <ol>
              <li>{T("Đăng ký dịch vụ báo biến động số dư (vd SePay hoặc Casso) và liên kết tài khoản ngân hàng nhận cọc (cùng tài khoản đã khai ở Cài đặt → Tài khoản ngân hàng).", "Sign up for a bank-notification service (e.g. SePay or Casso) and link the deposit bank account.")}</li>
              <li>{T("Tạo webhook: dán Webhook URL ở trên, phương thức POST, định dạng JSON.", "Create a webhook: paste the Webhook URL above, method POST, JSON body.")}</li>
              <li>{T("Xác thực: SePay chọn “API Key” và dán mã bí mật (gửi dạng Authorization: Apikey …); Casso dán mã vào “secure-token”.", "Authentication: for SePay choose “API Key” and paste the secret code (sent as Authorization: Apikey …); for Casso paste it as the “secure-token”.")}</li>
              <li>{T("Chuyển thử một khoản nhỏ với nội dung “NHAGO + mã đặt phòng thật” để kiểm tra.", "Test with a small transfer whose reference is “NHAGO + a real booking code”.")}</li>
            </ol>
          </details>
        </div>
      )}

      <div className="card">
        <div className="row between">
          <div className="segbar" role="group">
            <button type="button" className={`seg ${filter === "unmatched" ? "on" : ""}`} aria-pressed={filter === "unmatched"} onClick={() => setFilter("unmatched")}>{T("Chưa khớp", "Unmatched")} ({unmatched})</button>
            <button type="button" className={`seg ${filter === "all" ? "on" : ""}`} aria-pressed={filter === "all"} onClick={() => setFilter("all")}>{T("Tất cả", "All")}</button>
          </div>
          <small>{T("100 giao dịch gần nhất", "Latest 100 transactions")}</small>
        </div>
        {msg && <small role="status">{msg}</small>}
        {loading && <small>…</small>}
        {!loading && shown.length === 0 && <small>{T("Chưa có giao dịch.", "No transactions.")}</small>}
        {shown.map((t) => {
          const b = t.bookingId ? bookings.find((x) => x.id === t.bookingId) : undefined;
          return (
            <div className="card" key={t.id}>
              <div className="row between">
                <strong>+{moneyText(t.amount)}</strong>
                <span className={`tag ${t.matched ? "confirmed" : "cancelled"}`}>{t.matched ? T("Đã khớp", "Matched") : T("Chưa khớp", "Unmatched")}</span>
              </div>
              <small>{t.at?.toDate().toLocaleString(lang === "vi" ? "vi-VN" : "en-GB") ?? ""}{t.source ? ` · ${t.source}` : ""}</small>
              <small>“{t.content}”</small>
              {t.matched && b && <small>→ {b.guestName} · {codeOfBooking(b)} · {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)}</small>}
              {!t.matched && (
                <>
                  {t.reason && <small className="overdue">{t.reason}</small>}
                  <div className="row">
                    <input value={pick[t.id] ?? ""} placeholder={T("Mã đặt phòng (vd AB12CD34)", "Booking code (e.g. AB12CD34)")} onChange={(e) => setPick({ ...pick, [t.id]: e.target.value })} aria-label={T("Mã đặt phòng", "Booking code")} />
                    <button type="button" onClick={() => assign(t)} disabled={!(pick[t.id] ?? "").trim()}>{T("Gán vào đặt phòng", "Assign")}</button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
