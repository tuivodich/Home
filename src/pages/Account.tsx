import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { collection, doc, onSnapshot, query, where, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useMoney } from "../lib/useRate";
import { useI18n, useL } from "../i18n";
import { fmtDate, nightsBetween, todayStr } from "../lib/format";
import { isStaffRole, type Booking, type Room } from "../lib/types";
import { useSiteTheme } from "../lib/theme";
import "../landing/landing.css";

export default function Account() {
  const L = useL();
  const { t, lang, setLang } = useI18n();
  const { user, profile, loading, logout } = useAuth();
  const siteTheme = useSiteTheme();
  const { money } = useMoney();
  const { data: rooms } = useCollection<Room>("rooms");
  const [mine, setMine] = useState<Booking[]>([]);
  const [fetching, setFetching] = useState(true);
  const [confirming, setConfirming] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelErr, setCancelErr] = useState("");
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(query(collection(db, "bookings"), where("createdBy", "==", uid)), (snap) => {
      setMine(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as Booking));
      setFetching(false);
    }, (e) => { console.error("my bookings", e); setFetching(false); });
  }, [uid]);

  // Chỉ hiện đặt phòng khách tự đặt online (đặt phòng do nhân viên nhập hộ không nằm ở đây).
  const sorted = useMemo(() => mine.filter((b) => b.source === "online").sort((a, b) => b.checkIn.localeCompare(a.checkIn)), [mine]);

  if (loading) return <div className="center">{t("loading")}</div>;
  if (!user) return <Navigate to="/?login=1" replace />;

  // Hủy sau khi khách xác nhận trong hộp thoại; gỡ luôn lịch bận công khai để phòng được nhả ngay.
  const doCancel = async () => {
    if (!confirming) return;
    setCancelling(true); setCancelErr("");
    try {
      const w = writeBatch(db);
      w.update(doc(db, "bookings", confirming.id), { status: "cancelled", cancelReason: "customer" });
      w.delete(doc(db, "busy", confirming.id));
      if (confirming.slotId) w.delete(doc(db, "pend", confirming.slotId));
      await w.commit();
      setConfirming(null);
    } catch (ex) {
      console.error("cancel failed", ex);
      setCancelErr(L.account.cancelFailed);
    } finally { setCancelling(false); }
  };

  return (
    <div className="landing lp-account" data-theme={siteTheme.theme} data-fx={siteTheme.effects ? "on" : "off"}>
      <div className="lp-wrap">
        <div className="lp-account-bar">
          <Link to="/" className="lp-pill">{L.account.back}</Link>
          <span className="lp-spacer" />
          <button className="lp-pill" onClick={() => setLang(lang === "vi" ? "en" : "vi")}>{lang === "vi" ? "EN" : "VI"}</button>
          {isStaffRole(profile?.role) && <Link className="lp-pill solid" to="/app">{L.account.staffLink}</Link>}
          <button className="lp-pill" onClick={logout}>{L.signOut}</button>
        </div>
        <h1 className="lp-account-title">{L.account.title}</h1>
        <p className="lp-muted">{user.displayName || user.email}</p>

        {!fetching && sorted.length === 0 && (
          <div className="lp-panel lp-center">
            <p>{L.account.empty}</p>
            <Link className="lp-btn primary" to="/#booking">{L.account.bookNow}</Link>
          </div>
        )}
        {sorted.map((b) => {
          const stale = b.status === "pending" && b.checkIn < todayStr();
          const expired = stale || (b.status === "cancelled" && b.cancelReason === "expired");
          return (
          <div className="lp-panel lp-booking-row" key={b.id}>
            <div>
              <strong>{rooms.find((r) => r.id === b.roomId)?.name ?? "?"}</strong>
              <div>{L.account.fullName}: <b>{b.guestName}</b></div>
              <div>{fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · {nightsBetween(b.checkIn, b.checkOut)} {L.booking.nights}</div>
              <div className="lp-muted">{money(b.total)} · 👤 {b.guests}</div>
              {b.couponCode && <div className="lp-muted lp-small">🏷 {b.couponCode} (−{b.discountPercent}%)</div>}
            </div>
            <div className="lp-booking-side">
              <span className={`lp-status ${expired ? "cancelled" : b.status}`}>{expired ? L.account.expired : t(b.status)}</span>
              {((b.status === "pending" && !stale) || b.status === "confirmed") && (
                <button className="lp-pill" onClick={() => { setCancelErr(""); setConfirming(b); }}>{L.account.cancel}</button>
              )}
            </div>
          </div>
          );
        })}
        {sorted.some((b) => b.status === "checked_in") && <p className="lp-muted lp-small">{L.account.contactToChange}</p>}
      </div>

      {confirming && (
        <div className="lm-overlay" onClick={() => !cancelling && setConfirming(null)} role="dialog" aria-modal="true" aria-labelledby="cancel-title">
          <div className="lm-modal" onClick={(e) => e.stopPropagation()}>
            <h3 id="cancel-title">{L.account.confirmTitle}</h3>
            <div className="lm-summary">
              <strong>{rooms.find((r) => r.id === confirming.roomId)?.name ?? "?"}</strong>
              <div>{L.account.fullName}: {confirming.guestName}</div>
              <div>{fmtDate(confirming.checkIn)} → {fmtDate(confirming.checkOut)} · {nightsBetween(confirming.checkIn, confirming.checkOut)} {L.booking.nights}</div>
              <div>{money(confirming.total)}</div>
            </div>
            <p className="lm-muted">{confirming.status === "confirmed" ? L.account.confirmConfirmed : L.account.confirmPending}</p>
            {cancelErr && <p className="lm-err">{cancelErr}</p>}
            <button className="lm-btn" onClick={() => setConfirming(null)} disabled={cancelling}>{L.account.keep}</button>
            <button className="lm-link lm-danger" onClick={doCancel} disabled={cancelling}>{cancelling ? L.account.cancelling : L.account.doCancel}</button>
          </div>
        </div>
      )}
    </div>
  );
}
