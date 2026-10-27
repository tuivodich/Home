import { useEffect } from "react";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useCollection } from "./useCollection";
import type { Booking, Busy } from "./types";

/**
 * Giữ cho `busy/` (lịch bận công khai) khớp với `bookings/`. Chạy khi nhân viên lễ tân trở lên
 * đang mở ứng dụng: bổ sung đặt phòng cũ chưa có bản sao, cập nhật trạng thái, gỡ đặt phòng đã hủy/xóa.
 */
export function useBusySync(enabled: boolean) {
  const { data: bookings, loading: l1 } = useCollection<Booking>("bookings", enabled);
  const { data: busy, loading: l2 } = useCollection<Busy>("busy", enabled);

  useEffect(() => {
    if (!enabled || l1 || l2) return;
    const byId = new Map(busy.map((b) => [b.id, b]));
    const ops: Promise<unknown>[] = [];
    for (const b of bookings) {
      const cur = byId.get(b.id);
      byId.delete(b.id);
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
  }, [enabled, bookings, busy, l1, l2]);
}
