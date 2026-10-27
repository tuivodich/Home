import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { addDays, todayStr } from "../lib/format";
import { isStaffRole, type Busy, type Room } from "../lib/types";
import AuthModal from "../components/AuthModal";
import Header from "../landing/Header";
import Hero from "../landing/Hero";
import { About, Features, Footer, HowItWorks, RoomsShowcase, Stats } from "../landing/Sections";
import Availability from "../landing/Availability";
import BookingModal from "../landing/BookingModal";
import { useReveal } from "../landing/useReveal";
import type { Search } from "../landing/availability";
import "../landing/landing.css";

export default function Landing() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const { data: roomsRaw } = useCollection<Room>("rooms");
  const { data: busy } = useCollection<Busy>("busy");
  const rooms = useMemo(() => [...roomsRaw].sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true })), [roomsRaw]);

  const [search, setSearch] = useState<Search>({ checkIn: todayStr(), checkOut: addDays(todayStr(), 1), roomId: "", guests: 2 });
  const [authOpen, setAuthOpen] = useState(params.get("login") === "1");
  const [bookRoomId, setBookRoomId] = useState("");
  const wanted = useRef("");
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  useReveal();

  // Mở trang kèm #booking (từ trang tài khoản) thì cuộn tới đúng mục.
  useEffect(() => {
    if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 50);
  }, [hash]);

  // Đăng nhập xong (từ nút Đặt phòng) thì mở tiếp cửa sổ đặt phòng; nhân viên vào trang quản lý nếu có ?next=app.
  useEffect(() => {
    if (!user) return;
    if (wanted.current) { setBookRoomId(wanted.current); wanted.current = ""; }
    else if (params.get("next") === "app" && profile && isStaffRole(profile.role)) navigate("/app", { replace: true });
  }, [user, profile, params, navigate]);

  const onBook = (roomId: string) => {
    if (!user) { wanted.current = roomId; setAuthOpen(true); }
    else setBookRoomId(roomId);
  };

  const bookRoom = rooms.find((r) => r.id === bookRoomId);

  return (
    <div className="landing">
      <Header onSignIn={() => setAuthOpen(true)} />
      <main>
        <Hero rooms={rooms} search={search} setSearch={setSearch} />
        <Stats />
        <About />
        <RoomsShowcase rooms={rooms} search={search} setSearch={setSearch} />
        <Features />
        <HowItWorks />
        <Availability rooms={rooms} busy={busy} search={search} setSearch={setSearch} onBook={onBook} />
      </main>
      <Footer />
      {authOpen && !user && <AuthModal onClose={closeAuth} />}
      {bookRoom && user && (
        <BookingModal room={bookRoom} search={search} user={user} profile={profile} busy={busy} onClose={() => setBookRoomId("")} />
      )}
    </div>
  );
}
