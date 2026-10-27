import { useMemo, useState } from "react";
import DateInput from "./DateInput";
import { useI18n } from "../i18n";
import { normDocNumber, normName } from "../lib/format";
import type { Guest } from "../lib/types";

export interface GuestForm {
  fullName: string; docType: Guest["docType"]; docNumber: string; nationality: string; dob: string; phone: string; email: string;
}
export const emptyGuestForm: GuestForm = { fullName: "", docType: "cccd", docNumber: "", nationality: "Việt Nam", dob: "", phone: "", email: "" };

/** Số giấy tờ là duy nhất: `other` = khách khác tên cùng số (cần cảnh báo đỏ), `same` = cùng tên (khách cũ). */
export function conflictsFor(guests: Guest[], docType: string, docNumber: string, fullName: string, selfId?: string) {
  const n = normDocNumber(docNumber);
  if (n.length < 4) return { other: [] as Guest[], same: [] as Guest[] };
  const hits = guests.filter((g) => g.id !== selfId && g.docType === docType && normDocNumber(g.docNumber) === n);
  const nm = normName(fullName);
  return { other: hits.filter((g) => normName(g.fullName) !== nm), same: hits.filter((g) => normName(g.fullName) === nm) };
}

interface Props {
  value: GuestForm;
  onChange: (v: GuestForm) => void;
  guests: Guest[];
  selfId?: string;
  file: File | null;
  onFile: (f: File | null) => void;
  fileKey?: string;
  hasPhoto?: boolean;
  docRequired?: boolean;
  noSuggest?: boolean;
}

/** Các ô nhập thông tin khách dùng chung cho trang Khách lưu trú và Đặt phòng mới (gợi ý tên, cảnh báo trùng giấy tờ). */
export default function GuestFields({ value: v, onChange, guests, selfId, onFile, fileKey, hasPhoto, docRequired = true, noSuggest }: Props) {
  const { t } = useI18n();
  const [show, setShow] = useState(false);
  const set = (patch: Partial<GuestForm>) => onChange({ ...v, ...patch });

  // Gợi ý khách đã có (theo họ tên hoặc số giấy tờ), mỗi người một dòng.
  const suggestions = useMemo(() => {
    const q = normName(v.fullName);
    const qd = normDocNumber(v.fullName);
    if (!show || noSuggest || !q) return [];
    const seen = new Set<string>();
    const out: Guest[] = [];
    for (const g of [...guests].sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"))) {
      const key = g.docType + normDocNumber(g.docNumber);
      if (seen.has(key)) continue;
      if (normName(g.fullName).includes(q) || (qd.length >= 3 && normDocNumber(g.docNumber).includes(qd))) {
        seen.add(key); out.push(g);
        if (out.length >= 6) break;
      }
    }
    return out;
  }, [guests, v.fullName, show, noSuggest]);

  const live = conflictsFor(guests, v.docType, v.docNumber, v.fullName, selfId);

  const pick = (g: Guest) => {
    // Giữ lại điện thoại/email đã điền sẵn (ví dụ từ đặt phòng) thay vì ghi đè bằng của lần trước.
    onChange({ ...v, fullName: g.fullName, docType: g.docType, docNumber: g.docNumber, nationality: g.nationality, dob: g.dob, phone: v.phone || g.phone, email: v.email || g.email || "" });
    setShow(false);
  };

  return (
    <>
      <label className="suggest">{t("fullName")}
        <input required autoComplete="off" value={v.fullName}
          onChange={(e) => { set({ fullName: e.target.value }); setShow(true); }}
          onFocus={() => setShow(true)} onBlur={() => setTimeout(() => setShow(false), 150)} />
        {suggestions.length > 0 && (
          <ul>
            <li style={{ cursor: "default" }}><small>{t("suggestGuests")}</small></li>
            {suggestions.map((g) => (
              <li key={g.id} onMouseDown={(e) => { e.preventDefault(); pick(g); }}>
                <span>{g.fullName}</span><small>{t(g.docType)}: {g.docNumber}</small>
              </li>
            ))}
          </ul>
        )}
      </label>
      <label>{t("docType")}
        <select value={v.docType} onChange={(e) => set({ docType: e.target.value as Guest["docType"] })}>
          {(["cccd", "passport", "license", "other"] as const).map((k) => <option key={k} value={k}>{t(k)}</option>)}
        </select>
      </label>
      <label>{t("docNumber")}<input required={docRequired} value={v.docNumber} onChange={(e) => set({ docNumber: e.target.value })} /></label>
      {live.other.length > 0 && (
        <p className="warn">{t("dupOther")}: {live.other.map((g) => `${g.fullName} (${t(g.docType)} ${g.docNumber})`).join("; ")}</p>
      )}
      {live.other.length === 0 && live.same.length > 0 && <p className="info">{t("dupSame")}</p>}
      <label>{t("nationality")}<input value={v.nationality} onChange={(e) => set({ nationality: e.target.value })} /></label>
      <label>{t("dob")}<DateInput value={v.dob} onChange={(v) => set({ dob: v })} /></label>
      <label>{t("phone")}<input type="tel" value={v.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
      <label>{t("email")}<input type="email" value={v.email} onChange={(e) => set({ email: e.target.value })} /></label>
      <label>{t("docImage")}{hasPhoto && <small>{t("keepPhotoHint")}</small>}
        <input key={fileKey ?? "new"} type="file" accept="image/*" capture="environment" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      </label>
    </>
  );
}
