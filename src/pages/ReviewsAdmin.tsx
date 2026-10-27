import { useMemo, useState } from "react";
import { deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
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
  const [filter, setFilter] = useState<Filter>("pending");

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

      {list.length === 0 && <p>{t("noData")}</p>}
      {list.map((r) => (
        <div className="card" key={r.id}>
          <div className="row between">
            <strong>{r.name}</strong>
            <span className={`tag ${r.status === "approved" ? "checked_in" : r.status === "rejected" ? "cancelled" : "pending"}`}>{label[r.status]}</span>
          </div>
          <Stars value={r.rating} />
          <div style={{ whiteSpace: "pre-wrap" }}>{r.comment}</div>
          <small>{users.find((u) => u.id === r.createdBy)?.email ?? r.createdBy}{r.createdAt && ` · ${fmtDate(r.createdAt, lang)}`}</small>
          <div className="row">
            {r.status !== "approved" && <button onClick={() => setStatus(r, "approved")}>{t("reviewApprove")}</button>}
            {r.status !== "rejected" && <button className="ghost danger" onClick={() => setStatus(r, "rejected")}>{t("reviewReject")}</button>}
            {r.status !== "pending" && <button className="ghost" onClick={() => setStatus(r, "pending")}>{t("reviewBackToPending")}</button>}
            <button className="ghost danger" onClick={() => confirm(t("sure")) && deleteDoc(doc(db, "reviews", r.id))}>{t("delete")}</button>
          </div>
        </div>
      ))}
    </section>
  );
}
