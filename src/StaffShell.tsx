import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { useI18n } from "./i18n";
import { useBusySync, useLegacyRoomNames } from "./lib/useBusySync";
import { isFrontRole, isStaffRole } from "./lib/types";
import Dropdown, { type DdItem } from "./components/Dropdown";
import Dashboard from "./pages/Dashboard";
import Bookings from "./pages/Bookings";
import Guests from "./pages/Guests";
import Rooms from "./pages/Rooms";
import Coupons from "./pages/Coupons";
import History from "./pages/History";
import ReviewsAdmin from "./pages/ReviewsAdmin";
import Attendance from "./pages/Attendance";
import Accounts from "./pages/Accounts";
import Roster from "./pages/Roster";
import Timesheet from "./pages/Timesheet";
import PricingPage from "./pages/PricingPage";
import { useHr } from "./i18n/hr";

export default function StaffShell() {
  const { user, profile, loading, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const loc = useLocation();
  const H = useHr();
  const front = isFrontRole(profile?.role);
  useBusySync(front);
  useLegacyRoomNames(profile?.role === "owner" || profile?.role === "manager");

  if (loading) return <div className="center">{t("loading")}</div>;
  if (!user) return <Navigate to="/?login=1&next=app" replace />;
  if (!isStaffRole(profile?.role)) return <Navigate to="/account" replace />;

  const admin = profile?.role === "owner" || profile?.role === "manager";
  const isIn = (...paths: string[]) => paths.some((p) => loc.pathname === p || loc.pathname.startsWith(p + "/"));

  // Menu gọn: các mục liên quan gom vào nhóm thả xuống.
  const bookingItems: DdItem[] = [
    { label: t("bookings"), to: "/app/bookings" },
    ...(admin ? [{ label: t("menuRooms"), to: "/app/rooms" }, { label: lang === "vi" ? "Giá & chính sách" : "Prices & policies", to: "/app/pricing" }] : []),
    { label: t("history"), to: "/app/history" },
    ...(admin ? [{ label: t("coupons"), to: "/app/coupons" }] : []),
  ];
  const contentItems: DdItem[] = [
    { label: t("reviewsAdmin"), to: "/app/reviews" },
    { label: t("faqPage"), to: "/faq" },
    { label: t("privacyPage"), to: "/privacy" },
  ];
  const hrItems: DdItem[] = [
    ...(admin ? [{ label: t("staffAccounts"), to: "/app/accounts" }] : []),
    { label: H.attendance, to: "/app/attendance" },
    ...(admin ? [{ label: H.roster, to: "/app/roster" }, { label: H.timesheet, to: "/app/timesheet" }] : []),
  ];

  return (
    <div className="shell">
      <header>
        <Link to="/" className="brand"><img className="brandicon" src="/favicon.svg" alt="" width="24" height="24" /> {t("appName")}</Link>
        <span className="spacer" />
        <span className="who" title={user.email ?? ""}>{profile?.name || user.displayName || user.email} <span className="dd-role">({t(profile?.role ?? "customer")})</span></span>
        <button className="ghost" onClick={() => setLang(lang === "vi" ? "en" : "vi")}>{lang === "vi" ? "EN" : "VI"}</button>
        <button className="ghost" onClick={logout}>{t("logout")}</button>
      </header>
      <nav>
        <NavLink to="/app" end>{t("dashboard")}</NavLink>
        {front && <Dropdown className="st-dd" label={t("menuBooking")} items={bookingItems} active={isIn("/app/bookings", "/app/rooms", "/app/pricing", "/app/history", "/app/coupons")} />}
        {front && <NavLink to="/app/guests">{t("guests")}</NavLink>}
        {admin
          ? <Dropdown className="st-dd" label={H.menu} items={hrItems} active={isIn("/app/accounts", "/app/attendance", "/app/roster", "/app/timesheet")} />
          : <NavLink to="/app/attendance">{H.attendance}</NavLink>}
        {admin && <Dropdown className="st-dd" label={t("menuContent")} items={contentItems} active={isIn("/app/reviews")} />}
      </nav>
      <main>
        <Routes>
          <Route index element={<Dashboard />} />
          {front && <Route path="bookings" element={<Bookings />} />}
          {front && <Route path="history" element={<History />} />}
          {front && <Route path="guests" element={<Guests />} />}
          {admin && <Route path="accounts" element={<Accounts />} />}
          <Route path="attendance" element={<Attendance />} />
          {admin && <Route path="roster" element={<Roster />} />}
          {admin && <Route path="timesheet" element={<Timesheet />} />}
          {admin && <Route path="coupons" element={<Coupons />} />}
          {admin && <Route path="reviews" element={<ReviewsAdmin />} />}
          {admin && <Route path="rooms" element={<Rooms />} />}
          {admin && <Route path="pricing" element={<PricingPage />} />}
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </main>
    </div>
  );
}
