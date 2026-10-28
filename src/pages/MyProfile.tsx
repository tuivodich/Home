import { useEffect, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { EMPTY_PROFILE, saveProfile, useProfileDoc, type Profile } from "../lib/profile";
import { useTitle } from "../lib/useTitle";
import SiteLayout from "../layout/SiteLayout";
import ProfileFields from "../components/ProfileFields";
import { useG } from "../i18n/guest";
import { fillP } from "../i18n/pricing";
import { useMyTier } from "../lib/loyalty";
import TierBadge from "../components/TierBadge";

/** "Tài khoản của tôi": mỗi người sửa hồ sơ của chính mình (họ tên, giấy tờ, quốc tịch, ngày sinh, điện thoại, email). */
export default function MyProfile() {
  const G = useG();
  const { user, loading } = useAuth();
  const { profile, loading: pl } = useProfileDoc(user?.uid);
  const my = useMyTier(user?.uid);
  const [v, setV] = useState<Profile>(EMPTY_PROFILE);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useTitle(G.myAccount);

  // Lần đầu: điền sẵn từ tài khoản (tên Google, email) để người dùng chỉ cần bổ sung phần còn lại.
  useEffect(() => {
    if (pl || !user) return;
    setV(profile ?? { ...EMPTY_PROFILE, fullName: user.displayName ?? "", email: user.email ?? "" });
  }, [pl, profile, user]);

  if (loading) return null;
  if (!user) return <Navigate to="/?login=1" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(""); setErr("");
    try { await saveProfile(user.uid, v); setMsg(G.saved); } catch (ex) { console.error("save profile", ex); setErr(G.failed); } finally { setBusy(false); }
  };

  return (
    <SiteLayout>
      <main className="lp-page">
        <div className="lp-wrap lp-doc">
          <h1>{G.myAccount}</h1>
          <p className="lp-muted">{user.displayName || user.email} · {G.myAccountSub}</p>
          <form className="lp-panel lp-form" onSubmit={submit}>
            <ProfileFields value={v} onChange={(p) => { setMsg(""); setV(p); }} />
            <p className="lp-muted lp-small">🔒 {G.privacy}</p>
            {msg && <p className="lp-ok" role="status">{msg}</p>}
            {err && <p className="lp-error">{err}</p>}
            <div><button className="lp-btn primary" type="submit" disabled={busy}>{G.save}</button></div>
          </form>
          {my.cfg.enabled && my.tier && (
            <section className="lp-panel lp-member" aria-labelledby="member-h">
              <h2 id="member-h">{G.tierSection}</h2>
              <p><TierBadge tier={my.tier} /> · {G.perksStays}: <b>{my.count}</b>{my.member?.tier ? <span className="lp-muted lp-small"> · {G.tierManual}</span> : null}</p>
              <p className="lp-muted lp-small">{my.next ? fillP(G.perksNext, { n: my.next.minBookings - my.count, t: my.next.name }) : G.perksTop}</p>
              <p className="lp-muted lp-small">{G.tierNote}</p>
            </section>
          )}
        </div>
      </main>
    </SiteLayout>
  );
}
