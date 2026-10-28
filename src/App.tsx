import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Account from "./pages/Account";
import MyProfile from "./pages/MyProfile";
import ExplorePage from "./pages/ExplorePage";
import SitemapPage from "./pages/SitemapPage";
import RoomPage from "./pages/RoomPage";
import InvoicePage from "./pages/InvoicePage";
import PrivacyPage from "./pages/PrivacyPage";
import FaqPage from "./pages/FaqPage";
import ReviewsPage from "./pages/ReviewsPage";
import StaffShell from "./StaffShell";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/reviews" element={<ReviewsPage />} />
      <Route path="/account" element={<Account />} />
      <Route path="/profile" element={<MyProfile />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/sitemap" element={<SitemapPage />} />
      <Route path="/phong/:id" element={<RoomPage />} />
      <Route path="/invoice/:id" element={<InvoicePage />} />
      <Route path="/app/*" element={<StaffShell />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
