import { useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import type { Booking, Guest } from "../lib/types";

const empty = { fullName: "", docType: "cccd", docNumber: "", nationality: "Việt Nam", dob: "", phone: "", bookingId: "" } as const;

export default function Guests() {
  const { t } = useI18n();
  const { data: guests } = useCollection<Guest>("guests");
  const { data: bookings } = useCollection<Booking>("bookings");
  const [f, setF] = useState<Omit<Guest, "id" | "docImagePath">>({ ...empty });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const gRef = await addDoc(collection(db, "guests"), { ...f, docImagePath: "" });
      if (file) {
        const path = `guests/${gRef.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        await uploadBytes(ref(storage, path), file, { contentType: file.type });
        await updateDoc(gRef, { docImagePath: path });
      }
      setF({ ...empty });
      setFile(null);
    } finally { setBusy(false); }
  };

  const view = async (g: Guest) => window.open(await getDownloadURL(ref(storage, g.docImagePath)), "_blank", "noopener");

  const remove = async (g: Guest) => {
    if (!confirm(t("sure"))) return;
    if (g.docImagePath) await deleteObject(ref(storage, g.docImagePath)).catch(() => {});
    await deleteDoc(doc(db, "guests", g.id));
  };

  return (
    <section>
      <h2>{t("guests")}</h2>
      <p><small>🔒 {t("privacyNote")}</small></p>
      <form className="card" onSubmit={save}>
        <label>{t("fullName")}<input required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></label>
        <label>{t("docType")}
          <select value={f.docType} onChange={(e) => setF({ ...f, docType: e.target.value as Guest["docType"] })}>
            {(["cccd", "passport", "license", "other"] as const).map((k) => <option key={k} value={k}>{t(k)}</option>)}
          </select>
        </label>
        <label>{t("docNumber")}<input required value={f.docNumber} onChange={(e) => setF({ ...f, docNumber: e.target.value })} /></label>
        <label>{t("nationality")}<input value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })} /></label>
        <label>{t("dob")}<input type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></label>
        <label>{t("phone")}<input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <label>{t("booking")}
          <select value={f.bookingId} onChange={(e) => setF({ ...f, bookingId: e.target.value })}>
            <option value="">{t("none2")}</option>
            {bookings.filter((b) => b.status !== "cancelled").map((b) => <option key={b.id} value={b.id}>{b.guestName} · {b.checkIn}</option>)}
          </select>
        </label>
        <label>{t("docImage")}<input type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        <button type="submit" disabled={busy}>{busy ? t("uploading") : t("add")}</button>
      </form>

      {guests.length === 0 && <p>{t("noData")}</p>}
      {guests.map((g) => (
        <div className="card" key={g.id}>
          <strong>{g.fullName}</strong>
          <div>{t(g.docType)}: {g.docNumber} · {g.nationality}</div>
          <div>{g.dob} {g.phone && `· ${g.phone}`}</div>
          <div className="row">
            {g.docImagePath && <button className="ghost" onClick={() => view(g)}>{t("viewImage")}</button>}
            <button className="ghost danger" onClick={() => remove(g)}>{t("delete")}</button>
          </div>
        </div>
      ))}
    </section>
  );
}
