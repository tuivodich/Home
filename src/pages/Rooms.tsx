import { useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useMoney } from "../lib/useRate";
import { useI18n } from "../i18n";
import type { Room } from "../lib/types";

const empty = { name: "", type: "wood", capacity: 2, price: 500000, status: "active" } as const;

export default function Rooms() {
  const { t } = useI18n();
  const { money } = useMoney();
  const { data: rooms } = useCollection<Room>("rooms");
  const [form, setForm] = useState<Omit<Room, "id"> & { id?: string }>({ ...empty });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const { id, ...rest } = form;
    if (id) await setDoc(doc(db, "rooms", id), rest);
    else await addDoc(collection(db, "rooms"), rest);
    setForm({ ...empty });
  };

  const seed = async () => {
    const b = writeBatch(db);
    const samples = [
      ["Phòng gỗ 1", "wood"], ["Phòng gỗ 2", "wood"], ["Phòng gỗ 3", "wood"],
      ["Phòng bê tông 1", "concrete"], ["Phòng bê tông 2", "concrete"],
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
              <button className="ghost danger" onClick={() => confirm(t("sure")) && deleteDoc(doc(db, "rooms", r.id))}>{t("delete")}</button>
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
        <label>{t("capacity")}<input type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: +e.target.value })} /></label>
        <label>{t("pricePerNight")} (₫)<input type="number" min={0} step={10000} value={form.price} onChange={(e) => setForm({ ...form, price: +e.target.value })} /></label>
        <label>{t("status")}
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Room["status"] })}>
            <option value="active">{t("active")}</option><option value="maintenance">{t("maintenance")}</option>
          </select>
        </label>
        <div className="row">
          <button type="submit">{t("save")}</button>
          {form.id && <button type="button" className="ghost" onClick={() => setForm({ ...empty })}>{t("cancel")}</button>}
        </div>
      </form>
    </section>
  );
}
