import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";

export type ReviewStatus = "pending" | "approved" | "rejected";
export interface Review {
  id: string; name: string; rating: number; comment: string; status: ReviewStatus; createdBy: string; createdAt?: { seconds: number };
}

/** Các cảm nhận đã được duyệt (công khai), mới nhất trước. */
export function useApprovedReviews() {
  const [list, setList] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => onSnapshot(query(collection(db, "reviews"), where("status", "==", "approved")), (snap) => {
    setList(snap.docs.map((d) => ({ ...(d.data() as object), id: d.id }) as Review));
    setLoading(false);
  }, (e) => { console.error("reviews", e); setLoading(false); }), []);
  const sorted = useMemo(() => [...list].sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)), [list]);
  const avg = sorted.length ? sorted.reduce((s, r) => s + r.rating, 0) / sorted.length : 0;
  return { reviews: sorted, avg, loading };
}
