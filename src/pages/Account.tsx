import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { collection, doc, onSnapshot, query, where, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useMoney } from "../lib/useRate";
import { useI18n, useL } from "../i18n";
import { nightsBetween, todayStr } from "../lib/format";
import { isStaffRole, type Booking, type Room } from "../lib/types";
import "../landing/landing.css";

export default function Account() {
  const L = useL();
  const { t, lang, setLang } = useI18n();
  const { user, profile, loading, logout } = useAuth();
  const { money } = useMoney();
  const { data: rooms } = useCollection<Room>("rooms");
  const [mine, setMine] = useState<Booking[]>([]);
  const [fetching, setFetching] = useState(true);
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(query(collection(db, "bookings"), where("createdBy", "==", uid)), (snap) => {
      setMine(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as Booking));
      setFetching(false);
    }, (e) => { console.error("my bookings", e); setFetching(false); });
  }, [uid]);

  const sorted = useMemo(() => [...mine].sort((a, b) => b.checkIn.localeCompare(a.checkIn)), [mine]);

  if (loading) return <div className="center">{t("loading")}</div>;
  if (!user) return <Navigate to="/?login=1" replace />;

  const cancel = async (b: Booking) => {
    if (!confirm(L.account.sure)) return;
    const w = writeBatch(db);
    w.update(doc(db, "bookings", b.id), { status: "cancelled" });
    w.delete(doc(db, "busy", b.id));
    await w.commit();
  };

  return (
    <div className="landing lp-account">
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
              <div>{b.checkIn} → {b.checkOut} · {nightsBetween(b.checkIn, b.checkOut)} {L.booking.nights}</div>
              <div className="lp-muted">{money(b.total)} · 👤 {b.guests}</div>
              {b.couponCode && <div className="lp-muted lp-small">🏷 {b.couponCode} (−{b.discountPercent}%)</div>}
            </div>
            <div className="lp-booking-side">
              <span className={`lp-status ${expired ? "cancelled" : b.status}`}>{expired ? L.account.expired : t(b.status)}</span>
              {b.status === "pending" && !stale && <button className="lp-pill" onClick={() => cancel(b)}>{L.account.cancel}</button>}
            </div>
          </div>
          );
        })}
        {sorted.some((b) => b.status !== "pending" && b.status !== "cancelled") && <p className="lp-muted lp-small">{L.account.contactToChange}</p>}
      </div>
    </div>
  );
}
