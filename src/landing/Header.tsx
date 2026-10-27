import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useI18n, useL } from "../i18n";
import { site } from "../lib/siteConfig";
import { isStaffRole } from "../lib/types";

export default function Header({ onSignIn }: { onSignIn: () => void }) {
  const L = useL();
  const { lang, setLang } = useI18n();
  const { user, profile, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const links: [string, string][] = [
    ["#home", L.nav.home], ["#about", L.nav.about], ["#rooms", L.nav.rooms],
    ["#features", L.nav.features], ["#booking", L.nav.booking], ["#contact", L.nav.contact],
  ];
  const staff = isStaffRole(profile?.role);

  return (
    <header className="lp-header">
      <div className="lp-wrap lp-header-in">
        <a href="#home" className="lp-brand" onClick={() => setOpen(false)}>
          <span className="lp-logo">🏡</span><span>{site.name}</span>
        </a>
        <nav className={`lp-nav ${open ? "open" : ""}`}>
          {links.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
          <div className="lp-nav-actions">
            <button className="lp-pill" onClick={() => setLang(lang === "vi" ? "en" : "vi")} aria-label="Language">{lang === "vi" ? "EN" : "VI"}</button>
            {user ? (
              <>
                {staff && <Link className="lp-pill solid" to="/app" onClick={() => setOpen(false)}>{L.manage}</Link>}
                <Link className={`lp-pill ${staff ? "" : "solid"}`} to="/account" onClick={() => setOpen(false)}>{L.myBookings}</Link>
                <button className="lp-pill" onClick={() => { setOpen(false); logout(); }}>{L.signOut}</button>
              </>
            ) : (
              <button className="lp-pill solid" onClick={() => { setOpen(false); onSignIn(); }}>{L.signIn}</button>
            )}
          </div>
        </nav>
        <button className="lp-burger" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)}>
          <span /><span /><span />
        </button>
      </div>
    </header>
  );
}
