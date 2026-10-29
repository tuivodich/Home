import { tgNotify } from "../lib/telegram";
import { DEFAULT_MAX_PENDING } from "../lib/theme";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { EMPTY_PROFILE, useProfileDoc, type Profile } from "../lib/profile";
import { useBank, usePricingConfig } from "../lib/usePricing";
import { lineLabel, quoteLines, quoteStay } from "../lib/pricing";
import { fillP, policyLines, useP } from "../i18n/pricing";
import PayPanel from "./PayPanel";
import { bookingCode } from "../lib/banks";
import { useG } from "../i18n/guest";
import DateInput from "../components/DateInput";
import CountrySelect from "../components/CountrySelect";
import { Link } from "react-router-dom";
import { collection, doc, getDoc, getDocs, query, serverTimestamp, where, writeBatch } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";
import { useI18n, useL } from "../i18n";
import { useMoney } from "../lib/useRate";
import { addDays, nightsBetween, todayStr } from "../lib/format";
import type { Busy, Coupon, Room, UserDoc } from "../lib/types";
import { rangeState, type Search } from "./availability";
import NumInput from "../components/NumInput";

const CODE_RE = /^[A-Z0-9-]{3,32}$/;

export default function BookingModal({ room, search, user, profile, busy, onClose }: {
  room: Room; search: Search; user: User; profile: UserDoc | null; busy: Busy[]; onClose: () => void;
}) {
  const L = useL();
  const { lang } = useI18n();
  const G = useG();
  const P = useP();
  const { pricing, cfg } = usePricingConfig();
  const bank = useBank(true);
  const [svc, setSvc] = useState<Record<string, number>>({});
  const [early, setEarly] = useState(false);
  const [late, setLate] = useState(false);
  const [doneId, setDoneId] = useState("");
  const { money } = useMoney();
  const { profile: saved, loading: profLoading } = useProfileDoc(user.uid);
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
  // Check-in online (tùy chọn): giấy tờ, ngày sinh, quốc tịch, giờ đến dự kiến; có thể lưu luôn vào Tài khoản của tôi.
  const [ci, setCi] = useState<Profile>({ ...EMPTY_PROFILE });
  const [eta, setEta] = useState("");
  const [saveToAccount, setSaveToAccount] = useState(true);
  const [sentCheckin, setSentCheckin] = useState(false);
  const seeded = useRef(false);
  // Điền sẵn từ "Tài khoản của tôi" một lần khi đọc xong; mọi ô vẫn sửa được.
  useEffect(() => {
    if (profLoading || seeded.current) return;
    seeded.current = true;
    if (!saved) return;
    if (saved.fullName) setName(saved.fullName);
    if (saved.phone) setPhone(saved.phone);
    if (saved.email) setEmail(saved.email);
    setCi({ ...EMPTY_PROFILE, docType: saved.docType, docNumber: saved.docNumber, nationality: saved.nationality || EMPTY_PROFILE.nationality, dob: saved.dob });
  }, [profLoading, saved]);

  // Giá tính theo bảng giá (cuối tuần/mùa/lễ/ở dài ngày), phụ thu và dịch vụ; mã giảm giá áp lên tiền ở.
  const quote = quoteStay(room, checkIn, checkOut, guests, pricing, cfg, { early, late, services: svc, couponPercent: coupon?.percent });
  const original = quote.originalTotal;
  const total = quote.total;
  const activeSvc = cfg.services.filter((s) => s.active);

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
        code: bookingCode(id), lines: quoteLines(quote, room.name),
        ...(early || late || Object.values(svc).some((n) => n > 0) ? { opts: { ...(early ? { early: true } : {}), ...(late ? { late: true } : {}), services: Object.fromEntries(Object.entries(svc).filter(([, n]) => n > 0)) } } : {}), ...(quote.deposit > 0 ? { deposit: quote.deposit } : {}),
        status: "pending", note: note.trim(), source: "online", createdBy: user.uid, slotId,
        ...(coupon ? { couponCode: coupon.code, discountPercent: coupon.percent, originalTotal: original } : {}),
      });
      // Bản sao công khai (không có dữ liệu cá nhân) để mọi người thấy phòng đang được giữ chỗ.
      b.set(doc(db, "busy", id), { roomId: room.id, checkIn, checkOut, status: "pending" });
      // Đánh dấu mã đã dùng trong CÙNG lần ghi: nếu ai đó vừa dùng mã này, cả đặt phòng bị từ chối (không thể dùng 2 lần).
      const wantsCheckin = !!ci.docNumber.trim();
      if (wantsCheckin) {
        b.set(doc(db, "precheckins", id), {
          uid: user.uid, bookingId: id, fullName: name.trim(), docType: ci.docType, docNumber: ci.docNumber.trim(), nationality: ci.nationality.trim(),
          dob: ci.dob, phone: phone.trim(), email: email.trim(), eta, note: "", status: "submitted", updatedAt: serverTimestamp(),
        });
      }
      if (saveToAccount && name.trim()) {
        b.set(doc(db, "profiles", user.uid), {
          fullName: name.trim(), docType: ci.docType, docNumber: ci.docNumber.trim(), nationality: ci.nationality.trim(), dob: ci.dob,
          phone: phone.trim(), email: email.trim(), updatedAt: serverTimestamp(),
        });
      }
      if (coupon) b.update(doc(db, "coupons", coupon.code), { used: true, usedBy: user.uid, usedAt: serverTimestamp(), bookingId: id });
      await b.commit();
      tgNotify("booking", id);
      setDoneId(id);
      setSentCheckin(wantsCheckin);
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
            {sentCheckin && <p className="lm-ok">✓ {G.checkinDone}</p>}
            {quote.deposit > 0 && <PayPanel bank={bank} amount={quote.deposit} bookingId={doneId} />}
            <Link className="lm-btn" to="/account">{L.modal.viewMine}</Link>
            <button className="lm-link" onClick={onClose}>{L.modal.cancel}</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3>{L.modal.title}</h3>
            <div className="lm-summary">
              <strong>{room.name}</strong>
              <div>{nights > 0 ? `${nights} ${L.booking.nights}` : "—"} · {fillP(P.checkInFrom, { t: cfg.checkInTime })} · {fillP(P.checkOutBefore, { t: cfg.checkOutTime })}</div>
              {nights > 0 && (
                <div className="price-table" aria-label={P.breakdown}>
                  {quoteLines(quote, room.name).map((l, i) => <div key={i} className={l.amount < 0 ? "neg" : ""}><span>{lineLabel(l, lang)}</span><span>{l.amount < 0 ? "−" : ""}{money(Math.abs(l.amount))}</span></div>)}
                  <div className="sum"><span>{coupon ? L.modal.total : L.booking.estimate}{coupon && <> <span className="lm-off">−{coupon.percent}%</span></>}</span><b>{money(total)}</b></div>
                  {quote.deposit > 0 && <div><span>{P.deposit} ({cfg.depositPercent}%) — {P.depositNote}</span><b>{money(quote.deposit)}</b></div>}
                  {quote.deposit > 0 && <div><span>{P.balance} — {P.dueAtArrival}</span><span>{money(total - quote.deposit)}</span></div>}
                </div>
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
            <label>{L.modal.guests}<NumInput min={1} max={room.capacity} value={guests} onChange={(e) => setGuests(Math.max(1, Math.min(room.capacity, +e.target.value || 1)))} /></label>
            {(activeSvc.length > 0 || cfg.earlyCheckInFee > 0 || cfg.lateCheckOutFee > 0) && (
              <details className="lm-addons" open={Object.values(svc).some((n) => n > 0) || early || late}>
                <summary>{P.addons}</summary>
                <p className="lm-muted lm-small">{P.addonsHint}</p>
                {cfg.earlyCheckInFee > 0 && <label className="lm-check"><input type="checkbox" checked={early} onChange={(e) => setEarly(e.target.checked)} /><span>{P.early} (+{money(cfg.earlyCheckInFee)})</span></label>}
                {cfg.lateCheckOutFee > 0 && <label className="lm-check"><input type="checkbox" checked={late} onChange={(e) => setLate(e.target.checked)} /><span>{P.late} (+{money(cfg.lateCheckOutFee)})</span></label>}
                {activeSvc.map((s) => (
                  <label className="lm-addon" key={s.id}>
                    <span>{s.name}<br /><small>{money(s.price)} {s.unit === "night" ? P.perNight : P.perUse}</small></span>
                    <NumInput min={0} max={20} value={svc[s.id] ?? 0} onChange={(e) => setSvc({ ...svc, [s.id]: Math.max(0, Math.min(20, Math.floor(+e.target.value || 0))) })} />
                  </label>
                ))}
              </details>
            )}
            <details className="lm-policy">
              <summary>{P.policy}</summary>
              <ul>{policyLines(P, cfg, (n) => `${n.toLocaleString("vi-VN")} VNĐ`, room.baseGuests ?? room.capacity).map((l, i) => <li key={i}>{l}</li>)}</ul>
            </details>
            <details className="lm-checkin">
              <summary>{G.checkinTitle}</summary>
              <p className="lm-muted lm-small">{G.checkinHint}</p>
              <label>{G.docType}
                <select value={ci.docType} onChange={(e) => setCi({ ...ci, docType: e.target.value as Profile["docType"] })}>
                  {(["cccd", "passport", "license", "other"] as const).map((k) => <option key={k} value={k}>{G[k]}</option>)}
                </select>
              </label>
              <label>{G.docNumber}<input maxLength={30} value={ci.docNumber} onChange={(e) => setCi({ ...ci, docNumber: e.target.value })} /></label>
              <label>{G.nationality}<CountrySelect value={ci.nationality} onChange={(v) => setCi({ ...ci, nationality: v })} /></label>
              <label>{G.dob}<DateInput value={ci.dob} onChange={(v) => setCi({ ...ci, dob: v })} /></label>
              <label>{G.eta}<input inputMode="numeric" maxLength={5} placeholder={G.etaPh} pattern="([01][0-9]|2[0-3]):[0-5][0-9]|" value={eta} onChange={(e) => setEta(e.target.value)} /></label>
              <label className="lm-check"><input type="checkbox" checked={saveToAccount} onChange={(e) => setSaveToAccount(e.target.checked)} /><span>{G.saveToAccount}</span></label>
            </details>
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
