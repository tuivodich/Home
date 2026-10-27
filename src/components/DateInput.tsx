import { fmtDate } from "../lib/format";

interface Props {
  value: string; onChange: (v: string) => void; min?: string; max?: string; required?: boolean; id?: string;
}

/**
 * Ô chọn ngày luôn hiện dạng dd/mm/yyyy (Safari trên iPhone tự viết "27 thg 10, 2026" theo ngôn ngữ máy).
 * Vẫn dùng bộ chọn ngày gốc của thiết bị: ô gốc nằm dưới, chữ gốc bị ẩn, chữ dd/mm/yyyy phủ lên.
 */
export default function DateInput({ value, onChange, min, max, required, id }: Props) {
  return (
    <span className={`dateinp ${value ? "" : "empty"}`}>
      <input id={id} type="date" value={value} min={min} max={max} required={required} onChange={(e) => onChange(e.target.value)}
        onClick={(e) => { try { e.currentTarget.showPicker?.(); } catch { /* trình duyệt không cho mở: dùng cách gốc */ } }} />
      <span className="dateinp-txt" aria-hidden="true">{value ? fmtDate(value) : "dd/mm/yyyy"}</span>
    </span>
  );
}
