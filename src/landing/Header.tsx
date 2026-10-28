import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n, useL } from "../i18n";
import { useG } from "../i18n/guest";
import { site } from "../lib/siteConfig";
import { isStaffRole } from "../lib/types";
import Dropdown, { type DdItem } from "../components/Dropdown";
import HashLink from "../components/HashLink";
import { useAuthUi } from "../layout/authUi";
import TierBadge from "../components/TierBadge";
import { useMyTier } from "../lib/loyalty";

/**
 * Menu chính (mỗi mục lớn có menu con, đều có trạng thái "đang xem"):
 * Trang chủ ▾ (đầu trang, giới thiệu, phòng nghỉ, tiện nghi) · Đặt phòng ▾ (kiểm tra phòng trống, hỏi & đáp)
 * · Khám phá ▾ (điểm tham quan đẹp, cảm nhận của khách) · Thông tin ▾ (liên hệ, chính sách quyền riêng tư) · Tài khoản ▾.
 * Tên + vai trò, Đăng xuất và ngôn ngữ nằm ngoài menu, bên phải.
 */
export default function Header() {
  const L = useL();
  const M = L.menu;
  const { lang, setLang, t } = useI18n();
  const G = useG();
  const { user, profile, logout } = useAuth();
  const { open: openAuth } = useAuthUi();
  const my = useMyTier(user?.uid);
  // Huy hiệu hạng: luôn hiện với khách hàng; nhân viên chỉ khi có hạng đặt tay hoặc đã ở ít nhất một lần.
  const badge = my.tier && (profile?.role === "customer" || profile?.role === "pending" || !!my.member?.tier || my.count > 0) ? my.tier : null;
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useEffect(() => { setMenu(false); }, [loc.pathname, loc.hash]);

  const staff = isStaffRole(profile?.role);
  // Mục đang xem: cùng đường dẫn và (nếu mục có mục neo) cùng mục neo; mục không có mục neo chỉ khớp khi URL cũng không có mục neo
  // (trang chủ coi "#home" như không có mục neo; "#write" của trang cảm nhận thuộc mục "Gửi cảm nhận" của Tài khoản).
  const at = (to: string) => {
    const [path, hash = ""] = to.split("#");
    if (loc.pathname !== path) return false;
    const cur = loc.hash.replace("#", "");
    if (hash) return cur === hash;
    return cur === "" || (path === "/" && cur === "home");
  };
  const it = (label: string, to: string): DdItem => ({ label, to, active: at(to) });

  const homeItems: DdItem[] = [it(M.top, "/"), it(M.about, "/#about"), it(M.rooms, "/#rooms"), it(M.features, "/#features")];
  const bookItems: DdItem[] = [it(M.availability, "/#booking"), it(M.faq, "/faq")];
  const exploreItems: DdItem[] = [it(M.explore, "/explore"), it(M.reviews, "/reviews")];
  const infoItems: DdItem[] = [it(M.contact, "/#contact"), it(M.privacy, "/privacy"), it(M.sitemap, "/sitemap")];
  const accountItems: DdItem[] = [
    it(G.myAccount, "/profile"),
    it(L.myBookings, "/account"),
    it(L.reviews.write, "/reviews#write"),
    ...(staff ? [{ label: L.manage, to: "/app" }] : []),
  ];
  const whoName = profile?.name || user?.displayName || user?.email || "";
  const whoRole = t(profile?.role ?? "customer");

  return (
    <header className="lp-header">
      <div className="lp-wrap lp-header-in">
        <HashLink to="/#home" className="lp-brand"><span className="lp-logo"><img src="/favicon.svg" alt="" width="38" height="38" /></span><span>{site.name}</span></HashLink>
        <nav className={`lp-nav ${menu ? "open" : ""}`} aria-label="Menu">
          {user && <div className="lp-who-mobile">{whoName}<TierBadge tier={badge} /> <span className="dd-role">({whoRole})</span></div>}
          <Dropdown className="lp-dd" label={M.home} items={homeItems} />
          <Dropdown className="lp-dd" label={M.book} items={bookItems} />
          <Dropdown className="lp-dd" label={M.exploreMenu} items={exploreItems} />
          <Dropdown className="lp-dd" label={M.info} items={infoItems} />
          <div className="lp-nav-actions">
            {user
              ? <Dropdown className="lp-dd lp-dd-account" align="right" label={M.account} items={accountItems} />
              : <button className="lp-pill solid" onClick={() => { setMenu(false); openAuth(); }}>{L.signIn}</button>}
            {user && <button className="lp-pill lp-logout-mobile" onClick={logout}>{L.signOut}</button>}
          </div>
        </nav>
        <div className="lp-tools">
          {user && <span className="lp-who" title={user.email ?? ""}>{whoName}<TierBadge tier={badge} /> <span className="dd-role">({whoRole})</span></span>}
          {user && <button className="lp-pill lp-logout" onClick={logout}>{L.signOut}</button>}
          <button className="lp-pill lp-lang" onClick={() => setLang(lang === "vi" ? "en" : "vi")} aria-label="Language">{lang === "vi" ? "EN" : "VI"}</button>
          <button className="lp-burger" aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>
  );
}
