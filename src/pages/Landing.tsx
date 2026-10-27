import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { addDays, todayStr } from "../lib/format";
import { isStaffRole, type Busy, type Room } from "../lib/types";
import SiteLayout from "../layout/SiteLayout";
import { useAuthUi } from "../layout/authUi";
import Hero from "../landing/Hero";
import { About, Features, HowItWorks, RoomsShowcase, Stats, Testimonials } from "../landing/Sections";
import Availability from "../landing/Availability";
import BookingModal from "../landing/BookingModal";
import { useReveal } from "../landing/useReveal";
import type { Search } from "../landing/availability";

function LandingBody() {
  const { user, profile } = useAuth();
  const { open: openAuth } = useAuthUi();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { hash } = useLocation();
  const { data: roomsRaw } = useCollection<Room>("rooms");
  const { data: busy } = useCollection<Busy>("busy");
  const rooms = useMemo(() => [...roomsRaw].sort((a, b) => a.name.localeCompare(b.name, "vi", { numeric: true })), [roomsRaw]);

  // Mở từ bot Telegram (/?checkIn=...&checkOut=...#booking): điền sẵn ngày nếu hợp lệ, ngược lại dùng đêm nay.
  const [search, setSearch] = useState<Search>(() => {
    const ok = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
    const a = params.get("checkIn"), b = params.get("checkOut");
    const valid = ok(a) && ok(b) && a! >= todayStr() && b! > a!;
    return { checkIn: valid ? a! : todayStr(), checkOut: valid ? b! : addDays(todayStr(), 1), roomId: "", guests: 2 };
  });
  const [bookRoomId, setBookRoomId] = useState("");
  const wanted = useRef("");

  useReveal();

  // Mở trang kèm mục neo (#booking…) thì cuộn tới đúng mục.
  useEffect(() => {
    if (hash) setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 50);
  }, [hash]);

  // /?login=1 (ví dụ chuyển từ khu quản lý khi chưa đăng nhập) thì mở hộp thoại đăng nhập.
  useEffect(() => {
    if (params.get("login") === "1" && !user) openAuth();
  }, [params, user, openAuth]);

  // Đăng nhập xong (từ nút Đặt phòng) thì mở tiếp cửa sổ đặt phòng; nhân viên vào trang quản lý nếu có ?next=app.
  useEffect(() => {
    if (!user) return;
    if (wanted.current) { setBookRoomId(wanted.current); wanted.current = ""; }
    else if (params.get("next") === "app" && profile && isStaffRole(profile.role)) navigate("/app", { replace: true });
  }, [user, profile, params, navigate]);

  const onBook = (roomId: string) => {
    if (!user) { wanted.current = roomId; openAuth(); }
    else setBookRoomId(roomId);
  };

  const bookRoom = rooms.find((r) => r.id === bookRoomId);

  return (
    <>
      <main>
        <Hero rooms={rooms} search={search} setSearch={setSearch} />
        <Stats />
        <About />
        <RoomsShowcase rooms={rooms} search={search} setSearch={setSearch} />
        <Features />
        <HowItWorks />
        <Testimonials />
        <Availability rooms={rooms} busy={busy} search={search} setSearch={setSearch} onBook={onBook} />
      </main>
      {bookRoom && user && (
        <BookingModal room={bookRoom} search={search} user={user} profile={profile} busy={busy} onClose={() => setBookRoomId("")} />
      )}
    </>
  );
}

export default function Landing() {
  return <SiteLayout><LandingBody /></SiteLayout>;
}
