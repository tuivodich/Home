export type Role = "owner" | "manager" | "reception" | "housekeeping" | "security" | "pending";
export const ROLES: Role[] = ["owner", "manager", "reception", "housekeeping", "security", "pending"];

export interface UserDoc { name?: string; email: string; role: Role }
export interface Room { id: string; name: string; type: "wood" | "concrete"; capacity: number; price: number; status: "active" | "maintenance" }
export type BookingStatus = "confirmed" | "checked_in" | "checked_out" | "cancelled";
export interface Booking {
  id: string; roomId: string; guestName: string; phone: string; checkIn: string; checkOut: string;
  guests: number; total: number; status: BookingStatus; note: string;
}
export interface Guest {
  id: string; fullName: string; docType: "cccd" | "passport" | "license" | "other"; docNumber: string;
  nationality: string; dob: string; phone: string; bookingId: string; docImagePath: string;
}
