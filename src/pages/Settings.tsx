import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { DEFAULT_USD_RATE } from "../lib/format";
import { PALETTES, sceneSvg } from "../landing/forest";
import { READY_THEMES, THEME_IDS, THEME_INFO, parseSettings, DEFAULT_SETTINGS, type SiteSettings, type ThemeId } from "../lib/theme";
import { ROLES, isStaffRole, type Role, type UserDoc } from "../lib/types";

export default function Settings() {
  const { t, lang } = useI18n();
  const vi = lang === "vi";
  const [site, setSite] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const { user, profile } = useAuth();
  const [rate, setRate] = useState(DEFAULT_USD_RATE);
  const [autoReject, setAutoReject] = useState(true);
  const { data: users } = useCollection<UserDoc & { id: string }>("users", profile?.role === "owner" || profile?.role === "manager");

  useEffect(() => onSnapshot(doc(db, "settings", "app"), (s) => {
    if (typeof s.data()?.usdRate === "number") setRate(s.data()!.usdRate);
    setAutoReject(s.data()?.autoRejectPending !== false);
    setSite(parseSettings(s.data()));
  }, () => {}), []);

  return (
    <section>
      <h2>{t("settings")}</h2>
      <div className="card">
        <label>{t("usdRate")}
          <input type="number" min={1} value={rate} onChange={(e) => setRate(+e.target.value)} />
        </label>
        <small>{t("usdRateHint")}</small>
        <button onClick={() => setDoc(doc(db, "settings", "app"), { usdRate: rate }, { merge: true })}>{t("save")}</button>
      </div>
      <div className="card">
        <label className="check">
          <input type="checkbox" checked={autoReject} onChange={(e) => setDoc(doc(db, "settings", "app"), { autoRejectPending: e.target.checked }, { merge: true })} />
          <span>{t("autoReject")}</span>
        </label>
        <small>{t("autoRejectHint")}</small>
      </div>
      <div className="card" id="site-theme">
        <h3>{vi ? "Giao diện website" : "Website theme"}</h3>
        <small>{vi ? "Chỉ chủ và quản lý đổi được. Áp dụng cho trang khách xem; khu quản lý giữ nguyên." : "Owner and manager only. Applies to the public site; the staff area keeps its look."}</small>
        <div className="theme-grid">
          {THEME_IDS.map((id: ThemeId) => {
            const ready = READY_THEMES.includes(id);
            return (
              <button key={id} type="button" className={`theme-card ${site.theme === id ? "on" : ""}`} disabled={!ready} aria-pressed={site.theme === id}
                onClick={() => setDoc(doc(db, "settings", "app"), { theme: id }, { merge: true })}>
                <span className="theme-thumb" aria-hidden="true" dangerouslySetInnerHTML={{ __html: sceneSvg(PALETTES[id], { id: `t${id}`, cabinX: 800, cabinScale: 1.3, withTree: false, withSnowman: false }) }} />
                <strong>{vi ? THEME_INFO[id].vi : THEME_INFO[id].en}</strong>
                <small>{ready ? (vi ? THEME_INFO[id].descVi : THEME_INFO[id].descEn) : (vi ? "Sắp có" : "Coming soon")}</small>
              </button>
            );
          })}
        </div>
        <label className="check">
          <input type="checkbox" checked={site.effects} onChange={(e) => setDoc(doc(db, "settings", "app"), { effects: e.target.checked }, { merge: true })} />
          <span>{vi ? "Bật hiệu ứng (đom đóm, khói, ánh đèn)" : "Enable effects (fireflies, smoke, glow)"}</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={site.themeAuto} disabled={!READY_THEMES.includes("noel")} onChange={(e) => setDoc(doc(db, "settings", "app"), { themeAuto: e.target.checked }, { merge: true })} />
          <span>{vi ? "Tự chuyển sang Noel từ 01/12 đến 05/01 (sắp có)" : "Switch to Christmas automatically 1 Dec – 5 Jan (coming soon)"}</span>
        </label>
      </div>
      <div className="card">
        <h3>{t("staffAccounts")}</h3>
        {[...users].sort((a, b) => Number(isStaffRole(b.role)) - Number(isStaffRole(a.role)) || a.email.localeCompare(b.email)).map((u) => (
          <div className="row between" key={u.id}>
            <span>{u.email}</span>
            <select
              value={u.role === "pending" ? "customer" : u.role}
              disabled={u.id === user?.uid || (u.role === "owner" && profile?.role !== "owner")}
              onChange={(e) => updateDoc(doc(db, "users", u.id), { role: e.target.value as Role })}
            >
              {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
            </select>
          </div>
        ))}
      </div>
    </section>
  );
}
