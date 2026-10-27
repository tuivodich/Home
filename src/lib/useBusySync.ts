import { useEffect, useState } from "react";
import { deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useCollection } from "./useCollection";
import { todayStr } from "./format";
import type { Booking, Busy, Room } from "./types";

/** Khe giữ chỗ cho yêu cầu đang chờ: `pend/{uid}_{n}` (xem firestore.rules). */
export interface PendSlot { id: string; uid: string; n: number; bookingId: string }

/**
 * Chạy khi nhân viên lễ tân trở lên đang mở ứng dụng:
 * 1. Giữ cho `busy/` (lịch bận công khai) khớp với `bookings/`: bổ sung đặt phòng cũ chưa có bản sao,
 *    cập nhật trạng thái, gỡ đặt phòng đã hủy/xóa.
 * 2. Nhả khe giữ chỗ (giới hạn số yêu cầu đang chờ mỗi tài khoản) của yêu cầu không còn "chờ xác nhận" hoặc đã bị xóa.
 * 3. Tự từ chối yêu cầu online còn "chờ xác nhận" mà ngày nhận phòng đã qua (nếu bật trong Cài đặt).
 */
export function useBusySync(enabled: boolean) {
  const { data: bookings, loading: l1 } = useCollection<Booking>("bookings", enabled);
  const { data: busy, loading: l2 } = useCollection<Busy>("busy", enabled);
  const { data: slots, loading: l3 } = useCollection<PendSlot>("pend", enabled);
  const [autoReject, setAutoReject] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(doc(db, "settings", "app"), (s) => setAutoReject(s.data()?.autoRejectPending !== false), () => {});
  }, [enabled]);

  useEffect(() => {
    if (!enabled || l1 || l3) return;
    const pending = new Set(bookings.filter((b) => b.status === "pending").map((b) => b.id));
    const stale = slots.filter((x) => !pending.has(x.bookingId));
    if (stale.length) Promise.all(stale.map((x) => deleteDoc(doc(db, "pend", x.id)))).catch((e) => console.error("slot release", e));
  }, [enabled, bookings, slots, l1, l3]);

  useEffect(() => {
    if (!enabled || l1 || l2) return;
    const byId = new Map(busy.map((b) => [b.id, b]));
    const today = todayStr();
    const ops: Promise<unknown>[] = [];
    for (const b of bookings) {
      const cur = byId.get(b.id);
      byId.delete(b.id);
      if (b.status === "pending" && autoReject && b.checkIn < today) {
        // Quá ngày nhận phòng mà chưa được xác nhận → hết hạn. Lần đồng bộ kế tiếp sẽ gỡ bản sao công khai.
        ops.push(updateDoc(doc(db, "bookings", b.id), { status: "cancelled", cancelReason: "expired" }));
        continue;
      }
      if (b.status === "cancelled") {
        if (cur) ops.push(deleteDoc(doc(db, "busy", b.id)));
        continue;
      }
      const want = { roomId: b.roomId, checkIn: b.checkIn, checkOut: b.checkOut, status: b.status };
      if (!cur || cur.roomId !== want.roomId || cur.checkIn !== want.checkIn || cur.checkOut !== want.checkOut || cur.status !== want.status) {
        ops.push(setDoc(doc(db, "busy", b.id), want));
      }
    }
    for (const id of byId.keys()) ops.push(deleteDoc(doc(db, "busy", id))); // đặt phòng đã bị xóa
    if (ops.length) Promise.all(ops).catch((e) => console.error("busy sync", e));
  }, [enabled, bookings, busy, l1, l2, autoReject]);
}

/** Đổi tên phòng cũ có chữ "bê tông" thành "xây dựng" (chỉ chủ/quản lý ghi được, chạy một lần khi có dữ liệu cũ). */
export function useLegacyRoomNames(enabled: boolean) {
  const { data: rooms, loading } = useCollection<Room>("rooms", enabled);
  useEffect(() => {
    if (!enabled || loading) return;
    const old = rooms.filter((r) => /bê tông/i.test(r.name));
    if (old.length) Promise.all(old.map((r) => updateDoc(doc(db, "rooms", r.id), { name: r.name.replace(/bê tông/gi, "xây dựng") }))).catch((e) => console.error("room rename", e));
  }, [enabled, rooms, loading]);
}
