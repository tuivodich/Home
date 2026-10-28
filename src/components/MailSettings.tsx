import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useI18n } from "../i18n";
import { mailStatus, mailTest } from "../lib/telegram";

/** Email thông báo cho khách (đã nhận yêu cầu / xác nhận / hủy / nhắc lịch): chủ bật tắt; tài khoản gửi là secret SMTP_USER/SMTP_PASS trên GitHub. */
export default function MailSettings({ isOwner }: { isOwner: boolean }) {
  const { lang } = useI18n();
  const vi = lang === "vi";
  const [cfg, setCfg] = useState({ enabled: false, fromName: "", replyTo: "" });
  const [draft, setDraft] = useState(cfg);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [to, setTo] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => onSnapshot(doc(db, "settings", "mail"), (s) => {
    const d = s.data();
    const v = { enabled: d?.enabled === true, fromName: String(d?.fromName ?? ""), replyTo: String(d?.replyTo ?? "") };
    setCfg(v); setDraft(v);
  }, () => {}), []);
  useEffect(() => { mailStatus().then((r) => setConfigured(r.configured)).catch(() => setConfigured(null)); }, []);

  const dirty = JSON.stringify(draft) !== JSON.stringify(cfg);
  const save = async () => {
    setBusy(true); setMsg(""); setErr("");
    try { await setDoc(doc(db, "settings", "mail"), { enabled: draft.enabled, fromName: draft.fromName.trim(), replyTo: draft.replyTo.trim() }); setMsg(vi ? "Đã lưu cấu hình email." : "Email settings saved."); }
    catch (ex) { console.error("save mail", ex); setErr(vi ? "Không lưu được. Vui lòng thử lại." : "Could not save."); } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setMsg(""); setErr("");
    try { await mailTest(to.trim()); setMsg(vi ? `Đã gửi email thử tới ${to.trim()}.` : `Test email sent to ${to.trim()}.`); }
    catch (ex) { setErr((ex as { message?: string }).message?.replace(/^.*?: /, "") || (vi ? "Không gửi được." : "Could not send.")); } finally { setBusy(false); }
  };

  return (
    <div className="card" id="mail-settings">
      <h3>{vi ? "Email thông báo cho khách" : "Guest email notifications"}</h3>
      <small>{vi
        ? "Khi bật, khách nhận email: đã nhận yêu cầu, đã xác nhận (kèm thông tin cọc/VietQR), không còn hiệu lực, và nhắc lịch trước ngày nhận phòng 1 ngày. Cần tài khoản gửi email (vd Gmail + mật khẩu ứng dụng) khai báo ở GitHub secrets SMTP_USER, SMTP_PASS — xem docs/email.md."
        : "When on, guests get emails: request received, confirmed (with deposit / VietQR details), no longer valid, and a reminder the day before check-in. Needs a sender account (e.g. Gmail app password) in GitHub secrets SMTP_USER, SMTP_PASS — see docs/email.md."}</small>
      <p className={configured ? "ok-msg" : "warn"}>{configured === null ? "…" : configured ? (vi ? "✅ Đã có tài khoản gửi email." : "✅ A sender account is configured.") : (vi ? "⚠ Chưa có tài khoản gửi email (SMTP_USER / SMTP_PASS)." : "⚠ No sender account yet (SMTP_USER / SMTP_PASS).")}</p>
      <label className="check"><input type="checkbox" disabled={!isOwner} checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} /><span>{vi ? "Gửi email cho khách" : "Send emails to guests"}</span></label>
      <label>{vi ? "Tên người gửi" : "Sender name"}<input disabled={!isOwner} maxLength={60} placeholder="Nhà Gỗ Homestay" value={draft.fromName} onChange={(e) => setDraft({ ...draft, fromName: e.target.value })} /></label>
      <label>{vi ? "Email nhận trả lời của khách (tùy chọn)" : "Reply-to email (optional)"}<input disabled={!isOwner} type="email" maxLength={200} value={draft.replyTo} onChange={(e) => setDraft({ ...draft, replyTo: e.target.value })} /></label>
      {isOwner ? (
        <>
          <div className="rolebar">
            <button type="button" disabled={!dirty || busy} onClick={save}>{vi ? "Lưu lại" : "Save"}</button>
            <button type="button" className="ghost" disabled={!dirty || busy} onClick={() => { setDraft(cfg); setMsg(""); setErr(""); }}>{vi ? "Hủy bỏ" : "Discard"}</button>
          </div>
          <div className="row">
            <input type="email" placeholder={vi ? "Email nhận thư thử" : "Test recipient"} value={to} onChange={(e) => setTo(e.target.value)} />
            <button type="button" className="ghost" disabled={busy || !to.trim() || !configured} onClick={test}>{vi ? "Gửi thử" : "Send test"}</button>
          </div>
        </>
      ) : <small>{vi ? "Chỉ chủ chỉnh được." : "Owner only."}</small>}
      {msg && <p className="ok-msg" role="status">{msg}</p>}
      {err && <p className="error">{err}</p>}
    </div>
  );
}
