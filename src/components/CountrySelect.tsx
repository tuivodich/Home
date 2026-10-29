import { useState } from "react";
import { COUNTRIES, matchCountry } from "../lib/countries";
import { useI18n } from "../i18n";

const OTHER = "__other__";

/**
 * Ô chọn quốc tịch dạng danh sách (tên tiếng Anh quốc tế). Có mục "Khác" để tự nhập khi không thấy quốc gia;
 * giá trị đã lưu cũ như "Việt Nam" vẫn được nhận ra là Vietnam, giá trị lạ hiện ở ô nhập "Khác".
 */
export default function CountrySelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  const { lang } = useI18n();
  const known = matchCountry(value);
  const [pickedOther, setPickedOther] = useState(false);
  const showOther = pickedOther || (!!value.trim() && !known);
  const selected = showOther ? OTHER : (known ?? "");
  return (
    <>
      <select id={id} value={selected} onChange={(e) => {
        const v = e.target.value;
        if (v === OTHER) { setPickedOther(true); if (known) onChange(""); }
        else { setPickedOther(false); onChange(v); }
      }}>
        <option value="">{lang === "vi" ? "— Chọn quốc tịch —" : "— Select nationality —"}</option>
        {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
        <option value={OTHER}>{lang === "vi" ? "Khác (tự nhập tên quốc gia)" : "Other (type the country)"}</option>
      </select>
      {showOther && <input maxLength={60} value={value} placeholder={lang === "vi" ? "Nhập tên quốc gia (tiếng Anh)" : "Country name (in English)"} onChange={(e) => onChange(e.target.value)} aria-label={lang === "vi" ? "Quốc gia khác" : "Other country"} />}
    </>
  );
}
