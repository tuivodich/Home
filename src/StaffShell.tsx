import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { useI18n } from "./i18n";
import { useBusySync } from "./lib/useBusySync";
import { isFrontRole, isStaffRole } from "./lib/types";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/Calendar";
import Bookings from "./pages/Bookings";
import Guests from "./pages/Guests";
import Rooms from "./pages/Rooms";
import Settings from "./pages/Settings";

export default function StaffShell() {
  const { user, profile, loading, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const front = isFrontRole(profile?.role);
  useBusySync(front);

  if (loading) return <div className="center">{t("loading")}</div>;
  if (!user) return <Navigate to="/?login=1&next=app" replace />;
  if (!isStaffRole(profile?.role)) return <Navigate to="/account" replace />;

  const admin = profile?.role === "owner" || profile?.role === "manager";

  return (
    <div className="shell">
      <header>
        <Link to="/" className="brand">🏡 {t("appName")}</Link>
        <span className="spacer" />
        <button className="ghost" onClick={() => setLang(lang === "vi" ? "en" : "vi")}>{lang === "vi" ? "EN" : "VI"}</button>
        <button className="ghost" onClick={logout}>{t("logout")}</button>
      </header>
      <nav>
        <NavLink to="/app" end>{t("dashboard")}</NavLink>
        <NavLink to="/app/calendar">{t("calendar")}</NavLink>
        {front && <NavLink to="/app/bookings">{t("bookings")}</NavLink>}
        {front && <NavLink to="/app/guests">{t("guests")}</NavLink>}
        {admin && <NavLink to="/app/rooms">{t("rooms")}</NavLink>}
        {admin && <NavLink to="/app/settings">{t("settings")}</NavLink>}
      </nav>
      <main>
        <Routes>
          <Route index element={<Dashboard />} />
          <Route path="calendar" element={<CalendarPage />} />
          {front && <Route path="bookings" element={<Bookings />} />}
          {front && <Route path="guests" element={<Guests />} />}
          {admin && <Route path="rooms" element={<Rooms />} />}
          {admin && <Route path="settings" element={<Settings />} />}
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </main>
    </div>
  );
}
