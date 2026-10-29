import { useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { fmtDate } from "../lib/format";
import { mailCampaign } from "../lib/telegram";
import { useProfileDoc } from "../lib/profile";
import type { Booking, UserDoc } from "../lib/types";

interface Contact { email: string; name: string }
const BATCH = 100;
const SHOWN = 300;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");
const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/;

/** Quản lý email → Gửi email khách hàng: soạn nội dung (khuyến mãi, thông báo…), tìm/chọn người nhận rồi gửi. */
export default function EmailSendPage() {
  const { lang } = useI18n();
  const T = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const { user, profile } = useAuth();
  const { profile: myProfile } = useProfileDoc(user?.uid);
  const { data: users } = useCollection<UserDoc & { id: string }>("users");
  const { data: bookings } = useCollection<Booking>("bookings");
  const { data: campaigns } = useCollection<{ id: string; subject: string; sent: number; failed: number; rejected: number; at?: { toDate(): Date } }>("mailCampaigns");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  // Địa chỉ nhận thư thử: chỉ các email của chính bạn (Tài khoản của tôi, tài khoản quản trị, email đăng nhập).
  const myEmails = useMemo(() => {
    const seen = new Set<string>(); const out: string[] = [];
    for (const e of [myProfile?.email, profile?.email, user?.email]) { const v = (e ?? "").trim().toLowerCase(); if (EMAIL_RE.test(v) && !seen.has(v)) { seen.add(v); out.push(v); } }
    return out;
  }, [myProfile?.email, profile?.email, user?.email]);
  const [testTo, setTestTo] = useState("");
  const testAddr = myEmails.includes(testTo) ? testTo : (myEmails[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Danh bạ khách: tài khoản khách + email ghi trong đặt phòng; gộp theo email (không phân biệt hoa thường).
  const contacts = useMemo(() => {
    const map = new Map<string, Contact>();
    const add = (email: string | undefined, name: string) => {
      const e = (email ?? "").trim().toLowerCase();
      if (!EMAIL_RE.test(e)) return;
      const cur = map.get(e);
      if (!cur || (!cur.name && name)) map.set(e, { email: e, name: name.trim() });
    };
    users.filter((u) => u.role === "customer" || u.role === "pending").forEach((u) => add(u.email, u.name ?? ""));
    bookings.forEach((b) => add(b.email, b.guestName));
    return [...map.values()].sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email, "vi"));
  }, [users, bookings]);

  const filtered = useMemo(() => {
    const k = norm(q.trim());
    return k ? contacts.filter((c) => norm(c.name).includes(k) || c.email.includes(k)) : contacts;
  }, [contacts, q]);

  const toggle = (email: string) => setPicked((s) => { const n = new Set(s); if (n.has(email)) n.delete(email); else n.add(email); return n; });
  const selectFiltered = () => setPicked((s) => new Set([...s, ...filtered.map((c) => c.email)]));
  const clearAll = () => setPicked(new Set());
  const allFilteredPicked = filtered.length > 0 && filtered.every((c) => picked.has(c.email));

  const run = async (to: string[], label: string, test = false) => {
    setBusy(true); setMsg(""); setErr(""); setProgress("");
    try {
      let sent = 0, failed = 0, rejected = 0;
      for (let i = 0; i < to.length; i += BATCH) {
        setProgress(T(`Đang gửi… ${Math.min(i + BATCH, to.length)}/${to.length}`, `Sending… ${Math.min(i + BATCH, to.length)}/${to.length}`));
        const r = await mailCampaign(subject.trim(), body.trim(), to.slice(i, i + BATCH), test);
        sent += r.sent; failed += r.failed; rejected += r.rejected;
      }
      const detail = `${failed ? T(`, lỗi ${failed}`, `, failed ${failed}`) : ""}${rejected ? T(`, bỏ qua ${rejected} địa chỉ không hợp lệ hoặc không có trong hệ thống`, `, skipped ${rejected}`) : ""}`;
      if (sent === 0) { setErr(T(`${label}: không gửi được email nào${detail}.`, `${label}: nothing was sent${detail}.`)); return; }
      setMsg(test
        ? T(`Đã gửi thử tới ${to[0]}. Thư có thể mất vài phút; nếu không thấy hãy kiểm tra Thư rác/Quảng cáo hoặc chọn địa chỉ khác bên dưới.`, `Test sent to ${to[0]}. It can take a few minutes; check Spam/Promotions or pick another address below.`)
        : T(`${label}: đã gửi ${sent} email${detail}.`, `${label}: sent ${sent}${detail}.`));
      if (!test) setPicked(new Set());
    } catch (ex) {
      console.error("campaign", ex);
      setErr((ex as { message?: string }).message?.replace(/^.*?: /, "") || T("Không gửi được. Vui lòng thử lại.", "Could not send."));
    } finally { setBusy(false); setProgress(""); }
  };

  const valid = subject.trim().length > 0 && body.trim().length > 0;
  const send = () => {
    const to = [...picked];
    if (!valid || !to.length) return;
    if (!confirm(T(`Gửi email “${subject.trim()}” tới ${to.length} người?`, `Send “${subject.trim()}” to ${to.length} people?`))) return;
    void run(to, T("Gửi hàng loạt", "Campaign"));
  };
  const sendTest = () => {
    if (!valid || !testAddr) return;
    void run([testAddr], T("Gửi thử", "Test"), true);
  };

  return (
    <section>
      <h2>{T("Gửi email khách hàng", "Email customers")}</h2>
      <p><small>{T("Soạn thư khuyến mãi hoặc thông báo rồi chọn người nhận. Chỉ gửi được tới các địa chỉ đã có trong hệ thống (tài khoản khách, email trong đặt phòng). Gmail thường giới hạn khoảng 500 email mỗi ngày. Cần tài khoản gửi email ở mục Cài đặt email.", "Write a promotion or announcement, then pick recipients. Only addresses already in the system can be used. Gmail usually limits about 500 emails a day. Needs the sender account in Email settings.")}</small></p>

      <div className="card">
        <h3>{T("Nội dung", "Message")}</h3>
        <label>{T("Tiêu đề", "Subject")}<input maxLength={150} value={subject} onChange={(e) => { setSubject(e.target.value); setMsg(""); }} placeholder={T("Ưu đãi mùa Noel — giảm 15%", "Christmas offer — 15% off")} /></label>
        <label>{T("Nội dung (xuống dòng để tách đoạn; dán đường dẫn http(s) sẽ thành liên kết)", "Body (blank line = new paragraph; http(s) links become clickable)")}
          <textarea rows={8} maxLength={5000} value={body} onChange={(e) => { setBody(e.target.value); setMsg(""); }} />
          <small>{body.trim().length}/5000</small>
        </label>
        <div className="row">
          {myEmails.length > 1 ? (
            <label>{T("Gửi thử tới", "Send test to")}
              <select value={testAddr} onChange={(e) => setTestTo(e.target.value)}>{myEmails.map((e) => <option key={e} value={e}>{e}</option>)}</select>
            </label>
          ) : <small>{T("Gửi thử tới", "Test goes to")}: <b>{testAddr || "—"}</b></small>}
          <button type="button" className="ghost" disabled={busy || !valid || !testAddr} onClick={sendTest}>{T("Gửi thử cho tôi", "Send me a test")}</button>
        </div>
      </div>

      <div className="card" id="mail-recipients">
        <h3>{T("Người nhận", "Recipients")} <small>({picked.size} {T("đã chọn", "selected")} / {contacts.length})</small></h3>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Tìm theo tên hoặc email…", "Search by name or email…")} aria-label={T("Tìm người nhận", "Search recipients")} />
        <div className="row">
          <button type="button" className="ghost" disabled={!filtered.length || allFilteredPicked} onClick={selectFiltered}>{q.trim() ? T(`Chọn tất cả kết quả (${filtered.length})`, `Select all results (${filtered.length})`) : T(`Chọn tất cả (${filtered.length})`, `Select all (${filtered.length})`)}</button>
          <button type="button" className="ghost" disabled={!picked.size} onClick={clearAll}>{T("Bỏ chọn tất cả", "Clear selection")}</button>
        </div>
        {contacts.length === 0 && <small>{T("Chưa có khách nào có email.", "No customers with an email yet.")}</small>}
        <div className="mail-list">
          {filtered.slice(0, SHOWN).map((c) => (
            <label key={c.email} className="check"><input type="checkbox" checked={picked.has(c.email)} onChange={() => toggle(c.email)} /><span>{c.name ? `${c.name} · ` : ""}{c.email}</span></label>
          ))}
        </div>
        {filtered.length > SHOWN && <small>{T(`Chỉ hiện ${SHOWN} người đầu; dùng ô tìm kiếm để thu hẹp, hoặc “Chọn tất cả” để chọn cả ${filtered.length} người.`, `Showing the first ${SHOWN}; search to narrow down, or “Select all” to pick all ${filtered.length}.`)}</small>}
        <div className="rolebar">
          <button type="button" disabled={busy || !valid || !picked.size} onClick={send}>{T(`Gửi tới ${picked.size} người`, `Send to ${picked.size}`)}</button>
        </div>
        {progress && <p role="status">{progress}</p>}
        {msg && <p className="ok-msg" role="status">{msg}</p>}
        {err && <p className="error">{err}</p>}
      </div>

      <div className="card">
        <h3>{T("Lần gửi gần đây", "Recent sends")}</h3>
        {campaigns.length === 0 && <small>{T("Chưa gửi lần nào.", "Nothing sent yet.")}</small>}
        {[...campaigns].sort((a, b) => (b.at?.toDate().getTime() ?? 0) - (a.at?.toDate().getTime() ?? 0)).slice(0, 10).map((c) => (
          <div className="row between" key={c.id}><span>{c.subject}</span><small>{c.at ? fmtDate(c.at.toDate().toISOString().slice(0, 10)) : ""} · {c.sent} {T("đã gửi", "sent")}{c.failed ? ` · ${c.failed} ${T("lỗi", "failed")}` : ""}</small></div>
        ))}
      </div>
    </section>
  );
}
