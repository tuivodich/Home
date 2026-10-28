import { useI18n } from "./index";

const vi = {
  myAccount: "Tài khoản của tôi", myAccountSub: "Thông tin này được điền sẵn khi bạn đặt phòng; bạn vẫn sửa được ngay lúc đặt.",
  fullName: "Họ và tên", docType: "Loại giấy tờ", docNumber: "Số giấy tờ", nationality: "Quốc tịch", dob: "Ngày sinh", phone: "Điện thoại", email: "Email",
  cccd: "CCCD / CMND", passport: "Hộ chiếu", license: "Bằng lái xe", other: "Giấy tờ khác",
  save: "Lưu", saved: "Đã lưu thông tin.", failed: "Không lưu được. Vui lòng thử lại.", privacy: "Thông tin giấy tờ chỉ dùng để đăng ký lưu trú theo quy định; chỉ bạn, chủ homestay, quản lý và lễ tân xem được.",
  checkinTitle: "Check-in online (tùy chọn)", checkinHint: "Điền trước để nhân viên không phải nhập lại khi bạn đến.", eta: "Giờ đến dự kiến", etaPh: "VD 15:30",
  saveToAccount: "Lưu thông tin này vào Tài khoản của tôi", checkinBtn: "Check-in online", checkinEdit: "Sửa check-in online", checkinSent: "Đã gửi check-in online", checkinDone: "Đã nhận thông tin check-in. Hẹn gặp bạn!",
  checkinNote: "Ghi chú cho homestay", sending: "Đang gửi…", close: "Đóng", etaShort: "đến dự kiến",
  ownerEdit: "Hồ sơ", ownerEditTitle: "Hồ sơ của", ownerOnly: "Chỉ chủ trang web sửa được hồ sơ của người khác.", cancel: "Hủy",
  precheckins: "Check-in online chờ xử lý", precheckinsHint: "Khách đã điền trước thông tin. Bấm “Tạo hồ sơ” để điền sẵn vào biểu mẫu bên dưới, kiểm tra giấy tờ gốc rồi lưu.",
  createProfile: "Tạo hồ sơ", imported: "Đã chuyển hồ sơ", noPre: "Không có check-in online nào đang chờ.",
  checkinTag: "Check-in online", markImported: "Bỏ qua",
};
const en: typeof vi = {
  myAccount: "My account", myAccountSub: "These details are pre-filled when you book; you can still edit them at booking time.",
  fullName: "Full name", docType: "ID type", docNumber: "ID number", nationality: "Nationality", dob: "Date of birth", phone: "Phone", email: "Email",
  cccd: "National ID", passport: "Passport", license: "Driver's licence", other: "Other ID",
  save: "Save", saved: "Details saved.", failed: "Could not save. Please try again.", privacy: "ID details are only used for lodging registration as required by law; only you, the owner, managers and reception can see them.",
  checkinTitle: "Online check-in (optional)", checkinHint: "Fill in ahead so staff don't need to re-enter anything when you arrive.", eta: "Expected arrival time", etaPh: "e.g. 15:30",
  saveToAccount: "Save these details to My account", checkinBtn: "Online check-in", checkinEdit: "Edit online check-in", checkinSent: "Online check-in sent", checkinDone: "Check-in details received. See you soon!",
  checkinNote: "Note for the homestay", sending: "Sending…", close: "Close", etaShort: "ETA",
  ownerEdit: "Profile", ownerEditTitle: "Profile of", ownerOnly: "Only the site owner can edit other people's profiles.", cancel: "Cancel",
  precheckins: "Online check-ins waiting", precheckinsHint: "Guests filled these in ahead. Press “Create profile” to pre-fill the form below, check the original ID, then save.",
  createProfile: "Create profile", imported: "Profile created", noPre: "No online check-ins waiting.",
  checkinTag: "Online check-in", markImported: "Dismiss",
};
export type GuestText = typeof vi;
export function useG() { const { lang } = useI18n(); return lang === "vi" ? vi : en; }
