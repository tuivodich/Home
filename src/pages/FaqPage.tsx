import { useState } from "react";
import { useAuth } from "../lib/auth";
import { useI18n, useL } from "../i18n";
import { fmtDate, saveFaq, useFaq } from "../lib/pages";
import { DEFAULT_FAQ, type FaqItem } from "../lib/defaultContent";
import { useTitle } from "../lib/useTitle";
import SiteLayout from "../layout/SiteLayout";
import RichText from "../components/RichText";

export default function FaqPage() {
  const L = useL();
  const { lang } = useI18n();
  const { profile } = useAuth();
  const canEdit = profile?.role === "owner" || profile?.role === "manager";
  const { items, updatedAt, loading } = useFaq();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FaqItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useTitle(L.doc.faqTitle);

  const start = () => { setDraft(items.map((i) => ({ ...i }))); setMsg(""); setEditing(true); };
  const patch = (idx: number, p: Partial<FaqItem>) => setDraft(draft.map((it, i) => (i === idx ? { ...it, ...p } : it)));
  const move = (idx: number, d: -1 | 1) => {
    const j = idx + d;
    if (j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[idx], next[j]] = [next[j], next[idx]];
    setDraft(next);
  };
  const save = async () => {
    setBusy(true); setMsg("");
    try {
      const clean = draft.filter((i) => i.qVi.trim() && i.aVi.trim());
      await saveFaq(clean.map((i) => ({ qVi: i.qVi.trim(), aVi: i.aVi.trim(), qEn: i.qEn.trim(), aEn: i.aEn.trim() })));
      setEditing(false); setMsg(L.doc.saved);
    } catch (ex) { console.error("save faq", ex); setMsg(L.doc.failed); }
    finally { setBusy(false); }
  };

  return (
    <SiteLayout>
      <main className="lp-page">
        <div className="lp-wrap lp-doc">
          <span className="lp-eyebrow">{L.menu.info}</span>
          <h1>{L.doc.faqTitle}</h1>
          <p className="lp-muted">{L.doc.faqSub}{updatedAt && <> · {L.doc.updated}: {fmtDate(updatedAt, lang)}</>}</p>
          {canEdit && !editing && <div className="lp-admin-bar"><button className="lp-pill solid" onClick={start}>✎ {L.doc.edit}</button></div>}
          {msg && <p className={msg === L.doc.failed ? "lp-error" : "lp-ok"}>{msg}</p>}

          {editing ? (
            <div className="lp-editor">
              <p className="lp-muted lp-small">{L.doc.editorHint}</p>
              {draft.map((it, i) => (
                <fieldset key={i} className="lp-qa-edit">
                  <legend>#{i + 1}</legend>
                  <label>{L.doc.question} ({L.doc.viLabel})<input id={`faq-qvi-${i}`} value={it.qVi} onChange={(e) => patch(i, { qVi: e.target.value })} /></label>
                  <label>{L.doc.answer} ({L.doc.viLabel})<textarea id={`faq-avi-${i}`} rows={4} value={it.aVi} onChange={(e) => patch(i, { aVi: e.target.value })} /></label>
                  <label>{L.doc.question} ({L.doc.enLabel})<input id={`faq-qen-${i}`} value={it.qEn} onChange={(e) => patch(i, { qEn: e.target.value })} /></label>
                  <label>{L.doc.answer} ({L.doc.enLabel})<textarea id={`faq-aen-${i}`} rows={4} value={it.aEn} onChange={(e) => patch(i, { aEn: e.target.value })} /></label>
                  <div className="lp-editor-actions">
                    <button type="button" className="lp-pill" onClick={() => move(i, -1)} disabled={i === 0}>↑ {L.doc.moveUp}</button>
                    <button type="button" className="lp-pill" onClick={() => move(i, 1)} disabled={i === draft.length - 1}>↓ {L.doc.moveDown}</button>
                    <button type="button" className="lp-pill danger" onClick={() => setDraft(draft.filter((_, k) => k !== i))}>{L.doc.removeQ}</button>
                  </div>
                </fieldset>
              ))}
              <div className="lp-editor-actions">
                <button type="button" className="lp-pill solid" onClick={() => setDraft([...draft, { qVi: "", aVi: "", qEn: "", aEn: "" }])}>+ {L.doc.addQ}</button>
              </div>
              <div className="lp-editor-actions">
                <button className="lp-btn primary sm" onClick={save} disabled={busy}>{busy ? L.doc.saving : L.doc.save}</button>
                <button className="lp-btn ghost sm" onClick={() => setEditing(false)} disabled={busy}>{L.doc.cancel}</button>
                <button className="lp-pill" onClick={() => { if (confirm(L.doc.resetSure)) setDraft(DEFAULT_FAQ.map((i) => ({ ...i }))); }}>{L.doc.resetDefault}</button>
              </div>
            </div>
          ) : (!loading && (
            <div className="lp-qa-list">
              {items.map((it, i) => {
                const q = lang === "en" && it.qEn.trim() ? it.qEn : it.qVi;
                const a = lang === "en" && it.aEn.trim() ? it.aEn : it.aVi;
                return (
                  <details key={i} className="lp-qa">
                    <summary>{q}</summary>
                    <RichText text={a} />
                  </details>
                );
              })}
            </div>
          ))}
        </div>
      </main>
    </SiteLayout>
  );
}
