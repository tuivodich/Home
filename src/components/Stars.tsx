/** Hiển thị (hoặc chọn) số sao 1–5. Có `onChange` thì là bộ chọn bằng nút, dùng được bằng bàn phím. */
export default function Stars({ value, onChange, label }: { value: number; onChange?: (n: number) => void; label?: string }) {
  const star = (on: boolean) => (
    <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.8L12 16.8 6.7 19.6l1.1-5.8L3.5 9.7l5.9-.8z" />
    </svg>
  );
  if (!onChange) {
    return <span className="lp-stars" role="img" aria-label={`${value} / 5 ${label ?? ""}`}>{[1, 2, 3, 4, 5].map((n) => <i key={n}>{star(n <= Math.round(value))}</i>)}</span>;
  }
  return (
    <span className="lp-stars pick" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${label ?? ""}`} onClick={() => onChange(n)}>{star(n <= value)}</button>
      ))}
    </span>
  );
}
