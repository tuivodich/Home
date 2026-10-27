import { useEffect, useState } from "react";
import { getDownloadURL, ref } from "firebase/storage";
import { storage } from "../lib/firebase";
import { useI18n } from "../i18n";

/** Hiển thị ảnh giấy tờ lưu trong Firebase Storage; bấm vào để mở ảnh lớn. */
export default function GuestImage({ path, large }: { path: string; large?: boolean }) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUrl(""); setFailed(false);
    if (!path) return;
    let alive = true;
    getDownloadURL(ref(storage, path)).then((u) => alive && setUrl(u)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [path]);

  if (!path) return <small>{t("noImage")}</small>;
  if (failed) return <small className="error">{t("imageError")}</small>;
  if (!url) return <small>{t("loading")}</small>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" title={t("openFull")}>
      <img className={large ? "docimg large" : "docimg"} src={url} alt="ID" />
    </a>
  );
}
