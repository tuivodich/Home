import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";
import { tgNotify } from "./telegram";

export type RoomClean = "ready" | "dirty" | "cleaning";
export interface RoomStatusDoc { id: string; status: RoomClean; note?: string; assignedTo?: string; assignedName?: string; updatedByName?: string; updatedAt?: { toMillis(): number } }

/** Ghi trạng thái buồng phòng (chỉ các trường hợp lệ theo luật Firestore). */
export function setRoomStatus(roomId: string, status: RoomClean, by: { uid: string; name: string }, extra: { note?: string; assignedTo?: string; assignedName?: string } = {}) {
  return setDoc(doc(db, "roomStatus", roomId), {
    status, ...(extra.note ? { note: extra.note.slice(0, 300) } : {}),
    ...(extra.assignedTo ? { assignedTo: extra.assignedTo, assignedName: (extra.assignedName ?? "").slice(0, 100) } : {}),
    updatedAt: serverTimestamp(), updatedBy: by.uid, updatedByName: by.name.slice(0, 100),
  });
}

/** Khách trả phòng → phòng "bẩn" và báo qua Telegram (nút "Đã dọn xong"). Lỗi không làm hỏng việc trả phòng. */
export async function markRoomDirty(roomId: string, by: { uid: string; name: string }) {
  try { await setRoomStatus(roomId, "dirty", by); tgNotify("dirty", roomId); } catch (ex) { console.error("mark room dirty", ex); }
}
