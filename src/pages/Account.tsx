import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useMoney } from "../lib/useRate";
import { useI18n, useL } from "../i18n";
import { fmtDate, nightsBetween, todayStr } from "../lib/format";
import type { Booking, Room } from "../lib/types";
import { tgNotify } from "../lib/telegram";
import CheckinModal, { type Precheckin } from "../landing/CheckinModal";
import { useProfileDoc } from "../lib/profile";
import { useG } from "../i18n/guest";
import TierBadge from "../components/TierBadge";
import { loyaltyClaim, tgGuestLink } from "../lib/telegram";
import QrCode from "../components/QrCode";
import { bookingCode } from "../lib/banks";
import { useMyTier } from "../lib/loyalty";
import { fillP } from "../i18n/pricing";
import { useP } from "../i18n/pricing";
import { useBank, usePricingConfig } from "../lib/usePricing";
import { daysUntil, refundPercentFor } from "../lib/pricing";
import PayPanel from "../landing/PayPanel";
import SiteLayout from "../layout/SiteLayout";

export default function Account() {
  const L = useL();
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const G = useG();
  const P = useP();
  const my = useMyTier(user?.uid);
  const [tgLinked, setTgLinked] = useState<boolean | null>(null);
  const [tgLink, setTgLink] = useState("");
  const [tgBusy, setTgBusy] = useState(false);
  const [tgErr, setTgErr] = useState("");
  useEffect(() => {
    if (!user) return;
    return onSnapshot(query(collection(db, "tgGuests"), where("uid", "==", user.uid)), (s) => setTgLinked(!s.empty), () => setTgLinked(null));
  }, [user]);
  const [claim, setClaim] = useState<{ code: string; percent: number; expiresAt: number } | null>(null);
  const [claimErr, setClaimErr] = useState("");
  const [claiming, setClaiming] = useState(false);
  const { cfg } = usePricingConfig();
  const bank = useBank(!!user);
  const [payFor, setPayFor] = useState<Booking | null>(null);
  const { profile: myProfile } = useProfileDoc(user?.uid);
  const [pres, setPres] = useState<Precheckin[]>([]);
  const [checkinFor, setCheckinFor] = useState<Booking | null>(null);
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

  // Check-in online của tôi (mỗi đặt phòng một bản, id = mã đặt phòng).
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(query(collection(db, "precheckins"), where("uid", "==", uid)),
      (snap) => setPres(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as Precheckin)), (e) => console.error("my checkins", e));
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
      w.update(doc(db, "bookings", confirming.id), { status: "cancelled", cancelReason: "customer", cancelledAt: serverTimestamp() });
      w.delete(doc(db, "busy", confirming.id));
      if (confirming.slotId) w.delete(doc(db, "pend", confirming.slotId));
      await w.commit();
      tgNotify("cancel", confirming.id);
      setConfirming(null);
    } catch (ex) {
      console.error("cancel failed", ex);
      setCancelErr(L.account.cancelFailed);
    } finally { setCancelling(false); }
  };

  return (
    <SiteLayout>
      <main className="lp-page lp-account">
      <div className="lp-wrap">
        <h1 className="lp-account-title">{L.account.title}</h1>
        <p className="lp-muted">{user.displayName || user.email}<TierBadge tier={my.cfg.enabled ? my.tier : null} /></p>
        {my.cfg.enabled && my.tier && (
          <div className="lp-panel lp-perks">
            <h3>{G.perks}</h3>
            <div>{G.perksTier}: <TierBadge tier={my.tier} /> · {G.perksStays}: <b>{my.count}</b></div>
            <div className="lp-muted lp-small">{my.next ? fillP(G.perksNext, { n: my.next.minBookings - my.count, t: my.next.name }) : G.perksTop}</div>
            {(() => {
              const mine = my.member?.claimed?.[my.tier.id];
              if (my.tier.couponPercent <= 0) return <div className="lp-muted lp-small">{G.perksNone}</div>;
              if (mine || claim) return <div className="lp-ok">{G.perksCode}: <b>{claim?.code ?? mine}</b>{claim ? ` (−${claim.percent}%, ${G.perksExpires} ${fmtDate(new Date(claim.expiresAt).toISOString().slice(0, 10))})` : ""}</div>;
              return (
                <div>
                  <button className="lp-btn primary sm" disabled={claiming} onClick={async () => {
                    setClaiming(true); setClaimErr("");
                    try { setClaim(await loyaltyClaim()); } catch (ex) { console.error("claim", ex); setClaimErr(G.perksFail); } finally { setClaiming(false); }
                  }}>{fillP(G.perksClaim, { p: my.tier.couponPercent, t: my.tier.name })}</button>
                  {claimErr && <p className="lp-error">{claimErr}</p>}
                </div>
              );
            })()}
          </div>
        )}

        {tgLinked !== null && (
          <div className="lp-panel lp-tg">
            <h3>{G.tgTitle}</h3>
            {tgLinked ? <div className="lp-ok">✅ {G.tgLinked}</div> : (
              <>
                <div className="lp-muted lp-small">{G.tgDesc}</div>
                <div>
                  {tgLink
                    ? <a className="lp-btn primary sm" href={tgLink} target="_blank" rel="noopener noreferrer">{G.tgOpen}</a>
                    : <button className="lp-btn primary sm" disabled={tgBusy} onClick={async () => {
                      setTgBusy(true); setTgErr("");
                      try { setTgLink((await tgGuestLink()).link); } catch (ex) { console.error("tg link", ex); setTgErr(G.tgFail); } finally { setTgBusy(false); }
                    }}>{G.tgBtn}</button>}
                </div>
                {tgErr && <p className="lp-error">{tgErr}</p>}
              </>
            )}
          </div>
        )}

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
              {(b.deposit ?? 0) > 0 && <div className="lp-small">{P.deposit}: {money(b.deposit!)} · {P.paid}: {money(b.paid ?? 0)}{(b.paid ?? 0) < b.deposit! && ["pending", "confirmed"].includes(b.status) && !stale ? <b className="lp-warn"> · {P.depositDue}</b> : null}</div>}
              {(b.paid ?? 0) > 0 && b.status !== "cancelled" && <div className="lp-small lp-muted">{P.balance}: {money(Math.max(0, b.total - (b.paid ?? 0)))}</div>}
              {b.status === "cancelled" && (b.paid ?? 0) > 0 && (() => {
                const at = b.cancelledAt ? new Date(b.cancelledAt.toMillis()).toISOString().slice(0, 10) : todayStr();
                const pct = refundPercentFor(daysUntil(at, b.checkIn), cfg.cancelTiers);
                return <div className="lp-small">{P.refundDue}: <b>{money(Math.round((b.paid ?? 0) * pct / 100))}</b> ({pct}%)</div>;
              })()}
              {pres.some((p) => p.id === b.id) && <div className="lp-small lp-ok">✓ {G.checkinSent}</div>}
              {b.status === "confirmed" && !stale && (
                <details className="lp-qr">
                  <summary>{G.qrTitle}</summary>
                  <QrCode value={`${window.location.origin}/app/bookings?b=${b.id}`} label={G.qrTitle} />
                  <span className="lp-muted lp-small">{G.qrHint} · {bookingCode(b.id)}</span>
                </details>
              )}
            </div>
            <div className="lp-booking-side">
              <span className={`lp-status ${expired ? "cancelled" : b.status}`}>{expired ? L.account.expired : t(b.status)}</span>
              {(b.deposit ?? 0) > 0 && (b.paid ?? 0) < b.deposit! && ["pending", "confirmed"].includes(b.status) && !stale && (
                <button className="lp-pill solid" onClick={() => setPayFor(b)}>{P.payNow}</button>
              )}
              {b.status !== "cancelled" && !stale && <Link className="lp-pill" to={`/invoice/${b.id}`}>{P.invoice}</Link>}
              {((b.status === "pending" && !stale) || b.status === "confirmed") && (
                <button className="lp-pill solid" onClick={() => setCheckinFor(b)}>{pres.some((p) => p.id === b.id) ? G.checkinEdit : G.checkinBtn}</button>
              )}
              {((b.status === "pending" && !stale) || b.status === "confirmed") && (
                <button className="lp-pill" onClick={() => { setCancelErr(""); setConfirming(b); }}>{L.account.cancel}</button>
              )}
            </div>
          </div>
          );
        })}
        {sorted.some((b) => b.status === "checked_in") && <p className="lp-muted lp-small">{L.account.contactToChange}</p>}
      </div>

      {payFor && (
        <div className="lm-overlay" onClick={() => setPayFor(null)} role="dialog" aria-modal="true">
          <div className="lm-modal" onClick={(e) => e.stopPropagation()}>
            <button className="lm-x" onClick={() => setPayFor(null)} aria-label={G.close}>×</button>
            <PayPanel bank={bank} amount={Math.max(0, (payFor.deposit ?? 0) - (payFor.paid ?? 0))} bookingId={payFor.id} />
          </div>
        </div>
      )}
      {checkinFor && user && <CheckinModal booking={checkinFor} existing={pres.find((p) => p.id === checkinFor.id)} base={myProfile} uid={user.uid} onClose={() => setCheckinFor(null)} />}
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
            {(confirming.paid ?? 0) > 0 && (() => {
              const pct = refundPercentFor(daysUntil(todayStr(), confirming.checkIn), cfg.cancelTiers);
              return <p className="lm-muted">{P.refundDue}: <b>{money(Math.round((confirming.paid ?? 0) * pct / 100))}</b> ({pct}%)</p>;
            })()}
            {cancelErr && <p className="lm-err">{cancelErr}</p>}
            <button className="lm-btn" onClick={() => setConfirming(null)} disabled={cancelling}>{L.account.keep}</button>
            <button className="lm-link lm-danger" onClick={doCancel} disabled={cancelling}>{cancelling ? L.account.cancelling : L.account.doCancel}</button>
          </div>
        </div>
      )}
      </main>
    </SiteLayout>
  );
}
