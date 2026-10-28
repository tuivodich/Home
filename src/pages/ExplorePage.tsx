import { useState } from "react";
import { useAuth } from "../lib/auth";
import { useI18n } from "../i18n";
import { useX } from "../i18n/explore";
import { CAT_EMOJI, PLACE_CATS, placeLink, saveExplore, useExplore, type Place, type PlaceCat } from "../lib/explore";
import { mapPoint, safeUrl, useContact } from "../lib/contact";
import { useTitle } from "../lib/useTitle";
import SiteLayout from "../layout/SiteLayout";
import RichText from "../components/RichText";

/** Điểm tham quan đẹp: bản đồ nhúng, hướng dẫn đường đi và địa điểm gợi ý (chủ/quản lý chỉnh sửa được). */
export default function ExplorePage() {
  const X = useX();
  const { lang } = useI18n();
  const { profile } = useAuth();
  const canEdit = profile?.role === "owner" || profile?.role === "manager";
  const { doc: ex, custom, loading } = useExplore();
  const contact = useContact();
  const [cat, setCat] = useState<PlaceCat | "all">("all");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ex);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useTitle(X.title);

  const en = lang === "en";
  const pick = (vi: string, e: string) => (en && e.trim() ? e : vi);
  const address = contact.address.trim();
  // Bản đồ nhúng mặc định ở lớp ảnh vệ tinh (t=k): ưu tiên tọa độ (ô tọa độ hoặc đường dẫn bản đồ dài), không có thì tìm theo địa chỉ.
  const pt = mapPoint(contact);
  const query = pt ? `${pt.lat},${pt.lng}` : address;
  const embed = query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&t=k&z=17&output=embed` : "";
  const dirLink = safeUrl(contact.mapUrl) ?? (query ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}` : "");
  const shown = ex.places.filter((p) => cat === "all" || p.cat === cat);

  const patchPlace = (i: number, p: Partial<Place>) => setDraft({ ...draft, places: draft.places.map((x, k) => (k === i ? { ...x, ...p } : x)) });
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= draft.places.length) return;
    const next = [...draft.places]; [next[i], next[j]] = [next[j], next[i]]; setDraft({ ...draft, places: next });
  };
  const save = async () => {
    setBusy(true); setMsg("");
    try {
      await saveExplore({ directionsVi: draft.directionsVi.trim(), directionsEn: draft.directionsEn.trim(), places: draft.places.filter((p) => p.nameVi.trim()).map((p) => ({ ...p, nameVi: p.nameVi.trim(), nameEn: p.nameEn.trim(), distance: p.distance.trim(), descVi: p.descVi.trim(), descEn: p.descEn.trim(), mapUrl: /^https?:\/\/\S+$/i.test(p.mapUrl.trim()) ? p.mapUrl.trim() : "" })) });
      setEditing(false); setMsg(X.saved);
    } catch (ex2) { console.error("save explore", ex2); setMsg(X.failed); } finally { setBusy(false); }
  };

  return (
    <SiteLayout>
      <main className="lp-page lp-pines">
        <div className="lp-wrap lp-doc wide">
          <span className="lp-eyebrow">{X.title}</span>
          <h1>{X.title}</h1>
          <p className="lp-muted">{X.sub}</p>
          {canEdit && !editing && <div className="lp-admin-bar"><button className="lp-pill solid" onClick={() => { setDraft({ ...ex, places: ex.places.map((p) => ({ ...p })) }); setMsg(""); setEditing(true); }}>✎ {X.edit}</button></div>}
          {canEdit && !custom && !loading && !editing && <p className="lp-muted lp-small">ℹ {X.sample}</p>}
          {msg && <p className={msg === X.failed ? "lp-error" : "lp-ok"}>{msg}</p>}

          {editing ? (
            <div className="lp-editor">
              <p className="lp-muted lp-small">{X.editorHint}</p>
              <label>{X.dirVi}<textarea rows={6} value={draft.directionsVi} onChange={(e) => setDraft({ ...draft, directionsVi: e.target.value })} /></label>
              <label>{X.dirEn}<textarea rows={6} value={draft.directionsEn} onChange={(e) => setDraft({ ...draft, directionsEn: e.target.value })} /></label>
              {draft.places.map((p, i) => (
                <fieldset key={i} className="lp-qa-edit">
                  <legend>#{i + 1}</legend>
                  <label>{X.nameVi}<input value={p.nameVi} onChange={(e) => patchPlace(i, { nameVi: e.target.value })} /></label>
                  <label>{X.nameEn}<input value={p.nameEn} onChange={(e) => patchPlace(i, { nameEn: e.target.value })} /></label>
                  <label>{X.cat}<select value={p.cat} onChange={(e) => patchPlace(i, { cat: e.target.value as PlaceCat })}>{PLACE_CATS.map((c) => <option key={c} value={c}>{X[c]}</option>)}</select></label>
                  <label>{X.distance}<input value={p.distance} onChange={(e) => patchPlace(i, { distance: e.target.value })} /></label>
                  <label>{X.descVi}<textarea rows={3} value={p.descVi} onChange={(e) => patchPlace(i, { descVi: e.target.value })} /></label>
                  <label>{X.descEn}<textarea rows={3} value={p.descEn} onChange={(e) => patchPlace(i, { descEn: e.target.value })} /></label>
                  <label>{X.mapUrl}<input value={p.mapUrl} onChange={(e) => patchPlace(i, { mapUrl: e.target.value })} /></label>
                  <div className="lp-editor-actions">
                    <button type="button" className="lp-pill" disabled={i === 0} onClick={() => move(i, -1)}>↑ {X.up}</button>
                    <button type="button" className="lp-pill" disabled={i === draft.places.length - 1} onClick={() => move(i, 1)}>↓ {X.down}</button>
                    <button type="button" className="lp-pill danger" onClick={() => setDraft({ ...draft, places: draft.places.filter((_, k) => k !== i) })}>{X.remove}</button>
                  </div>
                </fieldset>
              ))}
              <div className="lp-editor-actions"><button type="button" className="lp-pill solid" onClick={() => setDraft({ ...draft, places: [...draft.places, { nameVi: "", nameEn: "", cat: "sight", distance: "", descVi: "", descEn: "", mapUrl: "" }] })}>+ {X.addPlace}</button></div>
              <div className="lp-editor-actions">
                <button className="lp-btn primary sm" onClick={save} disabled={busy}>{busy ? X.saving : X.save}</button>
                <button className="lp-btn ghost sm" onClick={() => setEditing(false)} disabled={busy}>{X.cancel}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="lp-explore-top">
                <div className="lp-panel lp-map">
                  <h2>{X.map}</h2>
                  {embed
                    ? <iframe title={X.map} src={embed} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                    : <p className="lp-muted">{X.noAddress}</p>}
                  {address && <p className="lp-muted">📍 {address}</p>}
                  {dirLink && <div className="lp-editor-actions"><a className="lp-btn primary sm" href={dirLink} target="_blank" rel="noopener noreferrer">{X.directions}</a></div>}
                </div>
                <div className="lp-panel">
                  <h2>{X.directionsTitle}</h2>
                  <RichText text={pick(ex.directionsVi, ex.directionsEn)} />
                </div>
              </div>

              <h2 className="lp-places-title">{X.placesTitle}</h2>
              <div className="lp-chips" role="group">
                {(["all", ...PLACE_CATS] as const).map((c) => <button key={c} type="button" className={`lp-chip ${cat === c ? "on" : ""}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{c === "all" ? X.all : `${CAT_EMOJI[c]} ${X[c]}`}</button>)}
              </div>
              {!loading && shown.length === 0 && <p className="lp-muted">{X.none}</p>}
              <div className="lp-places">
                {shown.map((p, i) => (
                  <article key={i} className="lp-place">
                    <span className="lp-place-cat" aria-hidden="true">{CAT_EMOJI[p.cat]}</span>
                    <h3>{pick(p.nameVi, p.nameEn)}</h3>
                    {p.distance && <small className="lp-place-dist">🧭 {p.distance}</small>}
                    <p>{pick(p.descVi, p.descEn)}</p>
                    <a className="lp-pill" href={placeLink(p, address)} target="_blank" rel="noopener noreferrer">{X.viewOnMap} ↗</a>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </SiteLayout>
  );
}
