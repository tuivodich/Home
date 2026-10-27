import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { useI18n } from "./i18n";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CalendarPage from "./pages/Calendar";
import Bookings from "./pages/Bookings";
import Guests from "./pages/Guests";
import Rooms from "./pages/Rooms";
import Settings from "./pages/Settings";

export default function App() {
  const { user, profile, loading, logout } = useAuth();
  const { t, lang, setLang } = useI18n();

  if (loading) return <div className="center">{t("loading")}</div>;
  if (!user) return <Login />;
  if (!profile || profile.role === "pending" || !profile.role) {
    return (
      <div className="center card">
        <h2>{t("pendingTitle")}</h2>
        <p>{t("pendingMsg")}</p>
        <button onClick={logout}>{t("logout")}</button>
      </div>
    );
  }

  const admin = profile.role === "owner" || profile.role === "manager";
  const front = admin || profile.role === "reception";

  return (
    <div className="shell">
      <header>
        <strong>🏡 {t("appName")}</strong>
        <span className="spacer" />
        <button className="ghost" onClick={() => setLang(lang === "vi" ? "en" : "vi")}>{lang === "vi" ? "EN" : "VI"}</button>
        <button className="ghost" onClick={logout}>{t("logout")}</button>
      </header>
      <nav>
        <NavLink to="/" end>{t("dashboard")}</NavLink>
        <NavLink to="/calendar">{t("calendar")}</NavLink>
        {front && <NavLink to="/bookings">{t("bookings")}</NavLink>}
        {front && <NavLink to="/guests">{t("guests")}</NavLink>}
        {admin && <NavLink to="/rooms">{t("rooms")}</NavLink>}
        {admin && <NavLink to="/settings">{t("settings")}</NavLink>}
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<CalendarPage />} />
          {front && <Route path="/bookings" element={<Bookings />} />}
          {front && <Route path="/guests" element={<Guests />} />}
          {admin && <Route path="/rooms" element={<Rooms />} />}
          {admin && <Route path="/settings" element={<Settings />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
