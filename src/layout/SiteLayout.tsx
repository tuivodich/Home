import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../lib/auth";
import AuthModal from "../components/AuthModal";
import Header from "../landing/Header";
import { Footer } from "../landing/Sections";
import { AuthUi } from "./authUi";
import { ThemeCtx, useSiteTheme } from "../lib/theme";
import "../landing/landing.css";

/** Khung chung của các trang công khai: header + menu gọn, nội dung, footer, hộp thoại đăng nhập. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { theme, effects } = useSiteTheme();
  const th = useMemo(() => ({ theme, effects }), [theme, effects]);
  const [authOpen, setAuthOpen] = useState(false);
  const close = useCallback(() => setAuthOpen(false), []);
  const ctx = useMemo(() => ({ open: () => setAuthOpen(true) }), []);
  return (
    <AuthUi.Provider value={ctx}>
      <div className="landing" data-theme={theme} data-fx={effects ? "on" : "off"}>
      <ThemeCtx.Provider value={th}>
        <Header />
        {children}
        <Footer />
        {authOpen && !user && <AuthModal onClose={close} />}
      </ThemeCtx.Provider>
      </div>
    </AuthUi.Provider>
  );
}
