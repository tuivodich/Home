import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useI18n } from "../i18n";
import { useP } from "../i18n/pricing";
import { lineLabel } from "../lib/pricing";
import { site } from "../lib/siteConfig";
import { useContact } from "../lib/contact";
import { usePricingConfig } from "../lib/usePricing";
import { bookingCode } from "../lib/banks";
import { fmtDate, nightsBetween, todayStr, toDateStr } from "../lib/format";
import { isStaffRole, type Booking, type Room } from "../lib/types";
import { policyLines } from "../i18n/pricing";
import { useTitle } from "../lib/useTitle";

const vnd = (n: number) => `${new Intl.NumberFormat("vi-VN").format(Math.round(n))} VNĐ`;

/** Hóa đơn / phiếu thu của một đặt phòng: in hoặc lưu PDF bằng hộp thoại in của trình duyệt. Khách xem của mình, nhân viên xem mọi đặt phòng. */
export default function InvoicePage() {
  const { id = "" } = useParams();
  const { lang } = useI18n();
  const P = useP();
  const { user, profile, loading } = useAuth();
  const contact = useContact();
  const { cfg } = usePricingConfig();
  const [b, setB] = useState<Booking | null | undefined>(undefined);
  const [room, setRoom] = useState<Room | null>(null);
  useTitle(`${P.invoice} ${bookingCode(id)}`);

  useEffect(() => {
    if (!user || !id) return;
    return onSnapshot(doc(db, "bookings", id), (s) => setB(s.exists() ? ({ ...(s.data() as object), id: s.id } as Booking) : null), () => setB(null));
  }, [user, id]);
  useEffect(() => {
    if (!b) return;
    getDoc(doc(db, "rooms", b.roomId)).then((s) => setRoom(s.exists() ? ({ ...(s.data() as object), id: s.id } as Room) : null)).catch(() => setRoom(null));
  }, [b?.roomId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return null;
  if (!user) return <Navigate to="/?login=1" replace />;
  const staff = isStaffRole(profile?.role);
  const back = staff ? "/app/bookings" : "/account";

  if (b === undefined) return <div className="invoice-page"><p>…</p></div>;
  if (b === null) return <div className="invoice-page"><p>{lang === "vi" ? "Không tìm thấy hóa đơn." : "Invoice not found."}</p><Link to={back}>{P.back}</Link></div>;

  const paid = b.paid ?? 0;
  const balance = Math.max(0, b.total - paid);
  const lines = b.lines && b.lines.length ? b.lines : [{ label: lang === "vi" ? "Tiền phòng" : "Room charge", amount: b.total }];
  const log = (b.payLog ?? []).map((p) => ({ ...p, d: new Date(p.at.toMillis()) }));
  const nights = nightsBetween(b.checkIn, b.checkOut);
  const L = lang === "vi"
    ? { title: "HÓA ĐƠN / PHIẾU THU", guest: "Khách hàng", room: "Phòng", stay: "Thời gian lưu trú", nights: "đêm", guests: "khách", items: "Nội dung", amount: "Thành tiền", total: "Tổng cộng", paidL: "Đã thanh toán", due: "Còn phải thu", settled: "ĐÃ THANH TOÁN ĐỦ", payments: "Các lần thanh toán", date: "Ngày", note: "Ghi chú", issued: "Ngày lập", status: { pending: "Chờ xác nhận", confirmed: "Đã xác nhận", checked_in: "Đang ở", checked_out: "Đã trả phòng", cancelled: "Đã hủy" } }
    : { title: "INVOICE / RECEIPT", guest: "Guest", room: "Room", stay: "Stay", nights: "nights", guests: "guests", items: "Description", amount: "Amount", total: "Total", paidL: "Paid", due: "Balance due", settled: "PAID IN FULL", payments: "Payments", date: "Date", note: "Note", issued: "Issued", status: { pending: "Pending", confirmed: "Confirmed", checked_in: "Checked in", checked_out: "Checked out", cancelled: "Cancelled" } };

  return (
    <div className="invoice-page">
      <div className="invoice-actions no-print">
        <Link className="ghost" to={back}>← {P.back}</Link>
        <button onClick={() => window.print()}>🖨 {P.print}</button>
      </div>
      <article className="invoice">
        <header>
          <div>
            <h1>{site.name}</h1>
            {contact.address && <div>{contact.address}</div>}
            {contact.phone && <div>☎ {contact.phone}</div>}
            {contact.email && <div>✉ {contact.email}</div>}
          </div>
          <div className="invoice-meta">
            <h2>{L.title}</h2>
            <div>{P.bookingCode}: <b>{bookingCode(b.id)}</b></div>
            <div>{L.issued}: {fmtDate(todayStr())}</div>
            <div>{L.status[b.status]}</div>
          </div>
        </header>
        <section className="invoice-grid">
          <div><h3>{L.guest}</h3><div><b>{b.guestName}</b></div>{b.phone && <div>{b.phone}</div>}{b.email && <div>{b.email}</div>}</div>
          <div><h3>{L.stay}</h3><div><b>{room?.name ?? "—"}</b></div><div>{fmtDate(b.checkIn)} {cfg.checkInTime} → {fmtDate(b.checkOut)} {cfg.checkOutTime}</div><div>{nights} {L.nights} · {b.guests} {L.guests}</div></div>
        </section>
        <table>
          <thead><tr><th>{L.items}</th><th className="num">{L.amount}</th></tr></thead>
          <tbody>{lines.map((l, i) => <tr key={i}><td>{lineLabel(l, lang)}</td><td className="num">{l.amount < 0 ? "−" : ""}{vnd(Math.abs(l.amount))}</td></tr>)}</tbody>
          <tfoot>
            <tr className="sum"><td>{L.total}</td><td className="num">{vnd(b.total)}</td></tr>
            <tr><td>{L.paidL}</td><td className="num">{vnd(paid)}</td></tr>
            <tr className="sum"><td>{L.due}</td><td className="num">{vnd(balance)}</td></tr>
          </tfoot>
        </table>
        {balance === 0 && b.total > 0 && paid >= b.total && <div className="invoice-stamp">{L.settled}</div>}
        {log.length > 0 && (
          <section>
            <h3>{L.payments}</h3>
            <table className="small">
              <thead><tr><th>{L.date}</th><th>{L.note}</th><th className="num">{L.amount}</th></tr></thead>
              <tbody>{log.map((p, i) => <tr key={i}><td>{fmtDate(toDateStr(p.d))}</td><td>{p.note}</td><td className="num">{p.amount < 0 ? "−" : ""}{vnd(Math.abs(p.amount))}</td></tr>)}</tbody>
            </table>
          </section>
        )}
        <footer>
          <h3>{P.policy}</h3>
          <ul>{policyLines(P, cfg, vnd).map((l, i) => <li key={i}>{l}</li>)}</ul>
        </footer>
      </article>
    </div>
  );
}
