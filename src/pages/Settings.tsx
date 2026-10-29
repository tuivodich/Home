import { useEffect, useState } from "react";
import { deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { DEFAULT_USD_RATE } from "../lib/format";
import { CONTACT_FIELDS, EMPTY_CONTACT, isUrlOk, parseCoords, useContact, type Contact } from "../lib/contact";
import { tgLinkCode, tgSetup } from "../lib/telegram";
import { PALETTES, sceneSvg } from "../landing/forest";
import { READY_THEMES, THEME_IDS, THEME_INFO, parseSettings, DEFAULT_MAX_PENDING, DEFAULT_SETTINGS, type SiteSettings, type ThemeId } from "../lib/theme";
import NumInput from "../components/NumInput";
import PushSettings from "../components/PushSettings";

export default function Settings() {
  const { t, lang } = useI18n();
  const vi = lang === "vi";
  const [site, setSite] = useState<SiteSettings>(DEFAULT_SETTINGS);
  // Giao diện đã chọn nhưng chưa lưu: chỉ áp dụng khi bấm "Lưu lại"; "Hủy bỏ" trả về giá trị đã lưu.
  const [siteDraft, setSiteDraft] = useState<Partial<SiteSettings>>({});
  const [themeMsg, setThemeMsg] = useState("");
  const [themeErr, setThemeErr] = useState("");
  const [themeSaving, setThemeSaving] = useState(false);
  const shown: SiteSettings = { ...site, ...siteDraft };
  const themeDirty = (Object.keys(siteDraft) as (keyof SiteSettings)[]).length;
  const pickSite = <K extends keyof SiteSettings>(k: K, v: SiteSettings[K]) => {
    setThemeMsg(""); setThemeErr("");
    setSiteDraft((d) => { const n = { ...d }; if (site[k] === v) delete n[k]; else n[k] = v; return n; });
  };
  const saveTheme = async () => {
    setThemeSaving(true); setThemeMsg(""); setThemeErr("");
    try { await setDoc(doc(db, "settings", "app"), siteDraft, { merge: true }); setSiteDraft({}); setThemeMsg(vi ? "Đã đổi giao diện thành công" : "Theme updated successfully"); }
    catch (ex) { console.error("save theme", ex); setThemeErr(t("error")); } finally { setThemeSaving(false); }
  };
  const { user, profile } = useAuth();
  const [rate, setRate] = useState(DEFAULT_USD_RATE);
  const [autoReject, setAutoReject] = useState(true);
  const [autoNoShow, setAutoNoShow] = useState(true);
  const [defLang, setDefLang] = useState<"vi" | "en">("vi");
  const [langMsg, setLangMsg] = useState("");
  const [maxPending, setMaxPending] = useState(DEFAULT_MAX_PENDING);

  const isOwner = profile?.role === "owner";
  // Thông tin liên hệ công khai (website + bot Telegram cùng đọc từ settings/contact).
  const savedContact = useContact();
  const [ct, setCt] = useState<Contact>(EMPTY_CONTACT);
  const [ctMsg, setCtMsg] = useState("");
  const [ctErr, setCtErr] = useState("");
  useEffect(() => { setCt(savedContact); }, [savedContact]);
  const ctDirty = CONTACT_FIELDS.some((k) => ct[k].trim() !== savedContact[k]);
  const ctBadUrl = !isUrlOk(ct.facebook) || !isUrlOk(ct.mapUrl) || (!!ct.coords.trim() && !parseCoords(ct.coords));
  const saveContact = async () => {
    setCtMsg(""); setCtErr("");
    try {
      const data = Object.fromEntries(CONTACT_FIELDS.map((k) => [k, ct[k].trim()]));
      await setDoc(doc(db, "settings", "contact"), data);
      setCtMsg(vi ? "Đã lưu thông tin liên hệ." : "Contact details saved.");
    } catch (ex) { console.error("save contact", ex); setCtErr(vi ? "Không lưu được. Vui lòng thử lại." : "Could not save. Please try again."); }
  };
  const ctLabels: Record<keyof Contact, [string, string]> = {
    phone: ["Số điện thoại", "Phone"], zalo: ["Zalo (số điện thoại hoặc đường dẫn)", "Zalo (number or link)"], email: ["Email", "Email"],
    address: ["Địa chỉ", "Address"], facebook: ["Facebook (đường dẫn https://…)", "Facebook (https:// link)"], mapUrl: ["Đường dẫn bản đồ (Google Maps https://…)", "Map link (Google Maps https://…)"],
    coords: ["Tọa độ bản đồ nhúng (vĩ độ, kinh độ — vd 11.9404, 108.4583)", "Embedded map coordinates (lat, lng — e.g. 11.9404, 108.4583)"],
  };
  // Bot Telegram: kết nối bot (chủ), liên kết chat của tôi, danh sách chat đang nhận thông báo.
  const { data: tgChats } = useCollection<{ id: string; email?: string; name?: string; type?: string; role?: string }>("tgChats", profile?.role === "owner" || profile?.role === "manager");
  const [tgMsg, setTgMsg] = useState("");
  const [tgErr, setTgErr] = useState("");
  const [tgLink, setTgLink] = useState<{ link: string; code: string } | null>(null);
  const [tgBusy, setTgBusy] = useState(false);
  const tgRun = async (f: () => Promise<void>) => {
    setTgBusy(true); setTgMsg(""); setTgErr("");
    try { await f(); } catch (ex) {
      console.error("telegram", ex);
      setTgErr((ex as { message?: string }).message?.replace(/^.*?: /, "") || (vi ? "Có lỗi, vui lòng thử lại." : "Something went wrong, please try again."));
    } finally { setTgBusy(false); }
  };
  useEffect(() => onSnapshot(doc(db, "settings", "app"), (s) => {
    if (typeof s.data()?.usdRate === "number") setRate(s.data()!.usdRate);
    setAutoReject(s.data()?.autoRejectPending !== false);
    setAutoNoShow(s.data()?.autoNoShow !== false);
    setDefLang(s.data()?.defaultLang === "en" ? "en" : "vi");
    if (typeof s.data()?.maxPending === "number") setMaxPending(s.data()!.maxPending);
    setSite(parseSettings(s.data()));
  }, () => {}), []);

  return (
    <section>
      <h2 id="settings">{t("settings")}</h2>
      <div className="card" id="default-lang">
        <label>{t("defaultLang")}
          <select value={defLang} onChange={(e) => {
            const v = e.target.value === "en" ? "en" : "vi";
            setLangMsg(""); setDefLang(v);
            setDoc(doc(db, "settings", "app"), { defaultLang: v }, { merge: true }).then(() => setLangMsg(t("langSaved"))).catch((ex) => console.error("default lang", ex));
          }}>
            <option value="vi">{t("langVi")}</option>
            <option value="en">{t("langEn")}</option>
          </select>
        </label>
        <small>{t("defaultLangHint")}</small>
        {langMsg && <p className="ok-msg" role="status">{langMsg}</p>}
      </div>
      <div className="card">
        <label>{t("usdRate")}
          <NumInput min={1} value={rate} onChange={(e) => setRate(+e.target.value)} />
        </label>
        <small>{t("usdRateHint")}</small>
        <button onClick={() => setDoc(doc(db, "settings", "app"), { usdRate: rate }, { merge: true })}>{t("save")}</button>
      </div>
      <div className="card">
        <label className="check">
          <input type="checkbox" checked={autoReject} onChange={(e) => setDoc(doc(db, "settings", "app"), { autoRejectPending: e.target.checked }, { merge: true })} />
          <span>{t("autoReject")}</span>
        </label>
        <small>{t("autoRejectHint")}</small>
        <label className="check">
          <input type="checkbox" checked={autoNoShow} onChange={(e) => setDoc(doc(db, "settings", "app"), { autoNoShow: e.target.checked }, { merge: true })} />
          <span>{t("autoNoShow")}</span>
        </label>
        <small>{t("autoNoShowHint")}</small>
      </div>
      <div className="card">
        <label>{vi ? "Số yêu cầu đặt phòng đang chờ xác nhận tối đa mỗi tài khoản" : "Max pending booking requests per account"}
          <NumInput min={1} max={20} step={1} value={maxPending} onChange={(e) => setMaxPending(+e.target.value)} />
        </label>
        <small>{vi ? "Chống đặt phòng bừa bãi: khách chưa được nhân viên xử lý hết yêu cầu thì không đặt thêm được. Yêu cầu đã xác nhận không tính." : "Stops spam bookings: a guest cannot send more until staff handle the pending ones. Confirmed bookings do not count."}</small>
        <button disabled={!Number.isInteger(maxPending) || maxPending < 1 || maxPending > 20} onClick={() => setDoc(doc(db, "settings", "app"), { maxPending }, { merge: true })}>{t("save")}</button>
      </div>
      <div className="card" id="site-theme">
        <h3>{vi ? "Giao diện website" : "Website theme"}</h3>
        <small>{vi ? "Chỉ chủ và quản lý đổi được. Áp dụng cho trang khách xem; khu quản lý giữ nguyên." : "Owner and manager only. Applies to the public site; the staff area keeps its look."}</small>
        <div className="theme-grid">
          {THEME_IDS.map((id: ThemeId) => {
            const ready = READY_THEMES.includes(id);
            return (
              <button key={id} type="button" className={`theme-card ${shown.theme === id ? "on" : ""}`} disabled={!ready || themeSaving} aria-pressed={shown.theme === id}
                onClick={() => pickSite("theme", id)}>
                <span className="theme-thumb" aria-hidden="true" dangerouslySetInnerHTML={{ __html: sceneSvg(PALETTES[id], { id: `t${id}`, cabinX: 800, cabinScale: 1.3, withTree: false, withSnowman: false }) }} />
                <strong>{vi ? THEME_INFO[id].vi : THEME_INFO[id].en}</strong>
                <small>{ready ? (vi ? THEME_INFO[id].descVi : THEME_INFO[id].descEn) : (vi ? "Sắp có" : "Coming soon")}</small>
              </button>
            );
          })}
        </div>
        <label className="check">
          <input type="checkbox" checked={shown.effects} disabled={themeSaving} onChange={(e) => pickSite("effects", e.target.checked)} />
          <span>{vi ? "Bật hiệu ứng (đom đóm, khói, ánh đèn)" : "Enable effects (fireflies, smoke, glow)"}</span>
        </label>
        <label className="check">
          <input type="checkbox" checked={shown.themeAuto} disabled={!READY_THEMES.includes("noel") || themeSaving} onChange={(e) => pickSite("themeAuto", e.target.checked)} />
          <span>{vi ? "Tự chuyển sang Noel từ 01/12 đến 05/01 (ngoài mùa dùng giao diện đã chọn)" : "Switch to Christmas automatically 1 Dec – 5 Jan (otherwise your chosen theme)"}</span>
        </label>
        <div className="rolebar">
          <button type="button" disabled={themeDirty === 0 || themeSaving} onClick={saveTheme}>{t("rolesSave")}</button>
          <button type="button" className="ghost" disabled={themeDirty === 0 || themeSaving} onClick={() => { setSiteDraft({}); setThemeMsg(""); setThemeErr(""); }}>{t("rolesCancel")}</button>
        </div>
        {themeMsg && <p className="ok-msg" role="status">{themeMsg}</p>}
        {themeErr && <p className="error">{themeErr}</p>}
      </div>
      <div className="card" id="contact-info">
        <h3>{vi ? "Thông tin liên hệ" : "Contact details"}</h3>
        <small>{vi ? "Hiển thị công khai ở chân trang website và trong lệnh /lienhe của bot Telegram. Để trống mục nào thì mục đó được ẩn." : "Shown publicly in the website footer and in the Telegram bot's /lienhe command. Leave a field empty to hide it."}</small>
        {CONTACT_FIELDS.map((k) => (
          <label key={k}>{vi ? ctLabels[k][0] : ctLabels[k][1]}
            <input value={ct[k]} maxLength={300} type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
              onChange={(e) => { setCtMsg(""); setCt({ ...ct, [k]: e.target.value }); }} />
          </label>
        ))}
        {ctBadUrl && <p className="error">{vi ? "Đường dẫn Facebook / bản đồ phải bắt đầu bằng http:// hoặc https://; tọa độ dạng 11.9404, 108.4583" : "Facebook / map links must start with http:// or https:// and coordinates look like 11.9404, 108.4583"}</p>}
        <div className="rolebar">
          <button type="button" disabled={!ctDirty || ctBadUrl} onClick={saveContact}>{t("save")}</button>
          <button type="button" className="ghost" disabled={!ctDirty} onClick={() => setCt(savedContact)}>{vi ? "Hủy bỏ" : "Discard"}</button>
        </div>
        {ctMsg && <p className="ok-msg" role="status">{ctMsg}</p>}
        {ctErr && <p className="error">{ctErr}</p>}
      </div>
      <PushSettings />
      <div className="card" id="telegram">
        <h3>{vi ? "Bot Telegram" : "Telegram bot"}</h3>
        <small>{vi
          ? "Nhận thông báo yêu cầu đặt phòng mới / khách hủy / cảm nhận mới ngay trên Telegram, bấm nút Xác nhận hoặc Từ chối ngay trong tin nhắn. Lệnh: /homnay, /cho, /doanhthu, /tra, /trong. Bot còn nhắc khi nhân viên đi muộn/quên ra ca, khách chưa cọc hoặc chưa có hồ sơ."
          : "Get new booking requests, cancellations and reviews on Telegram, and confirm or reject right from the message. Commands: /homnay, /cho, /doanhthu, /tra, /trong. It also alerts on late/forgotten clock-outs and guests without deposit or profile."}</small>
        <div className="rolebar">
          {isOwner && <button type="button" className="ghost" disabled={tgBusy} onClick={() => tgRun(async () => { const r = await tgSetup(); setTgMsg(vi ? `Đã kết nối bot @${r.username}.` : `Bot @${r.username} connected.`); })}>{vi ? "Kết nối bot" : "Connect bot"}</button>}
          <button type="button" disabled={tgBusy} onClick={() => tgRun(async () => { setTgLink(await tgLinkCode()); })}>{vi ? "Liên kết Telegram của tôi" : "Link my Telegram"}</button>
        </div>
        {tgLink && (
          <p className="info">
            <a href={tgLink.link} target="_blank" rel="noreferrer">{vi ? "Mở Telegram để liên kết" : "Open Telegram to link"}</a>
            {" · "}{vi ? "hoặc gửi cho bot" : "or send the bot"}: <code>/start {tgLink.code}</code> ({vi ? "hiệu lực 30 phút" : "valid for 30 minutes"})
          </p>
        )}
        {tgMsg && <p className="ok-msg" role="status">{tgMsg}</p>}
        {tgErr && <p className="error">{tgErr}</p>}
        {tgChats.length > 0 && <h4>{vi ? "Chat đang nhận thông báo" : "Chats receiving notifications"}</h4>}
        {tgChats.map((c) => (
          <div className="row between" key={c.id}>
            <span>{c.name || c.id}{c.email ? ` · ${c.email}` : ""}{c.type && c.type !== "private" ? ` · ${vi ? "nhóm" : "group"}` : ""}</span>
            <button type="button" className="ghost danger" onClick={() => confirm(t("sure")) && deleteDoc(doc(db, "tgChats", c.id))}>{vi ? "Gỡ" : "Remove"}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
