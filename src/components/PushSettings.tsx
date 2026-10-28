import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { useI18n } from "../i18n";
import { disablePush, enablePush, pushStillRegistered, pushSupported } from "../lib/push";

/** Bật/tắt thông báo đẩy trên thiết bị đang dùng (nhân viên: yêu cầu đặt phòng mới, hủy, cảm nhận, phòng cần dọn…). */
export default function PushSettings() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const vi = lang === "vi";
  const [supported, setSupported] = useState<boolean | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { pushSupported().then(setSupported); pushStillRegistered().then(setOn); }, []);

  const toggle = async () => {
    if (!user) return;
    setBusy(true); setErr("");
    try {
      if (on) { await disablePush(); setOn(false); } else { await enablePush(user.uid); setOn(true); }
    } catch (ex) {
      const m = (ex as Error).message;
      setErr(m === "denied" ? (vi ? "Bạn đã chặn thông báo cho trang này. Hãy cho phép trong cài đặt trình duyệt rồi thử lại." : "Notifications are blocked for this site. Allow them in your browser settings and try again.")
        : (vi ? "Không bật được thông báo trên thiết bị này." : "Could not enable notifications on this device."));
      console.error("push", ex);
    } finally { setBusy(false); }
  };

  return (
    <div className="card" id="push-settings">
      <h3>{vi ? "Thông báo đẩy trên thiết bị này" : "Push notifications on this device"}</h3>
      <small>{vi ? "Nhận thông báo yêu cầu đặt phòng mới, khách hủy, cảm nhận mới, phòng cần dọn ngay trên điện thoại/máy tính, bổ sung cho Telegram. Trên iPhone: thêm trang vào Màn hình chính trước (Chia sẻ → Thêm vào MH chính)." : "Get new booking requests, cancellations, reviews and rooms to clean right on this device, in addition to Telegram. On iPhone, add the site to the Home Screen first."}</small>
      {supported === false ? <p className="warn">{vi ? "Trình duyệt này chưa hỗ trợ thông báo đẩy." : "This browser does not support push notifications."}</p> : (
        <div className="rolebar"><button type="button" disabled={busy || supported === null} onClick={toggle}>{on ? (vi ? "Tắt thông báo trên thiết bị này" : "Turn off on this device") : (vi ? "Bật thông báo trên thiết bị này" : "Turn on for this device")}</button></div>
      )}
      {on && <p className="ok-msg">✅ {vi ? "Đã bật trên thiết bị này." : "Enabled on this device."}</p>}
      {err && <p className="error">{err}</p>}
    </div>
  );
}
