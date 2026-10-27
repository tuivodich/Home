// "pending" là vai trò cũ (trước khi có khách hàng tự đăng ký), vẫn xử lý như khách hàng.
export type Role = "owner" | "manager" | "reception" | "housekeeping" | "security" | "customer" | "pending";
export const STAFF_ROLES: Role[] = ["owner", "manager", "reception", "housekeeping", "security"];
export const ROLES: Role[] = [...STAFF_ROLES, "customer"];
export const isStaffRole = (r?: Role) => !!r && STAFF_ROLES.includes(r);
export const isFrontRole = (r?: Role) => r === "owner" || r === "manager" || r === "reception";

export interface UserDoc { name?: string; email: string; role: Role }
export interface Room { id: string; name: string; type: "wood" | "concrete"; capacity: number; price: number; status: "active" | "maintenance" }
export type BookingStatus = "pending" | "confirmed" | "checked_in" | "checked_out" | "cancelled";
export interface Booking {
  id: string; roomId: string; guestName: string; phone: string; checkIn: string; checkOut: string;
  guests: number; total: number; status: BookingStatus; note: string;
  email?: string; createdBy?: string; source?: "online" | "staff";
  couponCode?: string; discountPercent?: number; originalTotal?: number; cancelReason?: "expired";
  priceEditedBy?: string;
}

/** Bản sao công khai của đặt phòng: chỉ phòng + ngày + trạng thái, không có dữ liệu cá nhân. */
export interface Busy { id: string; roomId: string; checkIn: string; checkOut: string; status: BookingStatus }
export interface Guest {
  id: string; fullName: string; docType: "cccd" | "passport" | "license" | "other"; docNumber: string;
  nationality: string; dob: string; phone: string; email?: string; bookingId: string; docImagePath: string;
}

/** Mã giảm giá dùng một lần: id của tài liệu chính là mã. */
export interface Coupon {
  id: string; percent: number; used: boolean; note?: string;
  usedBy?: string; bookingId?: string; expiresAt?: { toMillis(): number }; createdAt?: { seconds: number };
}
