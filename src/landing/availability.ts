import { addDays } from "../lib/format";
import type { Busy, Room } from "../lib/types";

export type Cell = "free" | "booked" | "held" | "maint";

export interface Search { checkIn: string; checkOut: string; roomId: string; guests: number }

/** Trạng thái một đêm (ngày d) của phòng. Ngày trả phòng không tính là đêm bận. */
export function nightState(room: Room, busy: Busy[], d: string): Cell {
  if (room.status === "maintenance") return "maint";
  let held = false;
  for (const b of busy) {
    if (b.roomId !== room.id || b.status === "cancelled") continue;
    if (b.checkIn <= d && d < b.checkOut) {
      if (b.status !== "pending") return "booked";
      held = true;
    }
  }
  return held ? "held" : "free";
}

/** Phòng có trống trọn khoảng [checkIn, checkOut) không; trả về trạng thái xấu nhất. */
export function rangeState(room: Room, busy: Busy[], checkIn: string, checkOut: string): Cell {
  let worst: Cell = "free";
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
    const s = nightState(room, busy, d);
    if (s === "maint") return "maint";
    if (s === "booked") worst = "booked";
    else if (s === "held" && worst === "free") worst = "held";
  }
  return worst;
}
