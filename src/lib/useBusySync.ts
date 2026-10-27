import { useEffect, useState } from "react";
import { deleteDoc, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useCollection } from "./useCollection";
import { todayStr } from "./format";
import type { Booking, Busy } from "./types";

/**
 * Chạy khi nhân viên lễ tân trở lên đang mở ứng dụng:
 * 1. Giữ cho `busy/` (lịch bận công khai) khớp với `bookings/`: bổ sung đặt phòng cũ chưa có bản sao,
 *    cập nhật trạng thái, gỡ đặt phòng đã hủy/xóa.
 * 2. Tự từ chối yêu cầu online còn "chờ xác nhận" mà ngày nhận phòng đã qua (nếu bật trong Cài đặt).
 */
export function useBusySync(enabled: boolean) {
  const { data: bookings, loading: l1 } = useCollection<Booking>("bookings", enabled);
  const { data: busy, loading: l2 } = useCollection<Busy>("busy", enabled);
  const [autoReject, setAutoReject] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    return onSnapshot(doc(db, "settings", "app"), (s) => setAutoReject(s.data()?.autoRejectPending !== false), () => {});
  }, [enabled]);

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
