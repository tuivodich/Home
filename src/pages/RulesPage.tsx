import { useState } from "react";
import { useAuth } from "../lib/auth";
import { useI18n, useL } from "../i18n";
import { fmtDate, saveRules, useRules } from "../lib/pages";
import { DEFAULT_RULES } from "../lib/defaultContent";
import { useTitle } from "../lib/useTitle";
import SiteLayout from "../layout/SiteLayout";
import RichText from "../components/RichText";

export default function RulesPage() {
  const L = useL();
  const { lang } = useI18n();
  const { profile } = useAuth();
  const canEdit = profile?.role === "owner" || profile?.role === "manager";
  const { doc, loading } = useRules();
  const [editing, setEditing] = useState(false);
  const [vi, setVi] = useState("");
  const [en, setEn] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useTitle(L.doc.rulesTitle);

  const start = () => { setVi(doc.vi); setEn(doc.en); setMsg(""); setEditing(true); };
  const save = async () => {
    setBusy(true); setMsg("");
    try { await saveRules({ vi, en }); setEditing(false); setMsg(L.doc.saved); }
    catch (ex) { console.error("save rules", ex); setMsg(L.doc.failed); }
    finally { setBusy(false); }
  };

  const text = lang === "en" && doc.en.trim() ? doc.en : doc.vi;

  return (
    <SiteLayout>
      <main className="lp-page">
        <div className="lp-wrap lp-doc">
          <span className="lp-eyebrow">{L.menu.info}</span>
          <h1>{L.doc.rulesTitle}</h1>
          <p className="lp-muted">{L.doc.rulesSub}{doc.updatedAt && <> · {L.doc.updated}: {fmtDate(doc.updatedAt, lang)}</>}</p>
          {canEdit && !editing && <div className="lp-admin-bar"><button className="lp-pill solid" onClick={start}>✎ {L.doc.edit}</button></div>}
          {msg && <p className={msg === L.doc.failed ? "lp-error" : "lp-ok"}>{msg}</p>}

          {editing ? (
            <div className="lp-editor">
              <p className="lp-muted lp-small">{L.doc.editorHint}</p>
              <label>{L.doc.viLabel}<textarea id="rules-vi" rows={22} value={vi} onChange={(e) => setVi(e.target.value)} /></label>
              <label>{L.doc.enLabel}<textarea id="rules-en" rows={22} value={en} onChange={(e) => setEn(e.target.value)} /></label>
              <div className="lp-editor-actions">
                <button className="lp-btn primary sm" onClick={save} disabled={busy}>{busy ? L.doc.saving : L.doc.save}</button>
                <button className="lp-btn ghost sm" onClick={() => setEditing(false)} disabled={busy}>{L.doc.cancel}</button>
                <button className="lp-pill" onClick={() => { if (confirm(L.doc.resetSure)) { setVi(DEFAULT_RULES.vi); setEn(DEFAULT_RULES.en); } }}>{L.doc.resetDefault}</button>
              </div>
            </div>
          ) : (!loading && <RichText text={text} />)}
        </div>
      </main>
    </SiteLayout>
  );
}
