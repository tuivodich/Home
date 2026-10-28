import { useEffect, useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import TierBadge from "../components/TierBadge";
import { DEFAULT_TIERS, completedStays, tierFor, useLoyaltyCfg, useTierLookup, type LoyaltyCfg, type Tier } from "../lib/loyalty";
import type { Booking, UserDoc } from "../lib/types";

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const newId = (name: string) => `${name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "").slice(0, 12) || "tier"}${Math.random().toString(36).slice(2, 5)}`;

/** Thành viên thân thiết (chủ/quản lý): cấu hình hạng và mã giảm giá riêng; xem hạng từng khách và đặt hạng thủ công. */
export default function LoyaltyPage() {
  const { lang } = useI18n();
  const T = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const { user } = useAuth();
  const { cfg: saved, loading } = useLoyaltyCfg();
  const [draft, setDraft] = useState<LoyaltyCfg>(saved);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: users } = useCollection<UserDoc & { id: string }>("users");
  const { data: bookings } = useCollection<Booking>("bookings");
  const look = useTierLookup(bookings);
  useEffect(() => { if (!loading) setDraft(clone(saved)); }, [loading, saved]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const valid = draft.tiers.length > 0 && draft.tiers.every((t) => t.name.trim()) && new Set(draft.tiers.map((t) => t.minBookings)).size === draft.tiers.length && draft.tiers.some((t) => t.minBookings === 0);
  const patch = (i: number, v: Partial<Tier>) => setDraft({ ...draft, tiers: draft.tiers.map((t, k) => (k === i ? { ...t, ...v } : t)) });

  const save = async () => {
    setBusy(true); setMsg(""); setErr("");
    try {
      await setDoc(doc(db, "settings", "loyalty"), {
        enabled: draft.enabled,
        tiers: [...draft.tiers].sort((a, b) => a.minBookings - b.minBookings).map((t) => ({ id: t.id, name: t.name.trim(), color: t.color, minBookings: Math.max(0, Math.floor(t.minBookings)), couponPercent: Math.min(50, Math.max(0, t.couponPercent)) })),
      });
      setMsg(T("Đã lưu cấu hình thành viên thân thiết.", "Loyalty settings saved."));
    } catch (ex) { console.error("save loyalty", ex); setErr(T("Không lưu được. Vui lòng thử lại.", "Could not save.")); } finally { setBusy(false); }
  };

  const setManual = (uid: string, tier: string) => setDoc(doc(db, "members", uid), { tier, updatedAt: serverTimestamp(), updatedBy: user?.uid ?? "" }, { merge: true }).catch((ex) => { console.error("manual tier", ex); setErr(T("Không đặt được hạng.", "Could not set the tier.")); });

  const customers = useMemo(() => {
    const ids = new Set<string>(bookings.filter((b) => b.source === "online" && b.createdBy).map((b) => b.createdBy!));
    users.filter((u) => u.role === "customer" || u.role === "pending").forEach((u) => ids.add(u.id));
    return [...ids].map((id) => ({ id, email: users.find((u) => u.id === id)?.email ?? id, name: users.find((u) => u.id === id)?.name ?? "" }))
      .sort((a, b) => completedStays(bookings, b.id) - completedStays(bookings, a.id) || a.email.localeCompare(b.email));
  }, [users, bookings]);

  return (
    <section>
      <h2>{T("Thành viên thân thiết", "Loyalty members")}</h2>
      <p><small>{T("Khách tự thăng hạng theo số lần đã ở (đặt phòng online đã trả phòng). Mỗi hạng có huy hiệu màu riêng hiện sau tên và một mã giảm giá riêng khách tự nhận ở trang Đặt phòng của tôi (mỗi hạng một mã, hạn 90 ngày, dùng một lần, độc lập với bảng giá).", "Guests are promoted automatically by completed stays (online bookings that were checked out). Each tier has a coloured badge after the name and a personal coupon guests can claim on My bookings (one per tier, valid 90 days, single use, independent of pricing).")}</small></p>
      {msg && <p className="ok-msg" role="status">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <div className="card" id="loyalty-config">
        <label className="check"><input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} /><span>{T("Bật chương trình thành viên thân thiết", "Enable the loyalty programme")}</span></label>
        {draft.tiers.map((t, i) => (
          <div className="row shiftform" key={t.id}>
            <label>{T("Tên hạng", "Tier name")}<input value={t.name} maxLength={30} onChange={(e) => patch(i, { name: e.target.value })} /></label>
            <label>{T("Màu huy hiệu", "Badge colour")}<input type="color" value={t.color} onChange={(e) => patch(i, { color: e.target.value })} /></label>
            <label>{T("Từ số lần ở", "From stays")}<input type="number" min={0} max={999} value={t.minBookings} onChange={(e) => patch(i, { minBookings: Math.max(0, Math.floor(+e.target.value || 0)) })} /></label>
            <label>{T("Mã giảm giá riêng (%)", "Personal coupon (%)")}<input type="number" min={0} max={50} value={t.couponPercent} onChange={(e) => patch(i, { couponPercent: Math.min(50, Math.max(0, +e.target.value || 0)) })} /></label>
            <span><TierBadge tier={t} /></span>
            <button type="button" className="ghost danger" disabled={draft.tiers.length <= 1} onClick={() => setDraft({ ...draft, tiers: draft.tiers.filter((_, k) => k !== i) })}>{T("Xóa", "Remove")}</button>
          </div>
        ))}
        {!valid && <p className="error">{T("Cần ít nhất một hạng bắt đầu từ 0 lần, tên không trống và mỗi hạng một mốc số lần khác nhau.", "Need a tier starting at 0 stays, non-empty names and a distinct threshold per tier.")}</p>}
        <div className="row">
          <button type="button" className="ghost" onClick={() => setDraft({ ...draft, tiers: [...draft.tiers, { id: newId("hang"), name: "", color: "#8888cc", minBookings: Math.max(0, ...draft.tiers.map((t) => t.minBookings)) + 5, couponPercent: 0 }] })}>+ {T("Thêm hạng", "Add tier")}</button>
          <button type="button" className="ghost" onClick={() => setDraft({ ...draft, tiers: clone(DEFAULT_TIERS) })}>{T("Dùng hạng mẫu (Đồng/Bạc/Vàng/Kim cương)", "Use sample tiers")}</button>
        </div>
        <div className="rolebar">
          <button type="button" disabled={!dirty || !valid || busy} onClick={save}>{T("Lưu lại", "Save")}</button>
          <button type="button" className="ghost" disabled={!dirty || busy} onClick={() => { setDraft(clone(saved)); setMsg(""); setErr(""); }}>{T("Hủy bỏ", "Discard")}</button>
        </div>
      </div>

      <div className="card" id="loyalty-members">
        <h3>{T("Hạng từng khách", "Member tiers")}</h3>
        {customers.length === 0 && <small>{T("Chưa có khách hàng nào.", "No customers yet.")}</small>}
        {customers.map((c) => {
          const auto = tierFor(look.count(c.id), look.cfg);
          const manual = look.members.find((m) => m.id === c.id)?.tier ?? "";
          return (
            <div className="row between" key={c.id}>
              <span>{c.name ? `${c.name} · ` : ""}{c.email} · {look.count(c.id)} {T("lần ở", "stays")} <TierBadge tier={look.tierOf(c.id)} />{manual ? <small> ({T("đặt tay", "manual")})</small> : auto ? null : null}</span>
              <select value={look.cfg.tiers.some((t) => t.id === manual) ? manual : ""} aria-label={`${c.email} tier`} onChange={(e) => setManual(c.id, e.target.value)}>
                <option value="">{T("Tự động", "Automatic")}</option>
                {look.cfg.tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    </section>
  );
}
