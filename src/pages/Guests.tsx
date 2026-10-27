import { fmtDate } from "../lib/format";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { deleteObject, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import GuestInfo from "../components/GuestInfo";
import GuestFields, { conflictsFor, emptyGuestForm, type GuestForm } from "../components/GuestFields";
import type { Booking, Guest, Room } from "../lib/types";

export default function Guests() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "owner" || profile?.role === "manager";
  const [params, setParams] = useSearchParams();
  const { data: guests } = useCollection<Guest>("guests");
  const { data: bookings } = useCollection<Booking>("bookings");
  const { data: rooms } = useCollection<Room>("rooms");
  const [f, setF] = useState<GuestForm>({ ...emptyGuestForm });
  const [bookingId, setBookingId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<Guest | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [notice, setNotice] = useState("");
  const [prefill, setPrefill] = useState("");
  const andCheckIn = useRef(false);

  // Mở từ nút "Hồ sơ khách" ở đặt phòng: điền sẵn họ tên, điện thoại, email và gắn với đặt phòng.
  useEffect(() => {
    const bid = params.get("booking");
    if (!bid) return;
    const b = bookings.find((x) => x.id === bid);
    if (!b) return;
    setEditing(null);
    setF({ ...emptyGuestForm, fullName: b.guestName, phone: b.phone, email: b.email ?? "" });
    setBookingId(b.id);
    setPrefill(b.guestName);
    setParams({}, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [params, bookings, setParams]);

  const linkedBooking = bookings.find((b) => b.id === bookingId);
  const live = conflictsFor(guests, f.docType, f.docNumber, f.fullName, editing?.id);

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

  const reset = () => { setF({ ...emptyGuestForm }); setBookingId(""); setFile(null); setEditing(null); setPrefill(""); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const checkInAfter = andCheckIn.current;
    andCheckIn.current = false;
    setBusy(true);
    setUploadErr("");
    setNotice("");
    try {
      const warn = live.other.length ? `${t("dupSaved")}: ${live.other.map((g) => g.fullName).join(", ")} (${f.docNumber})` : "";
      if (editing) {
        const gRef = doc(db, "guests", editing.id);
        await updateDoc(gRef, { ...f, bookingId });
        await uploadPhoto(editing.id, gRef, editing.docImagePath);
      } else {
        const gRef = await addDoc(collection(db, "guests"), { ...f, bookingId, docImagePath: "" });
        await uploadPhoto(gRef.id, gRef, "");
      }
      // Hồ sơ đã có → cho nhận phòng ngay nếu đặt phòng đang ở trạng thái "Đã xác nhận".
      if (checkInAfter && linkedBooking?.status === "confirmed") await updateDoc(doc(db, "bookings", linkedBooking.id), { status: "checked_in" });
      setNotice(warn);
      reset();
    } finally { setBusy(false); }
  };

  const startEdit = (g: Guest) => {
    const { id: _id, docImagePath: _p, bookingId: bid, ...rest } = g;
    setF({ ...emptyGuestForm, ...rest, email: rest.email ?? "" });
    setBookingId(bid);
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
        <GuestFields value={f} onChange={setF} guests={guests} selfId={editing?.id} file={file} onFile={setFile}
          fileKey={editing?.id ?? "new"} hasPhoto={!!editing?.docImagePath} noSuggest={!!editing} />
        <label>{t("booking")}
          <select value={bookingId} onChange={(e) => setBookingId(e.target.value)}>
            <option value="">{t("none2")}</option>
            {bookings.filter((b) => b.status !== "cancelled").map((b) => <option key={b.id} value={b.id}>{b.guestName} · {fmtDate(b.checkIn)}</option>)}
          </select>
        </label>
        {uploadErr && <p className="error">{uploadErr}</p>}
        <div className="row">
          <button type="submit" disabled={busy}>{busy ? t("uploading") : editing ? t("save") : t("add")}</button>
          {linkedBooking?.status === "confirmed" && (
            <button type="submit" disabled={busy} onClick={() => { andCheckIn.current = true; }}>{t("saveAndCheckIn")}</button>
          )}
          {(editing || prefill) && <button type="button" className="ghost" onClick={reset}>{t("cancel")}</button>}
        </div>
      </form>

      {guests.length === 0 && <p>{t("noData")}</p>}
      {guests.map((g) => {
        const bk = bookings.find((x) => x.id === g.bookingId);
        const clash = conflictsFor(guests, g.docType, g.docNumber, g.fullName, g.id).other;
        return (
          <div className="card" key={g.id}>
            <GuestInfo g={g} />
            {clash.length > 0 && <p className="warn">{t("dupOther")}: {clash.map((x) => x.fullName).join(", ")}</p>}
            {bk && <div>🛏 {rooms.find((r) => r.id === bk.roomId)?.name ?? "?"} · {fmtDate(bk.checkIn)} → {fmtDate(bk.checkOut)}</div>}
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
