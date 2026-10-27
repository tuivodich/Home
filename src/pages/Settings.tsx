import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { DEFAULT_USD_RATE } from "../lib/format";
import { PALETTES, sceneSvg } from "../landing/forest";
import { READY_THEMES, THEME_IDS, THEME_INFO, parseSettings, DEFAULT_MAX_PENDING, DEFAULT_SETTINGS, type SiteSettings, type ThemeId } from "../lib/theme";
import { ROLES, isStaffRole, type Role, type UserDoc } from "../lib/types";

export default function Settings() {
  const { t, lang } = useI18n();
  const vi = lang === "vi";
  const [site, setSite] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const { user, profile } = useAuth();
  const [rate, setRate] = useState(DEFAULT_USD_RATE);
  const [autoReject, setAutoReject] = useState(true);
  const [maxPending, setMaxPending] = useState(DEFAULT_MAX_PENDING);
  const { data: users } = useCollection<UserDoc & { id: string }>("users", profile?.role === "owner" || profile?.role === "manager");

  const isOwner = profile?.role === "owner";
  // Vai trò chọn nhưng chưa lưu: chỉ áp dụng khi bấm "Lưu lại".
  const [draft, setDraft] = useState<Record<string, Role>>({});
  const [savingRoles, setSavingRoles] = useState(false);
  const [roleMsg, setRoleMsg] = useState("");
  const [roleErr, setRoleErr] = useState("");
  const dirty = Object.keys(draft).length;
  const pickRole = (u: UserDoc & { id: string }, r: Role) => {
    const cur: Role = u.role === "pending" ? "customer" : u.role;
    setRoleMsg(""); setRoleErr("");
    setDraft((d) => { const n = { ...d }; if (r === cur) delete n[u.id]; else n[u.id] = r; return n; });
  };
  const saveRoles = async () => {
    setSavingRoles(true); setRoleMsg(""); setRoleErr("");
    try {
      const w = writeBatch(db);
      Object.entries(draft).forEach(([id, role]) => w.update(doc(db, "users", id), { role }));
      await w.commit();
      setDraft({}); setRoleMsg(t("rolesSaved"));
    } catch (ex) { console.error("save roles failed", ex); setRoleErr(t("rolesFailed")); }
    finally { setSavingRoles(false); }
  };

  useEffect(() => onSnapshot(doc(db, "settings", "app"), (s) => {
    if (typeof s.data()?.usdRate === "number") setRate(s.data()!.usdRate);
    setAutoReject(s.data()?.autoRejectPending !== false);
    if (typeof s.data()?.maxPending === "number") setMaxPending(s.data()!.maxPending);
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
      <div className="card">
        <label>{vi ? "Số yêu cầu đặt phòng đang chờ xác nhận tối đa mỗi tài khoản" : "Max pending booking requests per account"}
          <input type="number" min={1} max={20} step={1} value={maxPending} onChange={(e) => setMaxPending(+e.target.value)} />
        </label>
        <small>{vi ? "Chống đặt phòng bừa bãi: khách chưa được nhân viên xử lý hết yêu cầu thì không đặt thêm được. Yêu cầu đã xác nhận không tính." : "Stops spam bookings: a guest cannot send more until staff handle the pending ones. Confirmed bookings do not count."}</small>
        <button disabled={!Number.isInteger(maxPending) || maxPending < 1 || maxPending > 20} onClick={() => setDoc(doc(db, "settings", "app"), { maxPending }, { merge: true })}>{t("save")}</button>
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
        {[...users].sort((a, b) => Number(isStaffRole(b.role)) - Number(isStaffRole(a.role)) || a.email.localeCompare(b.email)).map((u) => {
          const cur: Role = u.role === "pending" ? "customer" : u.role;
          // Chủ đổi được mọi tài khoản khác; quản lý chỉ chỉnh các vai trò dưới quản lý và không cấp "Chủ"/"Quản lý".
          const locked = u.id === user?.uid || (!isOwner && (u.role === "owner" || u.role === "manager"));
          return (
            <div className={`row between ${draft[u.id] ? "changed" : ""}`} key={u.id}>
              <span>{u.email}</span>
              <select value={draft[u.id] ?? cur} disabled={locked || savingRoles} onChange={(e) => pickRole(u, e.target.value as Role)}>
                {ROLES.map((r) => <option key={r} value={r} disabled={!isOwner && (r === "owner" || r === "manager")}>{t(r)}</option>)}
              </select>
            </div>
          );
        })}
        <div className="rolebar">
          <button type="button" disabled={dirty === 0 || savingRoles} onClick={saveRoles}>{t("rolesSave")}{dirty > 0 && ` (${dirty})`}</button>
          <button type="button" className="ghost" disabled={dirty === 0 || savingRoles} onClick={() => { setDraft({}); setRoleErr(""); }}>{t("rolesCancel")}</button>
        </div>
        {roleMsg && <p className="ok-msg" role="status">{roleMsg}</p>}
        {roleErr && <p className="error">{roleErr}</p>}
      </div>
    </section>
  );
}
