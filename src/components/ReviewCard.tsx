import { useI18n, useL } from "../i18n";
import { fmtDate } from "../lib/pages";
import type { Review } from "../lib/reviews";
import Stars from "./Stars";

const initial = (name: string) => (Array.from(name.trim())[0] ?? "★").toUpperCase();

/** Thẻ cảm nhận đã được duyệt: dấu trích dẫn lớn, sao vàng, ảnh đại diện chữ cái đầu. Dùng ở trang chủ và trang Cảm nhận. */
export default function ReviewCard({ r, reveal, featured }: { r: Review; reveal?: boolean; featured?: boolean }) {
  const L = useL();
  const { lang } = useI18n();
  return (
    <figure className={`lp-review${featured ? " featured" : ""}${reveal ? " reveal" : ""}`}>
      <span className="lp-quote" aria-hidden="true">“</span>
      <Stars value={r.rating} label={L.reviews.stars} />
      <blockquote>{r.comment}</blockquote>
      <figcaption>
        <span className="lp-avatar" aria-hidden="true">{initial(r.name)}</span>
        <span className="lp-who"><strong>{r.name}</strong>{r.createdAt && <small>{fmtDate(r.createdAt, lang)}</small>}</span>
      </figcaption>
    </figure>
  );
}
