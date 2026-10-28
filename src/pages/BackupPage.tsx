import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useI18n } from "../i18n";
import { backupGet, backupList, backupNow, type BackupStatus } from "../lib/telegram";

/** Các bộ sưu tập sao lưu: giữ giống functions/backup.js (không gồm ảnh giấy tờ trong Storage). */
const COLLECTIONS = ["users", "profiles", "members", "rooms", "roomStatus", "bookings", "busy", "guests", "precheckins", "coupons", "reviews", "pages", "settings", "expenses", "shifts", "schedule", "attendance", "tgChats"];
const SETTINGS_IDS = ["app", "contact", "pricing", "booking", "bank", "loyalty", "backup", "backupStatus"];
const plain = (v: unknown): unknown => {
  if (v && typeof v === "object") {
    const o = v as { toDate?: () => Date; seconds?: number };
    if (typeof o.toDate === "function" && typeof o.seconds === "number") return { __ts: o.toDate().toISOString() };
    if (Array.isArray(v)) return v.map(plain);
    return Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, plain(x)]));
  }
  return v;
};
const save = (name: string, text: string) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
const mb = (n?: number) => (n ? `${(n / 1024 / 1024).toFixed(2)} MB` : "—");

/** Sao lưu dữ liệu (chỉ chủ): tải về máy, sao lưu lên Cloud Storage ngay, và lịch sao lưu tự động hằng ngày/tuần. */
export default function BackupPage() {
  const { lang } = useI18n();
  const T = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const [cfg, setCfg] = useState({ enabled: false, frequency: "daily" as "daily" | "weekly", keep: 14 });
  const [saved, setSaved] = useState(cfg);
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [files, setFiles] = useState<{ name: string; bytes: number }[] | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => onSnapshot(doc(db, "settings", "backup"), (s) => {
    const d = s.data();
    const v = { enabled: d?.enabled === true, frequency: (d?.frequency === "weekly" ? "weekly" : "daily") as "daily" | "weekly", keep: typeof d?.keep === "number" ? d.keep : 14 };
    setSaved(v); setCfg(v);
  }, () => {}), []);
  useEffect(() => onSnapshot(doc(db, "settings", "backupStatus"), (s) => setStatus(s.exists() ? (s.data() as BackupStatus) : null), () => {}), []);

  const run = async (key: string, f: () => Promise<void>) => {
    setBusy(key); setMsg(""); setErr("");
    try { await f(); } catch (ex) {
      console.error("backup", ex);
      setErr((ex as { message?: string }).message?.replace(/^.*?: /, "") || T("Có lỗi, vui lòng thử lại.", "Something went wrong."));
    } finally { setBusy(""); }
  };
  const refresh = () => backupList().then(setFiles);

  const download = () => run("dl", async () => {
    const out: Record<string, unknown> = {}; const failed: string[] = [];
    await Promise.all(COLLECTIONS.map(async (c) => {
      try {
        // Cả bộ "settings" không liệt kê được (luật ẩn tài khoản ngân hàng khỏi truy vấn chung) nên đọc từng tài liệu.
        const docs = c === "settings"
          ? (await Promise.all(SETTINGS_IDS.map((id) => getDoc(doc(db, "settings", id))))).filter((d) => d.exists())
          : (await getDocs(collection(db, c))).docs;
        out[c] = Object.fromEntries(docs.map((d) => [d.id, plain(d.data())]));
      } catch { failed.push(c); }
    }));
    const now = new Date();
    save(`nhago-backup-${now.toISOString().slice(0, 16).replace(/[-:T]/g, "")}.json`, JSON.stringify({ app: "nhago-homestay", createdAt: now.toISOString(), collections: out }));
    setMsg(failed.length ? T(`Đã tải về (không đọc được: ${failed.join(", ")}).`, `Downloaded (could not read: ${failed.join(", ")}).`) : T("Đã tải bản sao lưu về máy.", "Backup downloaded."));
  });

  return (
    <section>
      <h2>{T("Sao lưu dữ liệu", "Data backup")}</h2>
      <p><small>{T("Bản sao lưu gồm đặt phòng, khách, hồ sơ, giá, cài đặt, chi phí, chấm công… (không gồm ảnh giấy tờ trong Storage). Chứa thông tin cá nhân của khách: hãy cất giữ cẩn thận.", "Backups include bookings, guests, profiles, pricing, settings, expenses, attendance… (not the ID photos in Storage). They contain guests' personal data: keep them safe.")}</small></p>
      {msg && <p className="ok-msg" role="status">{msg}</p>}
      {err && <p className="error">{err}</p>}

      <div className="card" id="backup-manual">
        <h3>{T("Sao lưu thủ công", "Manual backup")}</h3>
        <div className="row">
          <button disabled={!!busy} onClick={download}>⬇ {T("Tải bản sao lưu về máy (JSON)", "Download a backup (JSON)")}</button>
          <button className="ghost" disabled={!!busy} onClick={() => run("now", async () => { const s = await backupNow(); setMsg(T(`Đã sao lưu lên Cloud Storage: ${s.file} (${mb(s.bytes)}).`, `Backed up to Cloud Storage: ${s.file} (${mb(s.bytes)}).`)); await refresh(); })}>☁ {T("Sao lưu lên Cloud Storage ngay", "Back up to Cloud Storage now")}</button>
        </div>
        <small>{T("Muốn lưu thêm vào Google Drive: tải file JSON về rồi tải lên Drive (hoặc kéo thả vào thư mục Drive đồng bộ).", "To keep a copy in Google Drive: download the JSON and upload it to Drive.")}</small>
      </div>

      <div className="card" id="backup-auto">
        <h3>{T("Sao lưu tự động lên Cloud Storage", "Automatic backup to Cloud Storage")}</h3>
        <label className="check"><input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })} /><span>{T("Bật sao lưu tự động (chạy lúc 02:00 giờ Việt Nam)", "Enable automatic backups (02:00 Vietnam time)")}</span></label>
        <div className="row shiftform">
          <label>{T("Tần suất", "Frequency")}<select value={cfg.frequency} onChange={(e) => setCfg({ ...cfg, frequency: e.target.value as "daily" | "weekly" })}><option value="daily">{T("Mỗi ngày", "Daily")}</option><option value="weekly">{T("Mỗi tuần (Chủ nhật)", "Weekly (Sunday)")}</option></select></label>
          <label>{T("Giữ lại số bản gần nhất", "Backups to keep")}<input type="number" min={1} max={60} value={cfg.keep} onChange={(e) => setCfg({ ...cfg, keep: Math.min(60, Math.max(1, Math.floor(+e.target.value || 1))) })} /></label>
        </div>
        <div className="rolebar">
          <button disabled={JSON.stringify(cfg) === JSON.stringify(saved) || !!busy} onClick={() => run("cfg", async () => { await setDoc(doc(db, "settings", "backup"), cfg); setMsg(T("Đã lưu cài đặt sao lưu.", "Backup settings saved.")); })}>{T("Lưu lại", "Save")}</button>
          <button className="ghost" disabled={JSON.stringify(cfg) === JSON.stringify(saved)} onClick={() => setCfg(saved)}>{T("Hủy bỏ", "Discard")}</button>
        </div>
        {status && <p className={status.ok ? "" : "error"}>{T("Lần sao lưu gần nhất", "Last backup")}: {new Date(status.at).toLocaleString(lang === "vi" ? "vi-VN" : "en-GB")} · {status.ok ? `✔ ${status.file} (${mb(status.bytes)})` : `✖ ${status.error ?? ""}`}</p>}
        {!status && <small>{T("Chưa có bản sao lưu nào chạy trên Cloud Storage.", "No Cloud Storage backup has run yet.")}</small>}
      </div>

      <div className="card" id="backup-files">
        <div className="row between"><h3>{T("Các bản đã lưu trên Cloud Storage", "Backups on Cloud Storage")}</h3><button className="ghost" disabled={!!busy} onClick={() => run("list", refresh)}>{T("Làm mới danh sách", "Refresh")}</button></div>
        {files === null && <small>{T("Bấm “Làm mới danh sách” để xem.", "Press “Refresh” to list them.")}</small>}
        {files?.length === 0 && <small>{T("Chưa có bản nào.", "None yet.")}</small>}
        {files?.map((f) => (
          <div className="row between" key={f.name}>
            <span>{f.name} · {mb(f.bytes)}</span>
            <button className="ghost" disabled={!!busy} onClick={() => run("get", async () => { save(f.name, await backupGet(f.name)); })}>⬇ {T("Tải về", "Download")}</button>
          </div>
        ))}
        <small>{T("Khôi phục: liên hệ người quản trị kỹ thuật (file JSON có đủ dữ liệu để nhập lại).", "Restore: ask your technical admin (the JSON has everything needed to re-import).")}</small>
      </div>
    </section>
  );
}
