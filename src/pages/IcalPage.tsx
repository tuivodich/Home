import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { icalSyncNow } from "../lib/telegram";
import { copyText, randomToken } from "../lib/secret";
import { useAudit } from "../lib/audit";
import type { Room } from "../lib/types";

interface Feed { id: string; roomId: string; name: string; url: string }
interface FeedState { at?: { toDate(): Date }; ok?: boolean; count?: number; error?: string }

/** Đặt phòng → Đồng bộ lịch (iCal): xuất lịch từng phòng cho Airbnb/Booking.com… và nhập lịch của họ về để tránh bán trùng phòng. */
export default function IcalPage() {
  const { lang } = useI18n();
  const T = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const audit = useAudit();
  const { data: rooms } = useCollection<Room>("rooms");
  const [token, setToken] = useState("");
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [state, setState] = useState<Record<string, FeedState>>({});
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => onSnapshot(doc(db, "settings", "ical"), (s) => { const d = s.data(); setToken(d?.token ?? ""); setFeeds(Array.isArray(d?.feeds) ? d.feeds : []); setLoaded(true); }, () => setLoaded(true)), []);
  useEffect(() => onSnapshot(doc(db, "settings", "icalState"), (s) => setState(s.data()?.feeds ?? {}), () => undefined), []);

  const sorted = useMemo(() => [...rooms].sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true })), [rooms]);
  const url = (roomId: string) => `${window.location.origin}/ical/${roomId}.ics?k=${token}`;
  const save = async (next: Feed[], tok = token) => {
    setMsg("");
    try { await setDoc(doc(db, "settings", "ical"), { token: tok, feeds: next }); setMsg(T("Đã lưu.", "Saved.")); } catch (e) { console.error("ical save", e); setMsg(T("Không lưu được. Kiểm tra lại các đường dẫn (phải bắt đầu bằng https://).", "Could not save. Check the URLs (must start with https://).")); }
  };
  const makeToken = async () => {
    if (token && !confirm(T("Tạo mã mới? Các đường dẫn đã dán vào Airbnb/Booking.com sẽ ngừng hoạt động, bạn phải dán lại.", "Create a new code? URLs already pasted into Airbnb/Booking.com will stop working and must be pasted again."))) return;
    const t = randomToken(32);
    await save(feeds, t);
    audit("settings.ical", token ? "Đổi mã bí mật đường dẫn iCal" : "Tạo mã bí mật đường dẫn iCal");
  };
  const copy = async (key: string, v: string) => { if (await copyText(v)) { setCopied(key); setTimeout(() => setCopied(""), 1500); } };
  const sync = async () => {
    setBusy(true); setMsg("");
    try { const r = await icalSyncNow(); setMsg(T(`Đã đồng bộ ${r.feeds} nguồn: thêm ${r.added}, gỡ ${r.removed}${r.conflicts ? `, ⚠ ${r.conflicts} trùng đặt phòng` : ""}.`, `Synced ${r.feeds} source(s): ${r.added} added, ${r.removed} removed${r.conflicts ? `, ⚠ ${r.conflicts} conflict(s)` : ""}.`)); }
    catch (e) { console.error("ical sync", e); setMsg(T("Không đồng bộ được (hàm chạy nền có thể chưa được triển khai).", "Could not sync (the background function may not be deployed yet).")); }
    finally { setBusy(false); }
  };
  const edit = (i: number, patch: Partial<Feed>) => setFeeds(feeds.map((f, k) => (k === i ? { ...f, ...patch } : f)));
  const add = () => setFeeds([...feeds, { id: `f${Date.now().toString(36)}`, roomId: sorted[0]?.id ?? "", name: "", url: "" }]);
  const saveFeeds = () => {
    const clean = feeds.filter((f) => f.url.trim()).map((f) => ({ ...f, name: f.name.trim().slice(0, 60), url: f.url.trim() }));
    if (clean.some((f) => !/^https:\/\//i.test(f.url))) return setMsg(T("Đường dẫn nguồn phải bắt đầu bằng https://", "Source URLs must start with https://"));
    if (!token) return setMsg(T("Hãy tạo mã bí mật trước.", "Create the secret code first."));
    save(clean).then(() => audit("settings.ical", `Lưu ${clean.length} nguồn nhập iCal`));
  };

  return (
    <section id="ical-page">
      <h2>{T("Đồng bộ lịch (iCal)", "Calendar sync (iCal)")}</h2>
      <p><small>{T("Tránh bán trùng phòng giữa website này và Airbnb / Booking.com / Agoda…: (1) dán đường dẫn xuất của từng phòng vào kênh bán phòng để họ tự khóa các đêm đã có khách ở đây; (2) dán đường dẫn lịch của họ vào mục nhập bên dưới để các đêm khách đặt qua họ tự bị khóa ở đây (cập nhật mỗi giờ). Lịch xuất chỉ chứa ngày bận, không có tên hay liên hệ khách. Kênh bán phòng thường cập nhật lịch của họ sau vài giờ nên vẫn có khoảng trễ.", "Avoid double-booking between this site and Airbnb / Booking.com / Agoda: (1) paste each room's export URL into the channel so it blocks nights booked here; (2) paste the channel's calendar URL below so nights booked there are blocked here (refreshed hourly). The export holds busy dates only — no guest names or contacts. Channels refresh their copy every few hours, so a delay remains.")}</small></p>

      <div className="card">
        <h3>1. {T("Xuất lịch từng phòng", "Export each room's calendar")}</h3>
        {!token ? <button type="button" onClick={makeToken} disabled={!loaded}>{T("Tạo mã bí mật để bật xuất lịch", "Create the secret code to enable export")}</button> : (
          <>
            {sorted.map((r) => (
              <div className="row between" key={r.id}>
                <span><b>{r.name}</b> <small className="ical-url">{url(r.id)}</small></span>
                <button type="button" className="ghost" onClick={() => copy(r.id, url(r.id))}>{copied === r.id ? T("Đã chép", "Copied") : T("Sao chép", "Copy")}</button>
              </div>
            ))}
            <small>{T("Ai có đường dẫn đều xem được các ngày bận của phòng: đừng đăng công khai. Nếu lộ, bấm “Tạo mã mới”.", "Anyone with a URL can see the room's busy dates: do not publish them. If leaked, create a new code.")}</small>
            <div><button type="button" className="ghost danger" onClick={makeToken}>{T("Tạo mã mới", "Create a new code")}</button></div>
          </>
        )}
      </div>

      <div className="card">
        <h3>2. {T("Nhập lịch từ kênh bán phòng", "Import channel calendars")}</h3>
        {feeds.length === 0 && <small>{T("Chưa có nguồn nào. Trong Airbnb / Booking.com, tìm mục “Xuất lịch / Export calendar” của từng phòng và dán đường dẫn .ics vào đây.", "No sources yet. In Airbnb / Booking.com find each listing's “Export calendar” link and paste the .ics URL here.")}</small>}
        {feeds.map((f, i) => (
          <div className="card" key={f.id}>
            <div className="row">
              <select value={f.roomId} onChange={(e) => edit(i, { roomId: e.target.value })} aria-label={T("Phòng", "Room")}>{sorted.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
              <input value={f.name} maxLength={60} placeholder={T("Tên kênh (vd Airbnb)", "Channel name (e.g. Airbnb)")} onChange={(e) => edit(i, { name: e.target.value })} aria-label={T("Tên kênh", "Channel name")} />
              <button type="button" className="ghost danger" onClick={() => setFeeds(feeds.filter((_, k) => k !== i))}>{T("Xóa", "Remove")}</button>
            </div>
            <input value={f.url} placeholder="https://…/calendar.ics" onChange={(e) => edit(i, { url: e.target.value })} aria-label="URL" />
            {state[f.id] && <small className={state[f.id].ok ? "" : "overdue"}>{state[f.id].ok ? `✓ ${T("lần cuối", "last sync")} ${state[f.id].at?.toDate().toLocaleString(lang === "vi" ? "vi-VN" : "en-GB") ?? ""} · ${state[f.id].count ?? 0} ${T("khoảng ngày", "ranges")}` : `⚠ ${state[f.id].error ?? T("lỗi", "error")}`}</small>}
          </div>
        ))}
        <div className="row">
          <button type="button" className="ghost" onClick={add} disabled={sorted.length === 0}>＋ {T("Thêm nguồn", "Add source")}</button>
          <button type="button" onClick={saveFeeds}>{T("Lưu", "Save")}</button>
          <button type="button" className="ghost" onClick={sync} disabled={busy || feeds.length === 0}>{busy ? "…" : T("Đồng bộ ngay", "Sync now")}</button>
        </div>
        {msg && <small role="status">{msg}</small>}
        <small>{T("Các đêm nhập về hiện thành ô khóa trong “Khóa phòng theo ngày” và Lịch phòng. Nếu một đêm kênh đã nhận lại trùng đặt phòng của bạn, hệ thống báo chủ/quản lý qua Telegram để xử lý.", "Imported nights appear as blocks in “Block rooms” and the calendar. If a channel booking overlaps one of yours, owner/managers are alerted on Telegram.")}</small>
      </div>
    </section>
  );
}
