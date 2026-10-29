import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { landing, type Landing } from "./landing";

export type Lang = "vi" | "en";

const dict = {
  vi: {
    appName: "Nhà Gỗ Homestay",
    login: "Đăng nhập", register: "Đăng ký", logout: "Đăng xuất", email: "Email", password: "Mật khẩu",
    noAccount: "Chưa có tài khoản? Đăng ký", haveAccount: "Đã có tài khoản? Đăng nhập",
    firstUserHint: "Người đầu tiên đăng ký sẽ là Chủ homestay.",
    pendingTitle: "Đang chờ duyệt", pendingMsg: "Tài khoản của bạn đang chờ chủ homestay phân quyền.",
    dashboard: "Tổng quan", calendar: "Lịch phòng", bookings: "Đặt phòng", guests: "Khách hàng", rooms: "Phòng", settings: "Cài đặt",
    arrivalsToday: "Khách đến hôm nay", departuresToday: "Khách đi hôm nay", occupiedNow: "Phòng đang có khách", totalRooms: "Tổng số phòng",
    none: "Không có",
    roomName: "Tên phòng", roomType: "Loại phòng", capacity: "Sức chứa", pricePerNight: "Giá / đêm", status: "Trạng thái",
    active: "Hoạt động", maintenance: "Bảo trì", add: "Thêm", save: "Lưu", cancel: "Hủy", edit: "Sửa", delete: "Xóa", close: "Đóng",
    wood: "Nhà gỗ (lầu)", concrete: "Nhà xây dựng",
    room: "Phòng", guestName: "Tên khách", phone: "Điện thoại", checkIn: "Nhận phòng", checkOut: "Trả phòng", numGuests: "Số khách", total: "Tổng tiền", note: "Ghi chú",
    nights: "đêm", newBooking: "Đặt phòng mới", pending: "Chờ xác nhận", confirmed: "Đã xác nhận", checked_in: "Đang ở", checked_out: "Đã trả phòng", cancelled: "Đã hủy",
    doCheckIn: "Nhận phòng", doCheckOut: "Trả phòng", doCancel: "Hủy đặt phòng",
    overlap: "Phòng này đã có người đặt trong khoảng thời gian đó.", badDates: "Ngày trả phải sau ngày nhận.",
    fullName: "Họ và tên", docType: "Loại giấy tờ", docNumber: "Số giấy tờ", nationality: "Quốc tịch", dob: "Ngày sinh", docImage: "Ảnh giấy tờ",
    cccd: "Căn cước công dân", passport: "Hộ chiếu", license: "Bằng lái xe", other: "Khác", viewImage: "Xem ảnh", booking: "Đặt phòng", none2: "— Không —",
    uploading: "Đang tải lên...", privacyNote: "Ảnh giấy tờ là dữ liệu nhạy cảm, chỉ chủ/quản lý/lễ tân xem được.",
    defaultLang: "Ngôn ngữ mặc định của website", defaultLangHint: "Áp dụng cho khách vào lần đầu. Ai đã tự bấm nút VI/EN trên trình duyệt của họ thì giữ lựa chọn của họ. Email và bot Telegram vẫn gửi bằng tiếng Việt.", langVi: "Tiếng Việt", langEn: "English (Tiếng Anh)", langSaved: "Đã lưu ngôn ngữ mặc định.",
    usdRate: "Tỷ giá (VNĐ cho 1 USD)", usdRateHint: "Dùng để hiển thị giá quy đổi USD cho khách nước ngoài.",
    staffAccounts: "Tài khoản nhân viên", role: "Vai trò",
    owner: "Chủ", manager: "Quản lý", reception: "Lễ tân", housekeeping: "Buồng phòng", security: "Bảo vệ", customer: "Khách hàng",
    loading: "Đang tải...", error: "Có lỗi xảy ra", noData: "Chưa có dữ liệu", addDefaultRooms: "Tạo sẵn 5 phòng mẫu",
    from: "Từ", days: "ngày", sure: "Bạn chắc chắn chứ?",
    uploadFailed: "Đã lưu khách nhưng TẢI ẢNH THẤT BẠI",
    keepPhotoHint: "(để trống = giữ ảnh cũ)",
    approve: "Xác nhận", reject: "Từ chối", pendingRequests: "Yêu cầu chờ xác nhận", confirmClash: "Không thể xác nhận: trùng lịch với đặt phòng khác.", online: "Đặt online",
    coupons: "Mã giảm giá", couponPercent: "Giảm (%)", couponQty: "Số lượng mã", couponNote: "Ghi chú (ví dụ: khách VIP)", couponExpiry: "Hạn dùng (tùy chọn)",
    couponCreate: "Tạo mã", couponUnused: "Chưa dùng", couponUsed: "Đã dùng", couponExpired: "Hết hạn", copy: "Sao chép", copied: "Đã chép!", usedBy: "Dùng bởi",
    couponHint: "Mỗi mã chỉ dùng được 1 lần. Gửi mã cho khách; khách nhập ở bước Đặt phòng để được giảm giá.", couponDeleteSure: "Xóa mã này?",
    autoReject: "Tự động từ chối yêu cầu chưa xác nhận khi đã qua ngày nhận phòng",
    autoRejectHint: "Chỉ áp dụng cho yêu cầu đặt online còn “Chờ xác nhận”. Hệ thống xử lý khi có nhân viên lễ tân trở lên đang mở trang quản lý.",
    expiredLabel: "Hết hạn", noShowLabel: "Khách không đến", doNoShow: "Khách không đến", sureNoShow: "Đánh dấu khách không đến? Đặt phòng sẽ chuyển sang Đã hủy (lý do: khách không đến), phòng được nhả; tiền cọc đã nhận vẫn được giữ trong sổ để bạn xử lý theo chính sách.", autoNoShow: "Tự động đánh dấu “Khách không đến” khi đã qua ngày trả phòng mà đặt phòng đã xác nhận vẫn chưa nhận phòng", autoNoShowHint: "Áp dụng cho đặt phòng “Đã xác nhận” chưa nhận phòng. Đặt phòng chuyển sang Đã hủy (lý do: khách không đến), phòng được nhả; tiền cọc đã nhận giữ nguyên trong sổ. Hệ thống xử lý định kỳ (mỗi 3 giờ, từ 06:00 đến 22:00) và khi có nhân viên mở trang quản lý.", overdueIn: "⏰ Đã quá ngày nhận phòng", overdueOut: "⏰ Đã quá ngày trả phòng, chưa trả phòng", couponApplied: "Mã giảm giá",
    addGuestProfile: "Hồ sơ khách", hasGuestProfile: "✓ Đã có hồ sơ khách", askGuestProfile: "Đặt phòng này chưa có hồ sơ khách (CCCD/hộ chiếu). Nhập hồ sơ khách ngay bây giờ?",
    suggestGuests: "Khách đã có trong dữ liệu (chọn để điền sẵn)", dupOther: "⚠ Số giấy tờ này đã thuộc về khách khác", dupSame: "ℹ Khách cũ: số giấy tờ này đã từng được lưu cho cùng tên.",
    dupSaved: "Đã lưu, nhưng lưu ý: số giấy tờ trùng với khách khác", prefillFromBooking: "Đã điền sẵn từ đặt phòng của", imageNotCopied: "Ảnh giấy tờ của lần trước không được dùng lại; hãy tải ảnh mới nếu cần.",
    needGuestProfile: "Cần tạo hồ sơ khách (CCCD/hộ chiếu…) trước khi nhận phòng. Chuyển sang form hồ sơ khách.", saveAndCheckIn: "Lưu & Nhận phòng",
    editPrice: "Sửa giá", rentPrice: "Giá thuê", applyCode: "Áp dụng", removeCode: "Bỏ mã", applyCodeToBooking: "Áp mã cho khách này", couponNotFound: "Mã không tồn tại.",
    guestSection: "Thông tin khách", guestSectionHint: "Nhập số giấy tờ để tạo luôn hồ sơ khách lưu trú; có thể bổ sung sau khi khách đến.", photoNeedsNumber: "Muốn tải ảnh giấy tờ thì cần nhập số giấy tờ.",
    reviewsAdmin: "Cảm nhận khách", reviewsHint: "Chỉ cảm nhận đã duyệt mới hiện công khai trên website. Khách sửa cảm nhận thì quay lại “Chờ duyệt”.",
    reviewPending: "Chờ duyệt", reviewApproved: "Đã duyệt", reviewRejected: "Đã từ chối", reviewApprove: "Duyệt & hiển thị", reviewReject: "Từ chối", reviewBackToPending: "Đưa về chờ duyệt",
    reviewsPendingTile: "Cảm nhận chờ duyệt", menuBooking: "Đặt phòng", menuContent: "Nội dung", menuSetup: "Thiết lập", faqPage: "Hỏi & Đáp", privacyPage: "Chính sách quyền riêng tư",
    editOnSite: "Sửa trực tiếp trên trang (bấm “Chỉnh sửa nội dung”).",
    customerCancelled: "Khách tự hủy", history: "Lịch sử", statCheckedOut: "Lượt đã trả phòng", statRevenue: "Doanh thu (đã trả phòng)", statCancelled: "Đã hủy", all: "Tất cả", month: "Tháng",
    guestNote: "Ghi chú về khách", guestNoteHint: "Ví dụ: khách dễ tính, vui vẻ / khách khó tính, cần lưu ý…",
    rolesSave: "Lưu lại", rolesCancel: "Hủy bỏ", rolesSaved: "Phân quyền thành công", rolesFailed: "Không lưu được phân quyền. Vui lòng thử lại.",
    reviewEdit: "Sửa nội dung", reviewEditNote: "Chỉ chủ mới sửa được nội dung cảm nhận.", reviewSaved: "Đã lưu cảm nhận.", displayName: "Tên hiển thị",
    currentBookings: "Đang đặt phòng", menuRooms: "Thiết lập phòng",
    search: "Tìm kiếm", searchHint: "Tên, điện thoại, email, mã giảm giá…", undoCheckOut: "Hoàn tác trả phòng", restore: "Khôi phục",
    bookingDetails: "Chi tiết đặt phòng", roomInfo: "Thông tin phòng", linkedGuests: "Khách lưu trú", noLinkedGuests: "Chưa có khách nào được liên kết với đặt phòng này.",
    linkGuest: "Liên kết khách đã nhập", noImage: "Chưa có ảnh giấy tờ", imageError: "Không tải được ảnh", openFull: "Bấm để xem ảnh lớn", bookedRoom: "Phòng đặt",
  },
  en: {
    appName: "Wooden House Homestay",
    login: "Sign in", register: "Sign up", logout: "Sign out", email: "Email", password: "Password",
    noAccount: "No account? Sign up", haveAccount: "Have an account? Sign in",
    firstUserHint: "The first person to sign up becomes the Owner.",
    pendingTitle: "Pending approval", pendingMsg: "Your account is waiting for the owner to assign a role.",
    dashboard: "Dashboard", calendar: "Calendar", bookings: "Bookings", guests: "Customers", rooms: "Rooms", settings: "Settings",
    arrivalsToday: "Arrivals today", departuresToday: "Departures today", occupiedNow: "Rooms occupied", totalRooms: "Total rooms",
    none: "None",
    roomName: "Room name", roomType: "Room type", capacity: "Capacity", pricePerNight: "Price / night", status: "Status",
    active: "Active", maintenance: "Maintenance", add: "Add", save: "Save", cancel: "Cancel", edit: "Edit", delete: "Delete", close: "Close",
    wood: "Wooden house (upstairs)", concrete: "Built house",
    room: "Room", guestName: "Guest name", phone: "Phone", checkIn: "Check-in", checkOut: "Check-out", numGuests: "Guests", total: "Total", note: "Note",
    nights: "nights", newBooking: "New booking", pending: "Pending", confirmed: "Confirmed", checked_in: "Checked in", checked_out: "Checked out", cancelled: "Cancelled",
    doCheckIn: "Check in", doCheckOut: "Check out", doCancel: "Cancel booking",
    overlap: "This room is already booked for those dates.", badDates: "Check-out must be after check-in.",
    fullName: "Full name", docType: "Document type", docNumber: "Document number", nationality: "Nationality", dob: "Date of birth", docImage: "Document photo",
    cccd: "National ID card", passport: "Passport", license: "Driver's license", other: "Other", viewImage: "View photo", booking: "Booking", none2: "— None —",
    uploading: "Uploading...", privacyNote: "ID photos are sensitive: only owner/manager/reception can view them.",
    defaultLang: "Website default language", defaultLangHint: "Applies to first-time visitors. Anyone who has used the VI/EN button in their browser keeps their own choice. Emails and the Telegram bot are still sent in Vietnamese.", langVi: "Tiếng Việt (Vietnamese)", langEn: "English", langSaved: "Default language saved.",
    usdRate: "Exchange rate (VND per 1 USD)", usdRateHint: "Used to show USD equivalents for foreign guests.",
    staffAccounts: "Staff accounts", role: "Role",
    owner: "Owner", manager: "Manager", reception: "Reception", housekeeping: "Housekeeping", security: "Security", customer: "Customer",
    loading: "Loading...", error: "Something went wrong", noData: "No data yet", addDefaultRooms: "Create 5 sample rooms",
    from: "From", days: "days", sure: "Are you sure?",
    uploadFailed: "Guest saved but PHOTO UPLOAD FAILED",
    keepPhotoHint: "(leave empty to keep current photo)",
    approve: "Approve", reject: "Reject", pendingRequests: "Requests awaiting confirmation", confirmClash: "Cannot confirm: dates clash with another booking.", online: "Online",
    coupons: "Discount codes", couponPercent: "Discount (%)", couponQty: "Number of codes", couponNote: "Note (e.g. VIP guest)", couponExpiry: "Expiry (optional)",
    couponCreate: "Create codes", couponUnused: "Unused", couponUsed: "Used", couponExpired: "Expired", copy: "Copy", copied: "Copied!", usedBy: "Used by",
    couponHint: "Each code can be used once. Send it to the guest; they enter it when booking to get the discount.", couponDeleteSure: "Delete this code?",
    autoReject: "Auto-reject unconfirmed requests once the check-in date has passed",
    autoRejectHint: "Only affects online requests still “Pending”. It runs while a front-desk staff member (or above) has the management page open.",
    expiredLabel: "Expired", noShowLabel: "No-show", doNoShow: "Guest did not arrive", sureNoShow: "Mark as no-show? The booking becomes Cancelled (reason: no-show) and the room is released; any deposit received stays on the booking for you to handle per your policy.", autoNoShow: "Automatically mark confirmed bookings as “No-show” once the check-out date has passed without check-in", autoNoShowHint: "Applies to Confirmed bookings that never checked in. The booking becomes Cancelled (reason: no-show) and the room is released; deposits received stay recorded. Runs every 3 hours (06:00–22:00) and while staff have the management page open.", overdueIn: "⏰ Check-in date has passed", overdueOut: "⏰ Check-out date has passed, not checked out", couponApplied: "Discount code",
    addGuestProfile: "Guest profile", hasGuestProfile: "✓ Guest profile saved", askGuestProfile: "This booking has no guest profile (ID/passport) yet. Enter it now?",
    suggestGuests: "Guests already on file (pick to pre-fill)", dupOther: "⚠ This document number already belongs to another guest", dupSame: "ℹ Returning guest: this document number was saved before for the same name.",
    dupSaved: "Saved, but note: document number duplicates another guest", prefillFromBooking: "Pre-filled from the booking of", imageNotCopied: "The ID photo from a previous stay is not reused; upload a new one if needed.",
    needGuestProfile: "A guest profile (ID/passport…) is required before check-in. Opening the guest profile form.", saveAndCheckIn: "Save & check in",
    editPrice: "Edit price", rentPrice: "Rental price", applyCode: "Apply", removeCode: "Remove", applyCodeToBooking: "Apply code to this guest", couponNotFound: "Code not found.",
    guestSection: "Guest details", guestSectionHint: "Enter a document number to create the guest profile now; it can also be added when the guest arrives.", photoNeedsNumber: "Enter the document number to upload a document photo.",
    reviewsAdmin: "Guest reviews", reviewsHint: "Only approved reviews appear publicly on the website. If a guest edits a review it goes back to “Pending”.",
    reviewPending: "Pending", reviewApproved: "Approved", reviewRejected: "Rejected", reviewApprove: "Approve & show", reviewReject: "Reject", reviewBackToPending: "Move back to pending",
    reviewsPendingTile: "Reviews awaiting approval", menuBooking: "Bookings", menuContent: "Content", menuSetup: "Setup", faqPage: "FAQ", privacyPage: "Privacy policy",
    editOnSite: "Edit directly on the page (press “Edit content”).",
    customerCancelled: "Cancelled by guest", history: "History", statCheckedOut: "Completed stays", statRevenue: "Revenue (checked out)", statCancelled: "Cancelled", all: "All", month: "Month",
    guestNote: "Guest note", guestNoteHint: "E.g. easygoing and cheerful / demanding, take care…",
    rolesSave: "Save", rolesCancel: "Discard", rolesSaved: "Roles updated", rolesFailed: "Could not save the roles. Please try again.",
    reviewEdit: "Edit content", reviewEditNote: "Only the owner can edit review content.", reviewSaved: "Review saved.", displayName: "Display name",
    currentBookings: "Current bookings", menuRooms: "Room setup",
    search: "Search", searchHint: "Name, phone, email, discount code…", undoCheckOut: "Undo check-out", restore: "Restore",
    bookingDetails: "Booking details", roomInfo: "Room info", linkedGuests: "Guests", noLinkedGuests: "No guest is linked to this booking yet.",
    linkGuest: "Link an entered guest", noImage: "No document photo", imageError: "Could not load photo", openFull: "Click to view full size", bookedRoom: "Booked room",
  },
} as const;

export type Key = keyof typeof dict.vi;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>(null!);

export function I18nProvider({ children }: { children: ReactNode }) {
  // Ưu tiên: lựa chọn của chính người xem (nút VI/EN) → ngôn ngữ mặc định do chủ/quản lý đặt (settings/app.defaultLang, nhớ lại để khỏi nháy) → tiếng Việt.
  const [lang, setLangState] = useState<Lang>(() => {
    try { const c = localStorage.getItem("lang") ?? localStorage.getItem("siteDefaultLang"); return c === "en" ? "en" : "vi"; } catch { return "vi"; }
  });
  useEffect(() => onSnapshot(doc(db, "settings", "app"), (s) => {
    const d = s.data()?.defaultLang;
    if (d !== "vi" && d !== "en") return;
    try {
      localStorage.setItem("siteDefaultLang", d);
      if (!localStorage.getItem("lang")) setLangState(d); // người xem chưa tự chọn thì theo mặc định của website
    } catch { /* bỏ qua */ }
  }, () => {}), []);
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
