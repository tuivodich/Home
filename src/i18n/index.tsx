import { createContext, useContext, useState, type ReactNode } from "react";
import { landing, type Landing } from "./landing";

export type Lang = "vi" | "en";

const dict = {
  vi: {
    appName: "Nhà Gỗ Homestay",
    login: "Đăng nhập", register: "Đăng ký", logout: "Đăng xuất", email: "Email", password: "Mật khẩu",
    noAccount: "Chưa có tài khoản? Đăng ký", haveAccount: "Đã có tài khoản? Đăng nhập",
    firstUserHint: "Người đầu tiên đăng ký sẽ là Chủ homestay.",
    pendingTitle: "Đang chờ duyệt", pendingMsg: "Tài khoản của bạn đang chờ chủ homestay phân quyền.",
    dashboard: "Tổng quan", calendar: "Lịch phòng", bookings: "Đặt phòng", guests: "Khách lưu trú", rooms: "Phòng", settings: "Cài đặt",
    arrivalsToday: "Khách đến hôm nay", departuresToday: "Khách đi hôm nay", occupiedNow: "Phòng đang có khách", totalRooms: "Tổng số phòng",
    none: "Không có",
    roomName: "Tên phòng", roomType: "Loại phòng", capacity: "Sức chứa", pricePerNight: "Giá / đêm", status: "Trạng thái",
    active: "Hoạt động", maintenance: "Bảo trì", add: "Thêm", save: "Lưu", cancel: "Hủy", edit: "Sửa", delete: "Xóa", close: "Đóng",
    wood: "Nhà gỗ (lầu)", concrete: "Nhà bê tông",
    room: "Phòng", guestName: "Tên khách", phone: "Điện thoại", checkIn: "Nhận phòng", checkOut: "Trả phòng", numGuests: "Số khách", total: "Tổng tiền", note: "Ghi chú",
    nights: "đêm", newBooking: "Đặt phòng mới", pending: "Chờ xác nhận", confirmed: "Đã xác nhận", checked_in: "Đang ở", checked_out: "Đã trả phòng", cancelled: "Đã hủy",
    doCheckIn: "Nhận phòng", doCheckOut: "Trả phòng", doCancel: "Hủy đặt phòng",
    overlap: "Phòng này đã có người đặt trong khoảng thời gian đó.", badDates: "Ngày trả phải sau ngày nhận.",
    fullName: "Họ và tên", docType: "Loại giấy tờ", docNumber: "Số giấy tờ", nationality: "Quốc tịch", dob: "Ngày sinh", docImage: "Ảnh giấy tờ",
    cccd: "Căn cước công dân", passport: "Hộ chiếu", license: "Bằng lái xe", other: "Khác", viewImage: "Xem ảnh", booking: "Đặt phòng", none2: "— Không —",
    uploading: "Đang tải lên...", privacyNote: "Ảnh giấy tờ là dữ liệu nhạy cảm, chỉ chủ/quản lý/lễ tân xem được.",
    usdRate: "Tỷ giá (VNĐ cho 1 USD)", usdRateHint: "Dùng để hiển thị giá quy đổi USD cho khách nước ngoài.",
    staffAccounts: "Tài khoản nhân viên", role: "Vai trò",
    owner: "Chủ", manager: "Quản lý", reception: "Lễ tân", housekeeping: "Buồng phòng", security: "Bảo vệ", customer: "Khách hàng",
    loading: "Đang tải...", error: "Có lỗi xảy ra", noData: "Chưa có dữ liệu", addDefaultRooms: "Tạo sẵn 5 phòng mẫu",
    from: "Từ", days: "ngày", sure: "Bạn chắc chắn chứ?",
    uploadFailed: "Đã lưu khách nhưng TẢI ẢNH THẤT BẠI",
    keepPhotoHint: "(để trống = giữ ảnh cũ)",
    approve: "Xác nhận", reject: "Từ chối", pendingRequests: "Yêu cầu chờ xác nhận", confirmClash: "Không thể xác nhận: trùng lịch với đặt phòng khác.", online: "Đặt online",
    bookingDetails: "Chi tiết đặt phòng", roomInfo: "Thông tin phòng", linkedGuests: "Khách lưu trú", noLinkedGuests: "Chưa có khách nào được liên kết với đặt phòng này.",
    linkGuest: "Liên kết khách đã nhập", noImage: "Chưa có ảnh giấy tờ", imageError: "Không tải được ảnh", openFull: "Bấm để xem ảnh lớn", bookedRoom: "Phòng đặt",
  },
  en: {
    appName: "Wooden House Homestay",
    login: "Sign in", register: "Sign up", logout: "Sign out", email: "Email", password: "Password",
    noAccount: "No account? Sign up", haveAccount: "Have an account? Sign in",
    firstUserHint: "The first person to sign up becomes the Owner.",
    pendingTitle: "Pending approval", pendingMsg: "Your account is waiting for the owner to assign a role.",
    dashboard: "Dashboard", calendar: "Calendar", bookings: "Bookings", guests: "Guests", rooms: "Rooms", settings: "Settings",
    arrivalsToday: "Arrivals today", departuresToday: "Departures today", occupiedNow: "Rooms occupied", totalRooms: "Total rooms",
    none: "None",
    roomName: "Room name", roomType: "Room type", capacity: "Capacity", pricePerNight: "Price / night", status: "Status",
    active: "Active", maintenance: "Maintenance", add: "Add", save: "Save", cancel: "Cancel", edit: "Edit", delete: "Delete", close: "Close",
    wood: "Wooden house (upstairs)", concrete: "Concrete house",
    room: "Room", guestName: "Guest name", phone: "Phone", checkIn: "Check-in", checkOut: "Check-out", numGuests: "Guests", total: "Total", note: "Note",
    nights: "nights", newBooking: "New booking", pending: "Pending", confirmed: "Confirmed", checked_in: "Checked in", checked_out: "Checked out", cancelled: "Cancelled",
    doCheckIn: "Check in", doCheckOut: "Check out", doCancel: "Cancel booking",
    overlap: "This room is already booked for those dates.", badDates: "Check-out must be after check-in.",
    fullName: "Full name", docType: "Document type", docNumber: "Document number", nationality: "Nationality", dob: "Date of birth", docImage: "Document photo",
    cccd: "National ID card", passport: "Passport", license: "Driver's license", other: "Other", viewImage: "View photo", booking: "Booking", none2: "— None —",
    uploading: "Uploading...", privacyNote: "ID photos are sensitive: only owner/manager/reception can view them.",
    usdRate: "Exchange rate (VND per 1 USD)", usdRateHint: "Used to show USD equivalents for foreign guests.",
    staffAccounts: "Staff accounts", role: "Role",
    owner: "Owner", manager: "Manager", reception: "Reception", housekeeping: "Housekeeping", security: "Security", customer: "Customer",
    loading: "Loading...", error: "Something went wrong", noData: "No data yet", addDefaultRooms: "Create 5 sample rooms",
    from: "From", days: "days", sure: "Are you sure?",
    uploadFailed: "Guest saved but PHOTO UPLOAD FAILED",
    keepPhotoHint: "(leave empty to keep current photo)",
    approve: "Approve", reject: "Reject", pendingRequests: "Requests awaiting confirmation", confirmClash: "Cannot confirm: dates clash with another booking.", online: "Online",
    bookingDetails: "Booking details", roomInfo: "Room info", linkedGuests: "Guests", noLinkedGuests: "No guest is linked to this booking yet.",
    linkGuest: "Link an entered guest", noImage: "No document photo", imageError: "Could not load photo", openFull: "Click to view full size", bookedRoom: "Booked room",
  },
} as const;

export type Key = keyof typeof dict.vi;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>(null!);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return localStorage.getItem("lang") === "en" ? "en" : "vi"; } catch { return "vi"; }
  });
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("lang", l); } catch { /* bỏ qua */ }
  };
  const t = (k: Key) => dict[lang][k] ?? k;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);

/** Nội dung trang giới thiệu theo ngôn ngữ hiện tại. */
export const useL = (): Landing => landing[useI18n().lang];
