import { useI18n } from "./index";

const vi = {
  menu: "Nhân sự", attendance: "Chấm công", roster: "Lịch ca", timesheet: "Bảng chấm công",
  clockIn: "Vào ca", clockOut: "Ra ca", working: "Đang làm việc từ", notWorking: "Bạn chưa vào ca",
  forgot: "Lượt vào ca ngày {d} chưa ra ca. Hãy báo quản lý chỉnh lại; bạn vẫn có thể vào ca mới.",
  todayShift: "Ca hôm nay", noShiftToday: "Hôm nay bạn không có ca được xếp", late: "muộn {m} phút", onTime: "đúng giờ",
  sureOut: "Xác nhận ra ca?", mySchedule: "Lịch ca 7 ngày tới", myHistory: "Chấm công gần đây", day: "Ngày", in: "Vào", out: "Ra", hours: "Giờ",
  noRecords: "Chưa có lượt chấm công.", notOut: "chưa ra ca", failed: "Không chấm công được, vui lòng thử lại.", adminEdited: "quản lý chỉnh", noSchedule: "Chưa có lịch ca.",
  shiftsTitle: "Danh mục ca", shiftName: "Tên ca", start: "Bắt đầu", end: "Kết thúc", active: "Đang dùng", addShift: "Thêm ca", seedShifts: "Tạo 3 ca mẫu",
  overnight: "qua đêm", badTime: "Giờ phải dạng HH:MM, ví dụ 06:00", sureDeleteShift: "Xóa ca này? Các ô lịch đang dùng ca này sẽ hiện dấu ?.",
  week: "Tuần", prevWeek: "← Tuần trước", nextWeek: "Tuần sau →", thisWeek: "Tuần này", copyPrev: "Sao chép từ tuần trước", copied: "Đã sao chép các ô còn trống từ tuần trước.",
  dayOff: "Nghỉ", staff: "Nhân viên", noStaff: "Chưa có tài khoản nhân viên.", rosterHint: "Chọn ca cho từng nhân viên theo ngày; lưu ngay khi chọn. Nhân viên thấy lịch này ở trang Chấm công.",
  month: "Tháng", workDays: "Ngày công", totalHours: "Tổng giờ", lates: "Đi muộn", absences: "Vắng", openShifts: "Chưa ra ca", exportCsv: "Xuất CSV",
  details: "Chi tiết", addEntry: "Thêm lượt chấm công", save: "Lưu", cancel: "Hủy", edit: "Sửa", delete: "Xóa", shift: "Ca", sureDelete: "Xóa lượt chấm công này?",
  absentOn: "Ngày vắng (có lịch ca nhưng không chấm công)", pickStaff: "Chọn nhân viên", timesheetHint: "Giờ vào/ra do nhân viên tự bấm (giờ máy chủ). Chủ/quản lý có thể sửa, thêm hoặc xóa lượt khi cần. Đi muộn: vào ca trễ hơn {g} phút so với giờ bắt đầu ca.",
  outBeforeIn: "Giờ ra phải sau giờ vào.", saved: "Đã lưu.", none: "—",
};
const en: typeof vi = {
  menu: "Staff", attendance: "Attendance", roster: "Shift roster", timesheet: "Timesheet",
  clockIn: "Clock in", clockOut: "Clock out", working: "Working since", notWorking: "You are not clocked in",
  forgot: "Your clock-in on {d} has no clock-out. Ask a manager to fix it; you can still clock in again.",
  todayShift: "Today's shift", noShiftToday: "No shift scheduled for you today", late: "{m} min late", onTime: "on time",
  sureOut: "Clock out now?", mySchedule: "Next 7 days", myHistory: "Recent attendance", day: "Date", in: "In", out: "Out", hours: "Hours",
  noRecords: "No attendance yet.", notOut: "not clocked out", failed: "Could not record attendance, please try again.", adminEdited: "edited by manager", noSchedule: "No shifts scheduled.",
  shiftsTitle: "Shift types", shiftName: "Shift name", start: "Start", end: "End", active: "In use", addShift: "Add shift", seedShifts: "Create 3 sample shifts",
  overnight: "overnight", badTime: "Time must be HH:MM, e.g. 06:00", sureDeleteShift: "Delete this shift? Roster cells using it will show ?.",
  week: "Week", prevWeek: "← Previous", nextWeek: "Next →", thisWeek: "This week", copyPrev: "Copy from last week", copied: "Copied the empty cells from last week.",
  dayOff: "Off", staff: "Staff", noStaff: "No staff accounts yet.", rosterHint: "Pick a shift per person per day; saved immediately. Staff see this on their Attendance page.",
  month: "Month", workDays: "Days worked", totalHours: "Total hours", lates: "Late", absences: "Absent", openShifts: "Not clocked out", exportCsv: "Export CSV",
  details: "Details", addEntry: "Add attendance entry", save: "Save", cancel: "Cancel", edit: "Edit", delete: "Delete", shift: "Shift", sureDelete: "Delete this entry?",
  absentOn: "Absent days (scheduled but no attendance)", pickStaff: "Pick a staff member", timesheetHint: "Clock-in/out times are set by staff tapping the button (server time). Owner/manager can edit, add or delete entries. Late: clocked in more than {g} min after the shift start.",
  outBeforeIn: "Clock-out must be after clock-in.", saved: "Saved.", none: "—",
};

export type HrText = typeof vi;
/** Chữ của phần Nhân sự (chấm công, lịch ca) theo ngôn ngữ đang chọn; `{x}` được thay bằng `fill`. */
export function useHr() {
  const { lang } = useI18n();
  return lang === "vi" ? vi : en;
}
export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
