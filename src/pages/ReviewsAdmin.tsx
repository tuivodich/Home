import { useMemo, useState } from "react";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { fmtDate } from "../lib/pages";
import type { Review, ReviewStatus } from "../lib/reviews";
import type { UserDoc } from "../lib/types";
import Stars from "../components/Stars";

type Filter = ReviewStatus | "all";

/** Duyệt cảm nhận của khách (chủ/quản lý): chỉ cảm nhận đã duyệt mới hiện công khai. */
export default function ReviewsAdmin() {
  const { t, lang } = useI18n();
  const { data: reviews } = useCollection<Review>("reviews");
  const { data: users } = useCollection<UserDoc & { id: string }>("users");
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner";
  const [filter, setFilter] = useState<Filter>("pending");
  const [edit, setEdit] = useState<{ id: string; name: string; rating: number; comment: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const validEdit = !!edit && edit.name.trim().length >= 1 && edit.name.trim().length <= 80 && edit.comment.trim().length >= 10 && edit.comment.trim().length <= 600;
  // Chỉ chủ sửa được nội dung (kể cả đã duyệt); trạng thái duyệt giữ nguyên.
  const saveEdit = async () => {
    if (!edit || !validEdit) return;
    setErr(""); setMsg("");
    try {
      await updateDoc(doc(db, "reviews", edit.id), { name: edit.name.trim(), rating: edit.rating, comment: edit.comment.trim() });
      setEdit(null); setMsg(t("reviewSaved"));
    } catch (ex) { console.error("review edit failed", ex); setErr(t("error")); }
  };

  const counts = useMemo(() => ({
    pending: reviews.filter((r) => r.status === "pending").length,
    approved: reviews.filter((r) => r.status === "approved").length,
    rejected: reviews.filter((r) => r.status === "rejected").length,
    all: reviews.length,
  }), [reviews]);
  const list = useMemo(() => reviews.filter((r) => filter === "all" || r.status === filter)
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)), [reviews, filter]);

  const setStatus = (r: Review, status: ReviewStatus) => updateDoc(doc(db, "reviews", r.id), { status });
  const label: Record<Filter, string> = { pending: t("reviewPending"), approved: t("reviewApproved"), rejected: t("reviewRejected"), all: t("all") };

  return (
    <section>
      <h2>{t("reviewsAdmin")}</h2>
      <p><small>{t("reviewsHint")}</small></p>
      <div className="card">
        <div className="segbar" role="group">
          {(["pending", "approved", "rejected", "all"] as const).map((k) => (
            <button key={k} type="button" className={`seg ${filter === k ? "on" : ""}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label[k]} ({counts[k]})</button>
          ))}
        </div>
      </div>

      {msg && <p className="ok-msg">{msg}</p>}
      {err && <p className="error">{err}</p>}
      {list.length === 0 && <p>{t("noData")}</p>}
      {list.map((r) => (
        <div className="card" key={r.id}>
          <div className="row between">
            <strong>{r.name}</strong>
            <span className={`tag ${r.status === "approved" ? "checked_in" : r.status === "rejected" ? "cancelled" : "pending"}`}>{label[r.status]}</span>
          </div>
          {edit?.id === r.id ? (
            <>
              <label>{t("displayName")}<input maxLength={80} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
              <Stars value={edit.rating} onChange={(n) => setEdit({ ...edit, rating: n })} />
              <textarea rows={4} maxLength={600} value={edit.comment} onChange={(e) => setEdit({ ...edit, comment: e.target.value })} aria-label={t("reviewEdit")} />
              <small>{edit.comment.trim().length}/600 · {t("reviewEditNote")}</small>
              <div className="row">
                <button type="button" disabled={!validEdit} onClick={saveEdit}>{t("save")}</button>
                <button type="button" className="ghost" onClick={() => setEdit(null)}>{t("cancel")}</button>
              </div>
            </>
          ) : (
            <>
              <Stars value={r.rating} />
              <div style={{ whiteSpace: "pre-wrap" }}>{r.comment}</div>
            </>
          )}
          <small>{users.find((u) => u.id === r.createdBy)?.email ?? r.createdBy}{r.createdAt && ` · ${fmtDate(r.createdAt, lang)}`}</small>
          <div className="row">
            {r.status !== "approved" && <button onClick={() => setStatus(r, "approved")}>{t("reviewApprove")}</button>}
            {r.status !== "rejected" && <button className="ghost danger" onClick={() => setStatus(r, "rejected")}>{t("reviewReject")}</button>}
            {r.status !== "pending" && <button className="ghost" onClick={() => setStatus(r, "pending")}>{t("reviewBackToPending")}</button>}
            {isOwner && edit?.id !== r.id && <button className="ghost" onClick={() => { setMsg(""); setErr(""); setEdit({ id: r.id, name: r.name, rating: r.rating, comment: r.comment }); }}>✎ {t("reviewEdit")}</button>}
            <button className="ghost danger" onClick={() => confirm(t("sure")) && deleteDoc(doc(db, "reviews", r.id))}>{t("delete")}</button>
          </div>
        </div>
      ))}
    </section>
  );
}
