import DateInput from "./DateInput";
import type { Profile } from "../lib/profile";
import { useG } from "../i18n/guest";

/** Các ô thông tin cá nhân giống biểu mẫu "Khách lưu trú" (không có ảnh giấy tờ): dùng ở Tài khoản của tôi, đặt phòng, check-in online. */
export default function ProfileFields({ value, onChange, requireName = true }: { value: Profile; onChange: (p: Profile) => void; requireName?: boolean }) {
  const G = useG();
  const set = (patch: Partial<Profile>) => onChange({ ...value, ...patch });
  return (
    <>
      <label>{G.fullName}<input required={requireName} maxLength={100} value={value.fullName} onChange={(e) => set({ fullName: e.target.value })} /></label>
      <label>{G.docType}
        <select value={value.docType} onChange={(e) => set({ docType: e.target.value as Profile["docType"] })}>
          {(["cccd", "passport", "license", "other"] as const).map((k) => <option key={k} value={k}>{G[k]}</option>)}
        </select>
      </label>
      <label>{G.docNumber}<input maxLength={30} value={value.docNumber} onChange={(e) => set({ docNumber: e.target.value })} /></label>
      <label>{G.nationality}<input maxLength={60} value={value.nationality} onChange={(e) => set({ nationality: e.target.value })} /></label>
      <label>{G.dob}<DateInput value={value.dob} onChange={(v) => set({ dob: v })} /></label>
      <label>{G.phone}<input type="tel" maxLength={30} value={value.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
      <label>{G.email}<input type="email" maxLength={200} value={value.email} onChange={(e) => set({ email: e.target.value })} /></label>
    </>
  );
}
