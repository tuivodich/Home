import { tgNotify } from "../lib/telegram";
import { DEFAULT_MAX_PENDING } from "../lib/theme";
import { useState, type FormEvent } from "react";
import DateInput from "../components/DateInput";
import { Link } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";
import { useL } from "../i18n";
import { useMoney } from "../lib/useRate";
import { addDays, nightsBetween, todayStr } from "../lib/format";
import type { Busy, Coupon, Room, UserDoc } from "../lib/types";
import { rangeState, type Search } from "./availability";

const CODE_RE = /^[A-Z0-9-]{3,32}$/;

export default function BookingModal({ room, search, user, profile, busy, onClose }: {
  room: Room; search: Search; user: User; profile: UserDoc | null; busy: Busy[]; onClose: () => void;
}) {
  const L = useL();
  const { money } = useMoney();
  // Khách có thể đổi ngày ngay trong hộp thoại; giá và tình trạng phòng tính lại theo ngày mới.
  const [checkIn, setCheckIn] = useState(search.checkIn);
  const [checkOut, setCheckOut] = useState(search.checkOut);
  const nights = nightsBetween(checkIn, checkOut);
  const dateError = !checkIn || !checkOut || nights < 1 ? L.booking.errDates : checkIn < todayStr() ? L.booking.errPast : nights > 30 ? L.booking.errLong : "";
  const unavailable = !dateError && rangeState(room, busy, checkIn, checkOut) !== "free";
  const [name, setName] = useState(profile?.name || user.displayName || "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user.email ?? "");
  const [guests, setGuests] = useState(Math.min(search.guests, room.capacity));
  const [note, setNote] = useState("");
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; percent: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [err, setErr] = useState("");
  const [busyNow, setBusyNow] = useState(false);
  const [done, setDone] = useState(false);

  const original = nights > 0 ? room.price * nights : 0;
  const total = coupon ? Math.round(original * (100 - coupon.percent) / 100) : original;

  const applyCoupon = async () => {
    const c = code.trim().toUpperCase();
    setCouponMsg(""); setCoupon(null);
    if (!c) return;
    if (!CODE_RE.test(c)) return setCouponMsg(L.modal.couponGone);
    try {
      const snap = await getDoc(doc(db, "coupons", c));
      if (!snap.exists()) return setCouponMsg(L.modal.couponGone);
      const d = snap.data() as Coupon;
      if (d.used) return setCouponMsg(L.modal.couponUsed);
      if (d.expiresAt && d.expiresAt.toMillis() < Date.now()) return setCouponMsg(L.modal.couponExpired);
      setCode(c);
      setCoupon({ code: c, percent: d.percent });
    } catch { setCouponMsg(L.modal.couponGone); }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    // Kiểm tra lại trên dữ liệu mới nhất phòng vừa bị giữ chỗ hay chưa.
    if (dateError) return setErr(dateError);
    if (rangeState(room, busy, checkIn, checkOut) !== "free") return setErr(L.modal.clash);
    setBusyNow(true);
    try {
      // Giới hạn số yêu cầu đang chờ xác nhận mỗi tài khoản (chủ/quản lý chỉnh ở Cài đặt): mỗi yêu cầu giữ một "khe" pend/{uid}_{n}.
      const max = (await getDoc(doc(db, "settings", "app"))).data()?.maxPending;
      const limit = typeof max === "number" && max >= 1 ? max : DEFAULT_MAX_PENDING;
      const used = new Set((await getDocs(query(collection(db, "pend"), where("uid", "==", user.uid)))).docs.map((d) => d.data().n as number));
      let n = 1;
      while (used.has(n)) n++;
      if (n > limit) { setErr(L.modal.limitReached.replace("{n}", String(limit))); return; }
      const id = doc(collection(db, "bookings")).id;
      const slotId = `${user.uid}_${n}`;
      const b = writeBatch(db);
      b.set(doc(db, "pend", slotId), { uid: user.uid, n, bookingId: id });
      b.set(doc(db, "bookings", id), {
        roomId: room.id, guestName: name.trim(), phone: phone.trim(), email: email.trim(),
        checkIn, checkOut, guests, total,
        status: "pending", note: note.trim(), source: "online", createdBy: user.uid, slotId,
        ...(coupon ? { couponCode: coupon.code, discountPercent: coupon.percent, originalTotal: original } : {}),
      });
      // Bản sao công khai (không có dữ liệu cá nhân) để mọi người thấy phòng đang được giữ chỗ.
      b.set(doc(db, "busy", id), { roomId: room.id, checkIn, checkOut, status: "pending" });
      // Đánh dấu mã đã dùng trong CÙNG lần ghi: nếu ai đó vừa dùng mã này, cả đặt phòng bị từ chối (không thể dùng 2 lần).
      if (coupon) b.update(doc(db, "coupons", coupon.code), { used: true, usedBy: user.uid, usedAt: serverTimestamp(), bookingId: id });
      await b.commit();
      tgNotify("booking", id);
      setDone(true);
    } catch (ex) {
      console.error("booking failed", ex);
      if (coupon && (ex as { code?: string }).code === "permission-denied") { setCoupon(null); setErr(L.modal.couponRace); }
      else setErr(L.modal.err);
    } finally { setBusyNow(false); }
  };

  return (
    <div className="lm-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="lm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="lm-x" onClick={onClose} aria-label={L.modal.cancel}>×</button>
        {done ? (
          <div className="lm-done">
            <div className="lm-tick">✓</div>
            <h3>{L.modal.doneTitle}</h3>
            <p>{L.modal.doneText}</p>
            <Link className="lm-btn" to="/account">{L.modal.viewMine}</Link>
            <button className="lm-link" onClick={onClose}>{L.modal.cancel}</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3>{L.modal.title}</h3>
            <div className="lm-summary">
              <strong>{room.name}</strong>
              <div>{nights > 0 ? `${nights} ${L.booking.nights}` : "—"}</div>
              {coupon ? (
                <>
                  <div>{L.modal.original}: <s>{money(original)}</s></div>
                  <div>{L.modal.total}: <b>{money(total)}</b> <span className="lm-off">−{coupon.percent}%</span></div>
                </>
              ) : (
                <div>{L.booking.estimate}: <b>{money(original)}</b></div>
              )}
            </div>
            <div className="lm-dates">
              <label>{L.search.checkIn}
                <DateInput required min={todayStr()} value={checkIn}
                  onChange={(v) => { setCheckIn(v); if (v && checkOut <= v) setCheckOut(addDays(v, 1)); setErr(""); }} />
              </label>
              <label>{L.search.checkOut}
                <DateInput required min={addDays(checkIn || todayStr(), 1)} value={checkOut} onChange={(v) => { setCheckOut(v); setErr(""); }} />
              </label>
            </div>
            {dateError && <p className="lm-err">{dateError}</p>}
            {unavailable && <p className="lm-err">{L.modal.datesUnavailable}</p>}
            <label><span>{L.modal.name} <em className="lm-secret">{L.modal.secret}</em></span>
              <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>{L.modal.phone}<input required type="tel" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
            <label>{L.modal.email}<input required type="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label>{L.modal.guests}<input type="number" min={1} max={room.capacity} value={guests} onChange={(e) => setGuests(Math.max(1, Math.min(room.capacity, +e.target.value || 1)))} /></label>
            <div>
              <label>{L.modal.coupon}
                <div className="lm-coupon">
                  <input value={code} placeholder={L.modal.couponPh} maxLength={32} disabled={!!coupon}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCoupon(); } }} />
                  {coupon
                    ? <button type="button" className="lm-ghost" onClick={() => { setCoupon(null); setCode(""); setCouponMsg(""); }}>{L.modal.remove}</button>
                    : <button type="button" className="lm-ghost" onClick={applyCoupon}>{L.modal.apply}</button>}
                </div>
              </label>
              {coupon && <p className="lm-ok">✓ {L.modal.couponOk} {coupon.percent}%</p>}
              {couponMsg && <p className="lm-err">{couponMsg}</p>}
            </div>
            <label>{L.modal.note}<textarea maxLength={500} rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            {err && <p className="lm-err">{err}</p>}
            <button className="lm-btn" type="submit" disabled={busyNow || !!dateError || unavailable}>{busyNow ? L.modal.sending : L.modal.send}</button>
            <p className="lm-muted lm-small">{L.booking.final}</p>
          </form>
        )}
      </div>
    </div>
  );
}
