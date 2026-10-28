import { useAuth } from "../lib/auth";
import { useI18n } from "../i18n";
import MailSettings from "../components/MailSettings";

/** Quản lý email → Cài đặt email: bật/tắt email tự động cho khách, tên người gửi, gửi thử. */
export default function EmailSettingsPage() {
  const { profile } = useAuth();
  const { lang } = useI18n();
  return (
    <section>
      <h2>{lang === "vi" ? "Cài đặt email" : "Email settings"}</h2>
      <MailSettings isOwner={profile?.role === "owner"} />
    </section>
  );
}
