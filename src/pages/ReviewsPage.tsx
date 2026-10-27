import { useEffect, useState, type FormEvent } from "react";
import { deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useI18n, useL } from "../i18n";
import { fmtDate } from "../lib/pages";
import { useApprovedReviews, type Review } from "../lib/reviews";
import { tgNotify } from "../lib/telegram";
import { useTitle } from "../lib/useTitle";
import SiteLayout from "../layout/SiteLayout";
import { useAuthUi } from "../layout/authUi";
import ReviewCard from "../components/ReviewCard";
import Stars from "../components/Stars";

function WriteReview() {
  const L = useL();
  const { user } = useAuth();
  const { open: openAuth } = useAuthUi();
  const uid = user?.uid;
  const [mine, setMine] = useState<Review | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!uid) { setMine(null); return; }
    // Mỗi tài khoản một cảm nhận: tài liệu có id = uid.
    return onSnapshot(doc(db, "reviews", uid), (s) => setMine(s.exists() ? ({ ...(s.data() as object), id: s.id } as Review) : null), () => setMine(null));
  }, [uid]);

  // Điền sẵn tên tài khoản MỘT lần khi đăng nhập; không điền lại khi người dùng xóa ô để nhập tên khác.
  useEffect(() => { setName(uid ? user?.displayName ?? "" : ""); }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = () => {
    if (!mine) return;
    setName(mine.name); setRating(mine.rating); setComment(mine.comment); setMsg(""); setErr(""); setEditing(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!uid) return;
    setBusy(true); setErr(""); setMsg("");
    const body = { name: name.trim(), rating, comment: comment.trim() };
    try {
      if (mine) await updateDoc(doc(db, "reviews", uid), { ...body, status: "pending" }); // sửa → duyệt lại
      else await setDoc(doc(db, "reviews", uid), { ...body, status: "pending", createdBy: uid, createdAt: serverTimestamp() });
      tgNotify("review");
      setMsg(L.reviews.thanks); setEditing(false); setComment("");
    } catch (ex) { console.error("review failed", ex); setErr(L.reviews.failed); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!uid || !confirm(L.reviews.sureDelete)) return;
    await deleteDoc(doc(db, "reviews", uid));
    setMsg(""); setComment(""); setRating(5);
  };

  const statusText = mine?.status === "approved" ? L.reviews.statusApproved : mine?.status === "rejected" ? L.reviews.statusRejected : L.reviews.statusPending;

  return (
    <section id="write" className="lp-panel lp-write">
      <h2>{L.reviews.writeTitle}</h2>
      {!user ? (
        <div className="lp-center">
          <button className="lp-btn primary" onClick={openAuth}>{L.reviews.signInPrompt}</button>
        </div>
      ) : mine && !editing ? (
        <div className="lp-mine">
          <div className="lp-mine-head"><strong>{L.reviews.yourReview}</strong><span className={`lp-status ${mine.status === "approved" ? "checked_in" : mine.status === "rejected" ? "cancelled" : "pending"}`}>{statusText}</span></div>
          <Stars value={mine.rating} label={L.reviews.stars} />
          <p>{mine.comment}</p>
          <small className="lp-muted">{mine.name}</small>
          <small className="lp-muted">{L.reviews.editNote}</small>
          {msg && <p className="lp-ok">{msg}</p>}
          <div className="lp-editor-actions">
            <button className="lp-pill" onClick={startEdit}>✎ {L.doc.edit}</button>
            <button className="lp-pill danger" onClick={remove}>{L.reviews.delete}</button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="lp-form">
          <label>{L.reviews.name}<input id="review-name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /><small className="lp-muted">{L.reviews.nameHint}</small></label>
          <div className="lp-field"><span>{L.reviews.rating}</span><Stars value={rating} onChange={setRating} label={L.reviews.stars} /></div>
          <label>{L.reviews.comment}<textarea id="review-comment" required minLength={10} maxLength={600} rows={5} value={comment} onChange={(e) => setComment(e.target.value)} /><small className="lp-muted">{L.reviews.commentHint} ({comment.trim().length}/600)</small></label>
          {err && <p className="lp-error">{err}</p>}
          <div className="lp-editor-actions">
            <button className="lp-btn primary sm" type="submit" disabled={busy || comment.trim().length < 10}>{busy ? L.reviews.sending : mine ? L.reviews.update : L.reviews.send}</button>
            {editing && <button type="button" className="lp-btn ghost sm" onClick={() => setEditing(false)}>{L.doc.cancel}</button>}
          </div>
          <small className="lp-muted">{L.reviews.thanks}</small>
        </form>
      )}
    </section>
  );
}

export default function ReviewsPage() {
  const L = useL();
  const { lang } = useI18n();
  const { reviews, avg, loading } = useApprovedReviews();
  useTitle(L.reviews.title);

  // Mở bằng /reviews#write thì cuộn tới ô viết cảm nhận.
  useEffect(() => {
    if (location.hash === "#write") setTimeout(() => document.getElementById("write")?.scrollIntoView({ behavior: "smooth" }), 80);
  }, []);

  return (
    <SiteLayout>
      <main className="lp-page">
        <div className="lp-wrap lp-doc wide">
          <span className="lp-eyebrow">{L.menu.info}</span>
          <h1>{L.reviews.title}</h1>
          <p className="lp-muted">{L.reviews.sub}</p>
          {reviews.length > 0 && <p className="lp-avg"><Stars value={avg} label={L.reviews.stars} /> <strong>{avg.toFixed(1)}</strong> / 5 · {reviews.length} {L.reviews.count}</p>}

          {!loading && reviews.length === 0 && <p className="lp-muted">{L.reviews.none}</p>}
          <div className="lp-reviews">
            {reviews.map((r) => (
              <ReviewCard key={r.id} r={r} />
            ))}
          </div>
          <WriteReview />
        </div>
      </main>
    </SiteLayout>
  );
}
