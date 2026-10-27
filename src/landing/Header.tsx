import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n, useL } from "../i18n";
import { site } from "../lib/siteConfig";
import { isStaffRole } from "../lib/types";
import Dropdown, { type DdItem } from "../components/Dropdown";
import HashLink from "../components/HashLink";
import { useAuthUi } from "../layout/authUi";

/** Menu gọn: Trang chủ · Đặt phòng ▾ (giới thiệu, phòng, tiện nghi, lịch trống) · Thông tin ▾ (cảm nhận, hỏi đáp, chính sách, liên hệ) · Tài khoản. */
export default function Header() {
  const L = useL();
  const M = L.menu;
  const { lang, setLang, t } = useI18n();
  const { user, profile, logout } = useAuth();
  const { open: openAuth } = useAuthUi();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMenu(false); }, [loc.pathname, loc.hash]);

  const staff = isStaffRole(profile?.role);
  const bookItems: DdItem[] = [
    { label: M.about, to: "/#about" }, { label: M.rooms, to: "/#rooms" }, { label: M.features, to: "/#features" }, { label: M.availability, to: "/#booking" },
  ];
  const infoItems: DdItem[] = [
    { label: M.reviews, to: "/reviews" }, { label: M.faq, to: "/faq" }, { label: M.privacy, to: "/privacy" }, { label: M.contact, to: "/#contact" },
  ];
  // Dòng đầu menu Tài khoản: tên (hoặc email) và vai trò, vd. "admin@gmail.com (Chủ)".
  const who = `${profile?.name || user?.displayName || user?.email || ""} (${t(profile?.role ?? "customer")})`;
  const accountItems: DdItem[] = [
    { label: who, heading: true },
    { label: L.myBookings, to: "/account" },
    ...(staff ? [{ label: L.manage, to: "/app" }] : []),
    { label: L.reviews.write, to: "/reviews" },
    { label: L.signOut, onClick: logout },
  ];
  const onPage = (paths: string[]) => paths.includes(loc.pathname);

  return (
    <header className="lp-header">
      <div className="lp-wrap lp-header-in">
        <HashLink to="/#home" className="lp-brand"><span className="lp-logo"><img src="/favicon.svg" alt="" width="38" height="38" /></span><span>{site.name}</span></HashLink>
        <nav className={`lp-nav ${menu ? "open" : ""}`} aria-label="Menu">
          <HashLink to="/#home" className={loc.pathname === "/" ? "lp-link" : "lp-link"}>{M.home}</HashLink>
          <Dropdown className="lp-dd" label={M.book} items={bookItems} active={loc.pathname === "/"} />
          <Dropdown className="lp-dd" label={M.info} items={infoItems} active={onPage(["/reviews", "/faq", "/privacy"])} />
          <div className="lp-nav-actions">
            {user
              ? <Dropdown className="lp-dd lp-dd-account" align="right" label={M.account} items={accountItems} />
              : <button className="lp-pill solid" onClick={() => { setMenu(false); openAuth(); }}>{L.signIn}</button>}
          </div>
        </nav>
        <div className="lp-tools">
          <button className="lp-pill lp-lang" onClick={() => setLang(lang === "vi" ? "en" : "vi")} aria-label="Language">{lang === "vi" ? "EN" : "VI"}</button>
          <button className="lp-burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>
  );
}
