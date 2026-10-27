import { useI18n } from "../i18n";
import GuestImage from "./GuestImage";
import type { Guest } from "../lib/types";

export default function GuestInfo({ g, large }: { g: Guest; large?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="guestinfo">
      <div>
        <strong>{g.fullName}</strong>
        <div>{t(g.docType)}: {g.docNumber}</div>
        <div>{t("nationality")}: {g.nationality}</div>
        {g.dob && <div>{t("dob")}: {g.dob}</div>}
        {g.phone && <div>{t("phone")}: {g.phone}</div>}
        {g.email && <div>{t("email")}: {g.email}</div>}
      </div>
      <GuestImage path={g.docImagePath} large={large} />
    </div>
  );
}
