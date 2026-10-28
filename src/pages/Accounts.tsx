import { useState } from "react";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { ROLES, isStaffRole, type Role, type UserDoc } from "../lib/types";
import { EMPTY_PROFILE, saveProfile, useProfileDoc, type Profile } from "../lib/profile";
import ProfileFields from "../components/ProfileFields";
import { useG } from "../i18n/guest";

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


  const G = useG();
  const [editUid, setEditUid] = useState("");

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
              {isOwner && <button type="button" className="ghost" onClick={() => setEditUid(editUid === u.id ? "" : u.id)}>{G.ownerEdit}</button>}
              <select value={draft[u.id] ?? cur} disabled={locked || savingRoles} onChange={(e) => pickRole(u, e.target.value as Role)}>
                {ROLES.map((r) => <option key={r} value={r} disabled={!isOwner && (r === "owner" || r === "manager")}>{t(r)}</option>)}
              </select>
            </div>
          );
        })}
        {isOwner && editUid && <OwnerProfileEditor key={editUid} uid={editUid} email={users.find((u) => u.id === editUid)?.email ?? ""} onClose={() => setEditUid("")} />}
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

/** Chủ trang web sửa hồ sơ cá nhân của bất kỳ tài khoản nào (luật Firestore chỉ cho chủ). */
function OwnerProfileEditor({ uid, email, onClose }: { uid: string; email: string; onClose: () => void }) {
  const G = useG();
  const { profile, loading } = useProfileDoc(uid);
  const [v, setV] = useState<Profile | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const cur = v ?? (loading ? null : profile ?? { ...EMPTY_PROFILE, email });
  if (!cur) return null;
  return (
    <form className="card" onSubmit={async (e) => {
      e.preventDefault(); setMsg(""); setErr("");
      try { await saveProfile(uid, cur); setMsg(G.saved); } catch (ex) { console.error("owner edit profile", ex); setErr(G.failed); }
    }}>
      <h3>{G.ownerEditTitle} {email}</h3>
      <ProfileFields value={cur} onChange={setV} requireName={false} />
      {msg && <p className="ok-msg" role="status">{msg}</p>}
      {err && <p className="error">{err}</p>}
      <div className="row"><button type="submit">{G.save}</button><button type="button" className="ghost" onClick={onClose}>{G.cancel}</button></div>
    </form>
  );
}
