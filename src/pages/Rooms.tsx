import { useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { shrinkImage } from "../lib/image";
import { useCollection } from "../lib/useCollection";
import { useMoney } from "../lib/useRate";
import { useI18n } from "../i18n";
import type { Room } from "../lib/types";
import NumInput from "../components/NumInput";
import { usePricingConfig } from "../lib/usePricing";
import { useAudit } from "../lib/audit";

const empty = { name: "", type: "wood", capacity: 2, price: 500000, status: "active" } as const;

export default function Rooms() {
  const { t, lang } = useI18n();
  const { money } = useMoney();
  const audit = useAudit();
  const { data: rooms } = useCollection<Room>("rooms");
  const [form, setForm] = useState<Omit<Room, "id"> & { id?: string }>({ ...empty });

  const vi = lang === "vi";
  const { cfg } = usePricingConfig();
  const included = form.baseGuests ?? form.capacity;
  const baseTooBig = included > form.capacity;
  const extraFee = cfg.extraGuestFee;
  const extraHint = included >= form.capacity
    ? (vi ? "Hiện chưa có phụ thu thêm khách: khách tối đa bằng số khách đã gồm trong giá. Muốn tính phụ thu, đặt \"số khách đã gồm trong giá\" nhỏ hơn sức chứa tối đa (vd tối đa 4, đã gồm 2)." : "No extra-guest surcharge: maximum equals the guests included. To charge extras, set the included number below the maximum (e.g. max 4, included 2).")
    : (vi ? `Ví dụ: tối đa ${form.capacity} khách. ${included} khách đầu đã gồm trong giá; từ khách thứ ${included + 1} đến thứ ${form.capacity} phụ thu ${extraFee > 0 ? `${extraFee.toLocaleString("vi-VN")} VNĐ` : "(chưa đặt mức phụ thu ở Giá & chính sách)"} mỗi người mỗi đêm.` : `Example: up to ${form.capacity} guests. The first ${included} are in the price; guest ${included + 1}–${form.capacity} pay ${extraFee > 0 ? `${extraFee.toLocaleString("vi-VN")} VND` : "(set the fee in Prices & policies)"} per person per night.`);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState("");
  const photos = form.photos ?? [];
  const setPhotos = async (list: string[]) => {
    if (!form.id) return;
    await updateDoc(doc(db, "rooms", form.id), { photos: list });
    setForm((f) => ({ ...f, photos: list }));
  };
  // Tải ảnh lên Storage (đã thu nhỏ) rồi ghi ngay vào phòng; ảnh đầu tiên là ảnh bìa.
  const addPhotos = async (files: FileList | null) => {
    if (!files || !form.id) return;
    setPhotoBusy(true); setPhotoErr("");
    try {
      let list = [...photos];
      for (const file of Array.from(files)) {
        if (list.length >= 8) { setPhotoErr(vi ? "Tối đa 8 ảnh mỗi phòng." : "Up to 8 photos per room."); break; }
        if (!file.type.startsWith("image/")) continue;
        const blob = await shrinkImage(file);
        const r = ref(storage, `rooms/${form.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`);
        await uploadBytes(r, blob, { contentType: "image/jpeg" });
        list = [...list, await getDownloadURL(r)];
      }
      await setPhotos(list);
    } catch (ex) { console.error("room photos", ex); setPhotoErr(vi ? "Không tải được ảnh. Vui lòng thử lại." : "Could not upload the photo. Please try again."); } finally { setPhotoBusy(false); }
  };
  const removePhoto = async (i: number) => {
    if (!confirm(vi ? "Xóa ảnh này?" : "Delete this photo?")) return;
    const url = photos[i];
    try { await setPhotos(photos.filter((_, k) => k !== i)); await deleteObject(ref(storage, url)).catch(() => {}); } catch (ex) { console.error("remove photo", ex); setPhotoErr(vi ? "Không xóa được ảnh." : "Could not delete the photo."); }
  };
  const coverPhoto = (i: number) => setPhotos([photos[i], ...photos.filter((_, k) => k !== i)]).catch((ex) => console.error("cover", ex));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const { id, ...rest } = form;
    if (id) await setDoc(doc(db, "rooms", id), rest);
    else await addDoc(collection(db, "rooms"), rest);
    audit(id ? "room.update" : "room.create", `${id ? "Sửa" : "Thêm"} phòng ${rest.name}: ${rest.price.toLocaleString("vi-VN")} VNĐ/đêm, tối đa ${rest.capacity} khách, ${rest.status}`, id ? { type: "room", id } : undefined);
    setForm({ ...empty });
  };

  const seed = async () => {
    const b = writeBatch(db);
    const samples = [
      ["Phòng gỗ 1", "wood"], ["Phòng gỗ 2", "wood"], ["Phòng gỗ 3", "wood"],
      ["Phòng xây dựng 1", "concrete"], ["Phòng xây dựng 2", "concrete"],
    ] as const;
    samples.forEach(([name, type]) => b.set(doc(collection(db, "rooms")), { ...empty, name, type }));
    await b.commit();
  };

  return (
    <section>
      <h2>{t("rooms")}</h2>
      {rooms.length === 0 && <button onClick={seed}>{t("addDefaultRooms")}</button>}
      <div className="grid">
        {[...rooms].sort((a, b) => a.name.localeCompare(b.name)).map((r) => (
          <div className="card" key={r.id}>
            <strong>{r.name}</strong>
            <div>{t(r.type)} · {r.capacity} 👤</div>
            <div>{money(r.price)} / {t("nights")}</div>
            <span className={`tag ${r.status}`}>{t(r.status)}</span>
            <div className="row">
              <button className="ghost" onClick={() => setForm(r)}>{t("edit")}</button>
              <button className="ghost danger" onClick={() => { if (confirm(t("sure"))) { void deleteDoc(doc(db, "rooms", r.id)); audit("room.delete", `Xóa phòng ${r.name}`, { type: "room", id: r.id }); } }}>{t("delete")}</button>
            </div>
          </div>
        ))}
      </div>
      <form className="card" onSubmit={save}>
        <h3>{form.id ? t("edit") : t("add")}</h3>
        <label>{t("roomName")}<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>{t("roomType")}
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Room["type"] })}>
            <option value="wood">{t("wood")}</option><option value="concrete">{t("concrete")}</option>
          </select>
        </label>
        <label>{vi ? "Sức chứa tối đa (số khách nhiều nhất được đặt phòng này)" : "Maximum guests (the most guests that can book this room)"}<NumInput min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Math.max(1, Math.floor(+e.target.value)) })} /></label>
        <label>{vi ? "Số khách đã gồm trong giá phòng (để trống = bằng sức chứa tối đa, không phụ thu)" : "Guests included in the room price (empty = same as maximum, no surcharge)"}
          <NumInput allowEmpty min={1} max={form.capacity} value={form.baseGuests ?? ""} onChange={(e) => { const { baseGuests: _b, ...rest } = form; setForm(e.target.value ? { ...rest, baseGuests: Math.max(1, Math.floor(+e.target.value)) } : rest); }} />
        </label>
        {baseTooBig && <p className="error">{vi ? `Số khách đã gồm trong giá (${included}) không thể lớn hơn sức chứa tối đa (${form.capacity}). Hãy tăng sức chứa tối đa hoặc giảm số này.` : `Guests included (${included}) cannot exceed the maximum (${form.capacity}).`}</p>}
        <small>{extraHint}</small>
        <label>{t("pricePerNight")} (VNĐ)<NumInput min={0} step={10000} value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} /></label>
        <label>{t("status")}
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Room["status"] })}>
            <option value="active">{t("active")}</option><option value="maintenance">{t("maintenance")}</option>
          </select>
        </label>
        <label>{vi ? "Giới thiệu phòng (tiếng Việt)" : "Description (Vietnamese)"}<textarea rows={4} maxLength={3000} value={form.desc ?? ""} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></label>
        <label>{vi ? "Giới thiệu phòng (tiếng Anh, để trống thì dùng bản tiếng Việt)" : "Description (English, empty = use Vietnamese)"}<textarea rows={3} maxLength={3000} value={form.descEn ?? ""} onChange={(e) => setForm({ ...form, descEn: e.target.value })} /></label>
        <label>{vi ? "Tiện nghi riêng của phòng (mỗi dòng một mục, tiếng Việt)" : "Room features (one per line, Vietnamese)"}<textarea rows={4} maxLength={1500} value={form.features ?? ""} onChange={(e) => setForm({ ...form, features: e.target.value })} /></label>
        <label>{vi ? "Tiện nghi (tiếng Anh, tùy chọn)" : "Room features (English, optional)"}<textarea rows={3} maxLength={1500} value={form.featuresEn ?? ""} onChange={(e) => setForm({ ...form, featuresEn: e.target.value })} /></label>
        <div id="room-photos">
          <strong>{vi ? "Ảnh phòng" : "Room photos"}</strong>
          {!form.id ? <small> — {vi ? "Lưu phòng trước, rồi bấm Sửa để thêm ảnh." : "Save the room first, then press Edit to add photos."}</small> : (
            <>
              <div className="row" style={{ flexWrap: "wrap" }}>
                {photos.map((u, i) => (
                  <figure key={u} className="roomthumb">
                    <img src={u} alt="" loading="lazy" />
                    <figcaption>
                      {i === 0 ? <small>{vi ? "Ảnh bìa" : "Cover"}</small> : <button type="button" className="ghost" onClick={() => coverPhoto(i)}>{vi ? "Làm ảnh bìa" : "Make cover"}</button>}
                      <button type="button" className="ghost danger" onClick={() => removePhoto(i)}>{t("delete")}</button>
                    </figcaption>
                  </figure>
                ))}
              </div>
              <label>{vi ? "Thêm ảnh (tự thu nhỏ, tối đa 8 ảnh)" : "Add photos (auto-resized, up to 8)"}<input type="file" accept="image/*" multiple disabled={photoBusy || photos.length >= 8} onChange={(e) => { void addPhotos(e.target.files); e.target.value = ""; }} /></label>
              {photoBusy && <small>{vi ? "Đang tải ảnh…" : "Uploading…"}</small>}
              {photoErr && <p className="error">{photoErr}</p>}
            </>
          )}
        </div>
        <div className="row">
          <button type="submit" disabled={baseTooBig}>{t("save")}</button>
          {form.id && <button type="button" className="ghost" onClick={() => setForm({ ...empty })}>{t("cancel")}</button>}
        </div>
      </form>
    </section>
  );
}
