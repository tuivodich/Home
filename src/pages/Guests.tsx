import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { deleteObject, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { normDocNumber, normName } from "../lib/format";
import GuestInfo from "../components/GuestInfo";
import type { Booking, Guest, Room } from "../lib/types";

type Form = Omit<Guest, "id" | "docImagePath">;
const empty: Form = { fullName: "", docType: "cccd", docNumber: "", nationality: "Việt Nam", dob: "", phone: "", email: "", bookingId: "" };

export default function Guests() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "owner" || profile?.role === "manager";
  const [params, setParams] = useSearchParams();
  const { data: guests } = useCollection<Guest>("guests");
  const { data: bookings } = useCollection<Booking>("bookings");
  const { data: rooms } = useCollection<Room>("rooms");
  const [f, setF] = useState<Form>({ ...empty });
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [notice, setNotice] = useState("");
  const [prefill, setPrefill] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);

  // Mở từ nút "Hồ sơ khách" ở đặt phòng: điền sẵn họ tên, điện thoại, email và gắn với đặt phòng.
  useEffect(() => {
    const bid = params.get("booking");
    if (!bid) return;
    const b = bookings.find((x) => x.id === bid);
    if (!b) return;
    setEditing(null);
    setF({ ...empty, fullName: b.guestName, phone: b.phone, email: b.email ?? "", bookingId: b.id });
    setPrefill(b.guestName);
    setParams({}, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [params, bookings, setParams]);

  // Gợi ý khách đã có (theo họ tên hoặc số giấy tờ), mỗi người một dòng.
  const suggestions = useMemo(() => {
    const q = normName(f.fullName);
    const qd = normDocNumber(f.fullName);
    if (!showSuggest || editing || !q) return [];
    const seen = new Set<string>();
    const out: Guest[] = [];
    for (const g of [...guests].sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"))) {
      const key = g.docType + normDocNumber(g.docNumber);
      if (seen.has(key)) continue;
      if (normName(g.fullName).includes(q) || (qd.length >= 3 && normDocNumber(g.docNumber).includes(qd))) {
        seen.add(key);
        out.push(g);
        if (out.length >= 6) break;
      }
    }
    return out;
  }, [guests, f.fullName, showSuggest, editing]);

  // Số giấy tờ là duy nhất: nếu đã có ở một khách khác tên thì cảnh báo (vẫn cho lưu).
  const conflictsFor = (docType: string, docNumber: string, fullName: string, selfId?: string) => {
    const n = normDocNumber(docNumber);
    if (n.length < 4) return { other: [] as Guest[], same: [] as Guest[] };
    const hits = guests.filter((g) => g.id !== selfId && g.docType === docType && normDocNumber(g.docNumber) === n);
    return { other: hits.filter((g) => normName(g.fullName) !== normName(fullName)), same: hits.filter((g) => normName(g.fullName) === normName(fullName)) };
  };
  const live = conflictsFor(f.docType, f.docNumber, f.fullName, editing?.id);

  const pick = (g: Guest) => {
    setF({ ...f, fullName: g.fullName, docType: g.docType, docNumber: g.docNumber, nationality: g.nationality, dob: g.dob, phone: f.phone || g.phone, email: f.email || g.email });
    setShowSuggest(false);
  };

  const uploadPhoto = async (guestId: string, gRef: ReturnType<typeof doc>, old: string) => {
    if (!file) return;
    const path = `guests/${guestId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    try {
      await uploadBytes(ref(storage, path), file, { contentType: file.type });
      await updateDoc(gRef, { docImagePath: path });
      // Xóa ảnh cũ khi đã thay ảnh mới; lỗi ở đây không làm hỏng việc lưu.
      if (old) await deleteObject(ref(storage, old)).catch((ex) => console.error("delete old photo failed", ex));
    } catch (ex) {
      // Khách đã được lưu, chỉ ảnh bị lỗi: báo rõ để người dùng biết và gửi lại mã lỗi.
      console.error("upload failed", ex);
      setUploadErr(`${t("uploadFailed")}: ${(ex as { code?: string }).code ?? ""} ${(ex as Error).message}`);
    }
  };

  const reset = () => { setF({ ...empty }); setFile(null); setEditing(null); setPrefill(""); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setUploadErr("");
    setNotice("");
    try {
      const warn = live.other.length ? `${t("dupSaved")}: ${live.other.map((g) => g.fullName).join(", ")} (${f.docNumber})` : "";
      if (editing) {
        const gRef = doc(db, "guests", editing.id);
        await updateDoc(gRef, { ...f });
        await uploadPhoto(editing.id, gRef, editing.docImagePath);
      } else {
        const gRef = await addDoc(collection(db, "guests"), { ...f, docImagePath: "" });
        await uploadPhoto(gRef.id, gRef, "");
      }
      setNotice(warn);
      reset();
    } finally { setBusy(false); }
  };

  const startEdit = (g: Guest) => {
    const { id: _id, docImagePath: _p, ...rest } = g;
    setF({ ...empty, ...rest });
    setFile(null);
    setEditing(g);
    setPrefill("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (g: Guest) => {
    if (!confirm(t("sure"))) return;
    if (g.docImagePath) await deleteObject(ref(storage, g.docImagePath)).catch((ex) => console.error("delete photo failed", ex));
    await deleteDoc(doc(db, "guests", g.id));
    if (editing?.id === g.id) reset();
  };

  return (
    <section>
      <h2>{t("guests")}</h2>
      <p><small>🔒 {t("privacyNote")}</small></p>
      {notice && <p className="warn">⚠ {notice}</p>}
      <form className="card" onSubmit={save}>
        {editing && <strong>✏️ {t("edit")}: {editing.fullName}</strong>}
        {prefill && <p className="info">{t("prefillFromBooking")} {prefill}.</p>}
        <label className="suggest">{t("fullName")}
          <input required autoComplete="off" value={f.fullName}
            onChange={(e) => { setF({ ...f, fullName: e.target.value }); setShowSuggest(true); }}
            onFocus={() => setShowSuggest(true)} onBlur={() => setTimeout(() => setShowSuggest(false), 150)} />
          {suggestions.length > 0 && (
            <ul>
              <li style={{ cursor: "default" }}><small>{t("suggestGuests")}</small></li>
              {suggestions.map((g) => (
                <li key={g.id} onMouseDown={(e) => { e.preventDefault(); pick(g); }}>
                  <span>{g.fullName}</span><small>{t(g.docType)}: {g.docNumber}</small>
                </li>
              ))}
            </ul>
          )}
        </label>
        <label>{t("docType")}
          <select value={f.docType} onChange={(e) => setF({ ...f, docType: e.target.value as Guest["docType"] })}>
            {(["cccd", "passport", "license", "other"] as const).map((k) => <option key={k} value={k}>{t(k)}</option>)}
          </select>
        </label>
        <label>{t("docNumber")}<input required value={f.docNumber} onChange={(e) => setF({ ...f, docNumber: e.target.value })} /></label>
        {live.other.length > 0 && (
          <p className="warn">{t("dupOther")}: {live.other.map((g) => `${g.fullName} (${t(g.docType)} ${g.docNumber})`).join("; ")}</p>
        )}
        {live.other.length === 0 && live.same.length > 0 && <p className="info">{t("dupSame")}</p>}
        <label>{t("nationality")}<input value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })} /></label>
        <label>{t("dob")}<input type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></label>
        <label>{t("phone")}<input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
        <label>{t("email")}<input type="email" value={f.email ?? ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label>{t("booking")}
          <select value={f.bookingId} onChange={(e) => setF({ ...f, bookingId: e.target.value })}>
            <option value="">{t("none2")}</option>
            {bookings.filter((b) => b.status !== "cancelled").map((b) => <option key={b.id} value={b.id}>{b.guestName} · {b.checkIn}</option>)}
          </select>
        </label>
        <label>{t("docImage")}{editing?.docImagePath && <small>{t("keepPhotoHint")}</small>}<input key={editing?.id ?? "new"} type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
        {uploadErr && <p className="error">{uploadErr}</p>}
        <div className="row">
          <button type="submit" disabled={busy}>{busy ? t("uploading") : editing ? t("save") : t("add")}</button>
          {(editing || prefill) && <button type="button" className="ghost" onClick={reset}>{t("cancel")}</button>}
        </div>
      </form>

      {guests.length === 0 && <p>{t("noData")}</p>}
      {guests.map((g) => {
        const bk = bookings.find((x) => x.id === g.bookingId);
        const clash = conflictsFor(g.docType, g.docNumber, g.fullName, g.id).other;
        return (
          <div className="card" key={g.id}>
            <GuestInfo g={g} />
            {clash.length > 0 && <p className="warn">{t("dupOther")}: {clash.map((x) => x.fullName).join(", ")}</p>}
            {bk && <div>🛏 {rooms.find((r) => r.id === bk.roomId)?.name ?? "?"} · {bk.checkIn} → {bk.checkOut}</div>}
            <div className="row">
              <button className="ghost" onClick={() => startEdit(g)}>{t("edit")}</button>
              {isAdmin && <button className="ghost danger" onClick={() => remove(g)}>{t("delete")}</button>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
