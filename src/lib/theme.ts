import { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

/** Các giao diện của website công khai. Mặc định: "night" (Đêm rừng thông). */
export type ThemeId = "night" | "mist" | "dusk" | "noel";
export const THEME_IDS: ThemeId[] = ["night", "mist", "dusk", "noel"];
export const DEFAULT_THEME: ThemeId = "night";

/** Giao diện đã hoàn thiện CSS/bố cục. Giao diện chưa có trong danh sách này sẽ tự dùng mặc định. */
export const READY_THEMES: ThemeId[] = ["night"];

export const THEME_INFO: Record<ThemeId, { vi: string; en: string; descVi: string; descEn: string }> = {
  night: { vi: "Đêm rừng thông", en: "Pine forest night", descVi: "Xanh rêu tối, vàng nhạt, trăng và đom đóm.", descEn: "Dark moss green, soft gold, moon and fireflies." },
  mist: { vi: "Sương mai", en: "Morning mist", descVi: "Sáng, thoáng, sương trắng và chút đào.", descEn: "Light and airy, white mist and a touch of peach." },
  dusk: { vi: "Hoàng hôn tím sương", en: "Misty twilight", descVi: "Trời tím hồng, đèn vàng sau cửa sổ.", descEn: "Violet-pink sky, golden light in the windows." },
  noel: { vi: "Đêm Noel tuyết trắng", en: "Snowy Christmas night", descVi: "Tuyết rơi, cây thông Noel, người tuyết.", descEn: "Falling snow, a Christmas tree, a snowman." },
};

export interface SiteSettings { theme: ThemeId; themeAuto: boolean; effects: boolean }
export const DEFAULT_SETTINGS: SiteSettings = { theme: DEFAULT_THEME, themeAuto: false, effects: true };

const isTheme = (v: unknown): v is ThemeId => typeof v === "string" && (THEME_IDS as string[]).includes(v);

/** Noel tự động từ 01/12 đến 05/01 (tháng 0-based: 11 = tháng 12). */
export function isNoelSeason(d: Date): boolean {
  const m = d.getMonth(), day = d.getDate();
  return m === 11 || (m === 0 && day <= 5);
}

/** Giao diện đang áp dụng: ưu tiên Noel mùa lễ nếu bật tự động, rồi lựa chọn của chủ; thiếu/sai/chưa sẵn sàng thì dùng mặc định. */
export function resolveTheme(s: SiteSettings, now = new Date()): ThemeId {
  const wanted: ThemeId = s.themeAuto && isNoelSeason(now) ? "noel" : s.theme;
  return READY_THEMES.includes(wanted) ? wanted : DEFAULT_THEME;
}

export function parseSettings(data: Record<string, unknown> | undefined): SiteSettings {
  return {
    theme: isTheme(data?.theme) ? data!.theme : DEFAULT_THEME,
    themeAuto: data?.themeAuto === true,
    effects: data?.effects !== false,
  };
}

const CACHE_KEY = "nhago.site";

function readCache(): SiteSettings {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) return parseSettings(JSON.parse(raw));
  } catch { /* bỏ qua: không có bộ nhớ trình duyệt */ }
  return DEFAULT_SETTINGS;
}

/**
 * Cài đặt giao diện của website. Lần đầu dùng bản đã nhớ ở trình duyệt (tránh chớp giao diện mặc định),
 * rồi cập nhật ngay khi đọc được cài đặt thật từ Firestore.
 */
export function useSiteTheme() {
  const [settings, setSettings] = useState<SiteSettings>(readCache);
  useEffect(() => onSnapshot(doc(db, "settings", "app"), (s) => {
    const next = parseSettings(s.data());
    setSettings(next);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch { /* bỏ qua */ }
  }, () => {}), []);
  return { settings, theme: resolveTheme(settings), effects: settings.effects };
}

export interface SiteTheme { theme: ThemeId; effects: boolean }
/** Giao diện đang áp dụng, cấp từ khung trang công khai để các thành phần con không phải đọc lại Firestore. */
export const ThemeCtx = createContext<SiteTheme>({ theme: DEFAULT_THEME, effects: true });
export const useTheme = () => useContext(ThemeCtx);

/** Số yêu cầu đặt phòng đang chờ xác nhận tối đa mỗi tài khoản khi chủ chưa chỉnh trong Cài đặt. */
export const DEFAULT_MAX_PENDING = 3;
