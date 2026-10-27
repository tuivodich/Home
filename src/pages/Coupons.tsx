import { useMemo, useState, type FormEvent } from "react";
import { Timestamp, deleteDoc, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import type { Booking, Coupon, UserDoc } from "../lib/types";

// Bỏ các ký tự dễ nhầm (0/O, 1/I/L) để khách đọc và gõ mã không sai.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(percent: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `NG${percent}-` + Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export default function Coupons() {
  const { t } = useI18n();
  const { data: coupons } = useCollection<Coupon>("coupons");
  const { data: users } = useCollection<UserDoc & { id: string }>("users");
  const { data: bookings } = useCollection<Booking>("bookings");
  const [percent, setPercent] = useState(20);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  const sorted = useMemo(() => [...coupons].sort((a, b) =>
    Number(a.used) - Number(b.used) || (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)), [coupons]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const taken = new Set(coupons.map((c) => c.id));
      const b = writeBatch(db);
      for (let i = 0; i < qty; i++) {
        let code = randomCode(percent);
        while (taken.has(code)) code = randomCode(percent);
        taken.add(code);
        b.set(doc(db, "coupons", code), {
          percent, used: false, note: note.trim(), createdAt: serverTimestamp(),
          ...(expiry ? { expiresAt: Timestamp.fromDate(new Date(expiry + "T23:59:59")) } : {}),
        });
      }
      await b.commit();
      setNote("");
    } finally { setBusy(false); }
  };

  const copy = async (code: string) => {
    try { await navigator.clipboard.writeText(code); setCopied(code); setTimeout(() => setCopied(""), 1500); } catch { /* bỏ qua */ }
  };

  const status = (c: Coupon) => c.used ? t("couponUsed") : c.expiresAt && c.expiresAt.toMillis() < Date.now() ? t("couponExpired") : t("couponUnused");
  const who = (c: Coupon) => {
    const email = users.find((u) => u.id === c.usedBy)?.email ?? "";
    const bk = bookings.find((x) => x.id === c.bookingId);
    return [email, bk && `${bk.guestName} (${bk.checkIn})`].filter(Boolean).join(" · ");
  };

  return (
    <section>
      <h2>{t("coupons")}</h2>
      <p><small>{t("couponHint")}</small></p>
      <form className="card" onSubmit={create}>
        <div className="row">
          <label>{t("couponPercent")}<input type="number" min={1} max={100} required value={percent} onChange={(e) => setPercent(Math.max(1, Math.min(100, +e.target.value || 1)))} /></label>
          <label>{t("couponQty")}<input type="number" min={1} max={50} required value={qty} onChange={(e) => setQty(Math.max(1, Math.min(50, +e.target.value || 1)))} /></label>
        </div>
        <label>{t("couponNote")}<input maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <label>{t("couponExpiry")}<input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></label>
        <button type="submit" disabled={busy}>{t("couponCreate")}</button>
      </form>

      {sorted.length === 0 && <p>{t("noData")}</p>}
      {sorted.map((c) => (
        <div className={`card coupon ${c.used ? "used" : ""}`} key={c.id}>
          <div className="row between">
            <strong className="couponcode">{c.id}</strong>
            <span className={`tag ${c.used ? "cancelled" : "confirmed"}`}>{status(c)}</span>
          </div>
          <div>−{c.percent}%{c.note && ` · ${c.note}`}{c.expiresAt && ` · ≤ ${new Date(c.expiresAt.toMillis()).toLocaleDateString()}`}</div>
          {c.used && <small>{t("usedBy")}: {who(c) || "—"}</small>}
          <div className="row">
            {!c.used && <button className="ghost" onClick={() => copy(c.id)}>{copied === c.id ? t("copied") : t("copy")}</button>}
            <button className="ghost danger" onClick={() => confirm(t("couponDeleteSure")) && deleteDoc(doc(db, "coupons", c.id))}>{t("delete")}</button>
          </div>
        </div>
      ))}
    </section>
  );
}
