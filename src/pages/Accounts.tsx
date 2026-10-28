import { useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { ROLES, isStaffRole, type Role, type UserDoc } from "../lib/types";

/** Tài khoản nhân viên (chủ/quản lý): chọn vai trò rồi bấm "Lưu lại" mới áp dụng; "Hủy bỏ" trả về vai trò đã lưu. */
export default function Accounts() {
  const { t } = useI18n();
  const { user, profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const { data: users } = useCollection<UserDoc & { id: string }>("users", profile?.role === "owner" || profile?.role === "manager");
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


  return (
    <section>
      <h2>{t("staffAccounts")}</h2>
      <div className="card">
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
