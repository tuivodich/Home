import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useMoney } from "../lib/useRate";
import { useAuth } from "../lib/auth";
import { useI18n } from "../i18n";
import { addDays, nightsBetween, overlaps, todayStr } from "../lib/format";
import { checkCoupon, discounted, type CouponCheck } from "../lib/coupons";
import GuestFields, { conflictsFor, emptyGuestForm, type GuestForm } from "../components/GuestFields";
import type { Booking, BookingStatus, Guest, Room } from "../lib/types";

interface PriceEdit { id: string; total: number; code: string; coupon: { code: string; percent: number } | null; msg: string; busy: boolean }

export default function Bookings() {
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === "owner" || profile?.role === "manager";
  const navigate = useNavigate();
  const { money } = useMoney();
  const { data: rooms } = useCollection<Room>("rooms");
  const { data: bookings } = useCollection<Booking>("bookings");
  const { data: guests, loading: guestsLoading } = useCollection<Guest>("guests");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [g, setG] = useState<GuestForm>({ ...emptyGuestForm });
  const [file, setFile] = useState<File | null>(null);
  const [f, setF] = useState({ roomId: "", checkIn: todayStr(), checkOut: addDays(todayStr(), 1), guests: 2, total: 0, note: "" });
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<{ code: string; percent: number } | null>(null);
  const [couponMsg, setCouponMsg] = useState("");
  const [pe, setPe] = useState<PriceEdit | null>(null);

  const today = todayStr();
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? "?";
  const nights = nightsBetween(f.checkIn, f.checkOut);
  const room = rooms.find((r) => r.id === f.roomId);
  const suggested = room ? room.price * Math.max(nights, 0) : 0;
  const base = f.total || suggested;
  const finalTotal = coupon ? discounted(base, coupon.percent) : base;

  const couponError = (c: Extract<CouponCheck, { ok: false }>) =>
    c.reason === "used" ? t("couponUsed") : c.reason === "expired" ? t("couponExpired") : t("couponNotFound");

  const applyCode = async () => {
    setCouponMsg(""); setCoupon(null);
    if (!code.trim()) return;
    const c = await checkCoupon(code);
    if (c.ok) { setCoupon({ code: c.code, percent: c.percent }); setCode(c.code); } else setCouponMsg(couponError(c));
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setErr(""); setNotice("");
    if (nights < 1) return setErr(t("badDates"));
    if (file && !g.docNumber.trim()) return setErr(t("photoNeedsNumber"));
    const clash = bookings.some((b) => b.roomId === f.roomId && b.status !== "cancelled"
      && overlaps(b.checkIn, b.checkOut, f.checkIn, f.checkOut));
    if (clash) return setErr(t("overlap"));
    setBusy(true);
    try {
      const uid = user?.uid ?? "";
      const bRef = doc(collection(db, "bookings"));
      const w = writeBatch(db);
      w.set(bRef, {
        roomId: f.roomId, guestName: g.fullName.trim(), phone: g.phone.trim(), email: g.email.trim(),
        checkIn: f.checkIn, checkOut: f.checkOut, guests: f.guests, total: finalTotal, note: f.note,
        status: "confirmed", source: "staff", createdBy: uid,
        ...(coupon ? { couponCode: coupon.code, discountPercent: coupon.percent, originalTotal: base } : {}),
      });
      // Có số giấy tờ → tạo luôn hồ sơ khách lưu trú gắn với đặt phòng này (giống trang Khách lưu trú).
      const gRef = g.docNumber.trim() ? doc(collection(db, "guests")) : null;
      if (gRef) w.set(gRef, { ...g, fullName: g.fullName.trim(), bookingId: bRef.id, docImagePath: "" });
      if (coupon) w.update(doc(db, "coupons", coupon.code), { used: true, usedBy: uid, usedAt: serverTimestamp(), bookingId: bRef.id });
      await w.commit();
      let warn = "";
      if (gRef) {
        const dup = conflictsFor(guests, g.docType, g.docNumber, g.fullName).other;
        if (dup.length) warn = `${t("dupSaved")}: ${dup.map((x) => x.fullName).join(", ")} (${g.docNumber})`;
        if (file) {
          const path = `guests/${gRef.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
          try {
            await uploadBytes(ref(storage, path), file, { contentType: file.type });
            await updateDoc(gRef, { docImagePath: path });
          } catch (ex) {
            console.error("upload failed", ex);
            warn = `${t("uploadFailed")}: ${(ex as { code?: string }).code ?? ""}`;
          }
        }
      }
      setNotice(warn);
      setG({ ...emptyGuestForm }); setFile(null); setCode(""); setCoupon(null); setCouponMsg("");
      setF({ ...f, total: 0, note: "" });
    } catch (ex) {
      console.error("create booking failed", ex);
      setErr(t("error"));
    } finally { setBusy(false); }
  };

  const setStatus = (id: string, status: BookingStatus) => updateDoc(doc(db, "bookings", id), { status });

  // Xác nhận yêu cầu online: không được trùng với đặt phòng đã xác nhận / đang ở của cùng phòng.
  const approve = (b: Booking) => {
    const clash = bookings.some((o) => o.id !== b.id && o.roomId === b.roomId
      && ["confirmed", "checked_in", "checked_out"].includes(o.status) && overlaps(o.checkIn, o.checkOut, b.checkIn, b.checkOut));
    if (clash) return alert(t("confirmClash"));
    return setStatus(b.id, "confirmed");
  };

  const hasProfile = (b: Booking) => guests.some((x) => x.bookingId === b.id);

  // Bắt buộc có hồ sơ khách (giấy tờ) rồi mới cho nhận phòng; nếu chưa có thì chuyển sang form tạo hồ sơ.
  const checkIn = async (b: Booking) => {
    if (guestsLoading) return;
    if (!hasProfile(b)) {
      alert(t("needGuestProfile"));
      navigate(`/app/guests?booking=${b.id}`);
      return;
    }
    await setStatus(b.id, "checked_in");
  };

  // Sửa giá (chủ/quản lý): đổi giá thuê hoặc áp mã giảm giá cho đặt phòng đã xác nhận / đang ở.
  const openPrice = (b: Booking) => setPe({ id: b.id, total: b.total, code: "", coupon: null, msg: "", busy: false });
  const savePrice = async (b: Booking) => {
    if (!pe || pe.total < 0) return;
    setPe({ ...pe, busy: true });
    await updateDoc(doc(db, "bookings", b.id), { total: pe.total, priceEditedBy: user?.uid ?? "" });
    setPe(null);
  };
  const applyPriceCode = async (b: Booking) => {
    if (!pe) return;
    const c = await checkCoupon(pe.code);
    if (!c.ok) return setPe({ ...pe, coupon: null, msg: couponError(c) });
    setPe({ ...pe, coupon: { code: c.code, percent: c.percent }, code: c.code, msg: "" });
    void b;
  };
  const redeemOnBooking = async (b: Booking) => {
    if (!pe?.coupon) return;
    setPe({ ...pe, busy: true });
    const price = pe.total; // giảm trên giá thuê hiện tại (đã chỉnh nếu có)
    try {
      const w = writeBatch(db);
      w.update(doc(db, "bookings", b.id), {
        total: discounted(price, pe.coupon.percent), originalTotal: price, couponCode: pe.coupon.code, discountPercent: pe.coupon.percent, priceEditedBy: user?.uid ?? "",
      });
      w.update(doc(db, "coupons", pe.coupon.code), { used: true, usedBy: user?.uid ?? "", usedAt: serverTimestamp(), bookingId: b.id });
      await w.commit();
      setPe(null);
    } catch (ex) {
      console.error("redeem failed", ex);
      setPe({ ...pe, busy: false, coupon: null, msg: t("couponUsed") });
    }
  };

  const sorted = [...bookings].sort((a, b) => b.checkIn.localeCompare(a.checkIn));

  return (
    <section>
      <h2>{t("bookings")}</h2>
      {notice && <p className="warn">⚠ {notice}</p>}
      <form className="card" onSubmit={create}>
        <h3>{t("newBooking")}</h3>
        <label>{t("room")}
          <select required value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}>
            <option value="">—</option>
            {rooms.filter((r) => r.status === "active").map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <div className="row">
          <label>{t("checkIn")}<input type="date" required value={f.checkIn} onChange={(e) => setF({ ...f, checkIn: e.target.value })} /></label>
          <label>{t("checkOut")}<input type="date" required value={f.checkOut} onChange={(e) => setF({ ...f, checkOut: e.target.value })} /></label>
        </div>
        <label>{t("numGuests")}<input type="number" min={1} value={f.guests} onChange={(e) => setF({ ...f, guests: +e.target.value })} /></label>
        <h4 className="sub">{t("guestSection")}</h4>
        <GuestFields value={g} onChange={setG} guests={guests} file={file} onFile={setFile} docRequired={false} />
        <small>{t("guestSectionHint")}</small>
        <label>{t("total")} (₫) — {nights > 0 ? `${nights} ${t("nights")} = ${money(suggested)}` : ""}
          <input type="number" min={0} step={10000} placeholder={String(suggested)} value={f.total || ""} onChange={(e) => setF({ ...f, total: +e.target.value })} />
        </label>
        {isAdmin && (
          <div>
            <label>{t("coupons")}
              <div className="row">
                <input value={code} disabled={!!coupon} placeholder="NG20-XXXXXX" maxLength={32} onChange={(e) => setCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyCode(); } }} />
                {coupon
                  ? <button type="button" className="ghost" onClick={() => { setCoupon(null); setCode(""); }}>{t("removeCode")}</button>
                  : <button type="button" className="ghost" onClick={applyCode}>{t("applyCode")}</button>}
              </div>
            </label>
            {coupon && <p className="info">✓ −{coupon.percent}% · {money(base)} → <b>{money(finalTotal)}</b></p>}
            {couponMsg && <p className="error">{couponMsg}</p>}
          </div>
        )}
        <label>{t("note")}<input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        {err && <p className="error">{err}</p>}
        <button type="submit" disabled={busy}>{t("add")}</button>
      </form>

      {sorted.length === 0 && <p>{t("noData")}</p>}
      {sorted.map((b) => {
        const expired = b.status === "cancelled" && b.cancelReason === "expired";
        const editing = pe?.id === b.id ? pe : null;
        return (
          <div className="card" key={b.id}>
            <div className="row between">
              <strong>{b.guestName}{b.source === "online" && <small> · {t("online")}</small>}</strong>
              <span className={`tag ${b.status}`}>{expired ? t("expiredLabel") : t(b.status)}</span>
            </div>
            <div>{roomName(b.roomId)} · {b.checkIn} → {b.checkOut} ({nightsBetween(b.checkIn, b.checkOut)} {t("nights")})</div>
            <div>{money(b.total)}{b.priceEditedBy && <small> ✎</small>}{b.phone && ` · ${b.phone}`}{b.email && ` · ${b.email}`}</div>
            {b.couponCode && <small>🏷 {t("couponApplied")} {b.couponCode} (−{b.discountPercent}%){b.originalTotal ? ` · ${money(b.originalTotal)} → ${money(b.total)}` : ""}</small>}
            {b.note && <small>{b.note}</small>}
            {b.status === "pending" && b.checkIn < today && <p className="overdue">{t("overdueIn")}</p>}
            {b.status === "confirmed" && b.checkIn < today && <p className="overdue">{t("overdueIn")}</p>}
            {b.status === "checked_in" && b.checkOut < today && <p className="overdue">{t("overdueOut")}</p>}
            <div className="row">
              {b.status === "pending" && <button onClick={() => approve(b)}>{t("approve")}</button>}
              {b.status === "pending" && <button className="ghost danger" onClick={() => confirm(t("sure")) && setStatus(b.id, "cancelled")}>{t("reject")}</button>}
              {b.status === "confirmed" && <button onClick={() => checkIn(b)}>{t("doCheckIn")}</button>}
              {b.status === "checked_in" && <button onClick={() => setStatus(b.id, "checked_out")}>{t("doCheckOut")}</button>}
              {isAdmin && (b.status === "confirmed" || b.status === "checked_in") && !editing && (
                <button className="ghost" onClick={() => openPrice(b)}>💲 {t("editPrice")}</button>
              )}
              {(b.status === "confirmed" || b.status === "checked_in") && (
                <button className="ghost danger" onClick={() => confirm(t("sure")) && setStatus(b.id, "cancelled")}>{t("doCancel")}</button>
              )}
              {b.status !== "cancelled" && (hasProfile(b)
                ? <span className="info">{t("hasGuestProfile")}</span>
                : <Link className="ghost linkbtn" to={`/app/guests?booking=${b.id}`}>👤 {t("addGuestProfile")}</Link>)}
            </div>
            {editing && (
              <div className="pricebox">
                <label>{t("rentPrice")} (₫)
                  <div className="row">
                    <input type="number" min={0} step={10000} value={editing.total} onChange={(e) => setPe({ ...editing, total: +e.target.value, coupon: null })} />
                    <button onClick={() => savePrice(b)} disabled={editing.busy}>{t("save")}</button>
                  </div>
                </label>
                {b.couponCode ? <small>🏷 {t("couponApplied")} {b.couponCode} (−{b.discountPercent}%)</small> : (
                  <label>{t("coupons")}
                    <div className="row">
                      <input value={editing.code} disabled={!!editing.coupon} placeholder="NG20-XXXXXX" maxLength={32}
                        onChange={(e) => setPe({ ...editing, code: e.target.value.toUpperCase(), msg: "" })} />
                      {editing.coupon
                        ? <button className="ghost" onClick={() => setPe({ ...editing, coupon: null, code: "" })}>{t("removeCode")}</button>
                        : <button className="ghost" onClick={() => applyPriceCode(b)}>{t("applyCode")}</button>}
                    </div>
                  </label>
                )}
                {editing.coupon && (
                  <>
                    <p className="info">−{editing.coupon.percent}% · {money(editing.total)} → <b>{money(discounted(editing.total, editing.coupon.percent))}</b></p>
                    <button onClick={() => redeemOnBooking(b)} disabled={editing.busy}>{t("applyCodeToBooking")}</button>
                  </>
                )}
                {editing.msg && <p className="error">{editing.msg}</p>}
                <button className="ghost" onClick={() => setPe(null)}>{t("close")}</button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
