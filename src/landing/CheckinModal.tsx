import { useState, type FormEvent } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { EMPTY_PROFILE, type Profile } from "../lib/profile";
import ProfileFields from "../components/ProfileFields";
import { useG } from "../i18n/guest";
import { fmtDate } from "../lib/format";
import type { Booking } from "../lib/types";

export interface Precheckin extends Profile { id: string; uid: string; bookingId: string; eta: string; note: string; status: "submitted" | "imported" }

/** Khách điền (hoặc sửa) check-in online cho một đặt phòng của mình; nhân viên thấy ở trang Khách lưu trú. */
export default function CheckinModal({ booking, existing, base, uid, onClose }: {
  booking: Booking; existing?: Precheckin; base: Profile | null; uid: string; onClose: () => void;
}) {
  const G = useG();
  const [v, setV] = useState<Profile>(existing ?? base ?? { ...EMPTY_PROFILE, fullName: booking.guestName, phone: booking.phone, email: booking.email ?? "" });
  const [eta, setEta] = useState(existing?.eta ?? "");
  const [note, setNote] = useState(existing?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await setDoc(doc(db, "precheckins", booking.id), {
        uid, bookingId: booking.id, fullName: v.fullName.trim(), docType: v.docType, docNumber: v.docNumber.trim(), nationality: v.nationality.trim(),
        dob: v.dob, phone: v.phone.trim(), email: v.email.trim(), eta, note: note.trim(), status: "submitted", updatedAt: serverTimestamp(),
      });
      setDone(true);
    } catch (ex) { console.error("checkin", ex); setErr(G.failed); } finally { setBusy(false); }
  };

  return (
    <div className="lm-overlay" onClick={() => !busy && onClose()} role="dialog" aria-modal="true" aria-label={G.checkinTitle}>
      <div className="lm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="lm-x" onClick={onClose} aria-label={G.close}>×</button>
        {done ? (
          <div className="lm-done">
            <div className="lm-tick">✓</div>
            <h3>{G.checkinSent}</h3>
            <p>{G.checkinDone}</p>
            <button className="lm-btn" onClick={onClose}>{G.close}</button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <h3>{G.checkinTitle}</h3>
            <p className="lm-muted lm-small">{fmtDate(booking.checkIn)} → {fmtDate(booking.checkOut)} · {G.checkinHint}</p>
            <ProfileFields value={v} onChange={setV} />
            <label>{G.eta}<input inputMode="numeric" maxLength={5} placeholder={G.etaPh} pattern="([01][0-9]|2[0-3]):[0-5][0-9]|" value={eta} onChange={(e) => setEta(e.target.value)} /></label>
            <label>{G.checkinNote}<textarea rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} /></label>
            <p className="lm-muted lm-small">🔒 {G.privacy}</p>
            {err && <p className="lm-err">{err}</p>}
            <button className="lm-btn" type="submit" disabled={busy}>{busy ? G.sending : G.save}</button>
          </form>
        )}
      </div>
    </div>
  );
}
