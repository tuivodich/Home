import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import { deleteField, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useMoney } from "../lib/useRate";
import { useI18n } from "../i18n";
import { fmtDate, nightsBetween, normName, overlaps } from "../lib/format";
import type { Booking, BookingStatus, Guest, Room } from "../lib/types";

type Filter = "all" | "checked_out" | "cancelled";

/** Tháng (YYYY-MM) dùng để lọc: ngày trả phòng với đặt phòng đã trả, ngày nhận phòng với đặt phòng đã hủy. */
const monthOf = (b: Booking) => (b.status === "checked_out" ? b.checkOut : b.checkIn).slice(0, 7);

export default function History() {
  const { t } = useI18n();
  const { money } = useMoney();
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner"; // chỉ chủ được hoàn tác trả phòng / khôi phục đặt phòng đã hủy
  const { data: rooms } = useCollection<Room>("rooms");
  const { data: bookings } = useCollection<Booking>("bookings");
  const { data: guests } = useCollection<Guest>("guests");
  const [filter, setFilter] = useState<Filter>("all");
  const [month, setMonth] = useState("");
  const [q, setQ] = useState("");

  const done = useMemo(() => bookings.filter((b) => b.status === "checked_out" || b.status === "cancelled"), [bookings]);
  const months = useMemo(() => [...new Set(done.map(monthOf))].sort().reverse(), [done]);

  const list = useMemo(() => {
    const nq = normName(q);
    return done
      .filter((b) => (filter === "all" || b.status === filter) && (!month || monthOf(b) === month))
      .filter((b) => !nq || [b.guestName, b.phone, b.email ?? "", b.couponCode ?? ""].some((v) => normName(v).includes(nq)))
      .sort((a, b) => (b.status === "checked_out" ? b.checkOut : b.checkIn).localeCompare(a.status === "checked_out" ? a.checkOut : a.checkIn));
  }, [done, filter, month, q]);

  // Số liệu theo bộ lọc tháng + tìm kiếm (không theo thẻ trạng thái, để so sánh hai nhóm).
  const scope = useMemo(() => {
    const nq = normName(q);
    return done.filter((b) => (!month || monthOf(b) === month)
      && (!nq || [b.guestName, b.phone, b.email ?? "", b.couponCode ?? ""].some((v) => normName(v).includes(nq))));
  }, [done, month, q]);
  const out = scope.filter((b) => b.status === "checked_out");
  const cancelled = scope.filter((b) => b.status === "cancelled");
  const expired = cancelled.filter((b) => b.cancelReason === "expired");
  const revenue = out.reduce((s, b) => s + b.total, 0);
  const nightsTotal = out.reduce((s, b) => s + Math.max(0, nightsBetween(b.checkIn, b.checkOut)), 0);

  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? "?";
  const profileOf = (b: Booking) => guests.find((g) => g.bookingId === b.id);
  const setStatus = (id: string, status: BookingStatus) => updateDoc(doc(db, "bookings", id), { status });

  // Khôi phục đặt phòng đã hủy: không được trùng với đặt phòng còn hiệu lực của cùng phòng.
  const restore = async (b: Booking) => {
    const clash = bookings.some((o) => o.id !== b.id && o.roomId === b.roomId && o.status !== "cancelled"
      && overlaps(o.checkIn, o.checkOut, b.checkIn, b.checkOut));
    if (clash) return alert(t("confirmClash"));
    if (!confirm(t("sure"))) return;
    await updateDoc(doc(db, "bookings", b.id), { status: "confirmed", cancelReason: deleteField() });
  };

  return (
    <section>
      <h2>{t("history")}</h2>
      <div className="grid stats">
        <div className="card"><big>{out.length}</big><div>{t("statCheckedOut")}</div></div>
        <div className="card"><big className="sm">{money(revenue)}</big><div>{t("statRevenue")} · {nightsTotal} {t("nights")}</div></div>
        <div className="card"><big>{cancelled.length}</big><div>{t("statCancelled")}{expired.length > 0 && ` (${expired.length} ${t("expiredLabel").toLowerCase()})`}</div></div>
      </div>

      <div className="card">
        <div className="segbar" role="group">
          {(["all", "checked_out", "cancelled"] as const).map((k) => (
            <button key={k} type="button" className={`seg ${filter === k ? "on" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {k === "all" ? t("all") : t(k)} ({k === "all" ? done.length : done.filter((b) => b.status === k).length})
            </button>
          ))}
        </div>
        <div className="row">
          <label>{t("month")}
            <select value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="">{t("all")}</option>
              {months.map((m) => <option key={m} value={m}>{m.slice(5)}/{m.slice(0, 4)}</option>)}
            </select>
          </label>
          <label>{t("search")}
            <input value={q} placeholder={t("searchHint")} onChange={(e) => setQ(e.target.value)} />
          </label>
        </div>
      </div>

      {list.length === 0 && <p>{t("noData")}</p>}
      {list.map((b) => {
        const g = profileOf(b);
        const label = b.status !== "cancelled" ? t(b.status) : b.cancelReason === "expired" ? t("expiredLabel") : b.cancelReason === "customer" ? t("customerCancelled") : t("cancelled");
        return (
          <div className="card" key={b.id}>
            <div className="row between">
              <strong>{b.guestName}{b.source === "online" && <small> · {t("online")}</small>}</strong>
              <span className={`tag ${b.status}`}>{label}</span>
            </div>
            <div>{roomName(b.roomId)} · {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} ({nightsBetween(b.checkIn, b.checkOut)} {t("nights")})</div>
            <div>{money(b.total)}{b.phone && ` · ${b.phone}`}{b.email && ` · ${b.email}`}</div>
            {b.couponCode && <small>🏷 {t("couponApplied")} {b.couponCode} (−{b.discountPercent}%)</small>}
            {g && <small>👤 {g.fullName} · {t(g.docType)}: {g.docNumber}</small>}
            {b.note && <small>{b.note}</small>}
            <div className="row">
              {isOwner && b.status === "checked_out" && <button className="ghost" onClick={() => confirm(t("sure")) && setStatus(b.id, "checked_in")}>↩ {t("undoCheckOut")}</button>}
              {isOwner && b.status === "cancelled" && <button className="ghost" onClick={() => restore(b)}>↩ {t("restore")}</button>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
