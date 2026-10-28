import { useState } from "react";
import { bookingCode, isBankReady, transferContent, vietQrUrl, type Bank } from "../lib/banks";
import { useMoney } from "../lib/useRate";
import { useP } from "../i18n/pricing";

/** Mã QR VietQR + thông tin chuyển khoản để khách đặt cọc (nội dung chuyển khoản gồm mã đặt phòng). */
export default function PayPanel({ bank, amount, bookingId }: { bank: Bank | null; amount: number; bookingId: string }) {
  const P = useP();
  const { money } = useMoney();
  const [copied, setCopied] = useState("");
  const [imgErr, setImgErr] = useState(false);
  const content = transferContent(bookingId);
  const copy = async (key: string, v: string) => { try { await navigator.clipboard.writeText(v); setCopied(key); setTimeout(() => setCopied(""), 1500); } catch { /* trình duyệt chặn: bỏ qua */ } };
  if (!isBankReady(bank)) return <p className="lm-muted">{P.noBank}</p>;
  const row = (k: string, label: string, v: string) => (
    <div className="pay-row"><span>{label}</span><b>{v}</b><button type="button" className="lm-link" onClick={() => copy(k, v)}>{copied === k ? P.copied : P.copy}</button></div>
  );
  return (
    <div className="pay-panel">
      <h4>{P.payTitle}</h4>
      <p className="lm-muted lm-small">{P.payScan}</p>
      <div className="pay-qr">
        <img src={vietQrUrl(bank, amount, content)} alt="VietQR" width="220" height="220" onError={() => setImgErr(true)} />
      </div>
      {imgErr && <p className="lm-err lm-small">{P.qrFail}</p>}
      <div className="pay-row"><span>{P.payBank}</span><b>{bank.bankName || bank.bankBin}</b></div>
      {row("acc", P.payAccount, bank.accountNo)}
      <div className="pay-row"><span>{P.payHolder}</span><b>{bank.accountName}</b></div>
      <div className="pay-row"><span>{P.payAmount}</span><b>{money(amount)}</b></div>
      {row("info", P.payContent, content)}
      <p className="lm-muted lm-small">{P.bookingCode}: <b>{bookingCode(bookingId)}</b>. {P.payNote}</p>
    </div>
  );
}
