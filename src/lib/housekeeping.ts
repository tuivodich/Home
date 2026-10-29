import { arrayRemove, arrayUnion, deleteField, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "./firebase";
import { tgNotify } from "./telegram";

export type RoomClean = "ready" | "dirty" | "cleaning";
export interface RoomStatusDoc { id: string; status: RoomClean; note?: string; assignedTo?: string; assignedName?: string; updatedByName?: string; updatedAt?: { toMillis(): number }; done?: string[]; tasks?: Record<string, string> }
export interface CheckItem { id: string; label: string }
export interface PeriodicTask { id: string; label: string; everyDays: number }
export interface HkConfig { checklist: CheckItem[]; periodic: PeriodicTask[] }

/** Danh sách kiểm tra mặc định khi chủ chưa cấu hình (settings/housekeeping). */
export const DEFAULT_CHECKLIST: CheckItem[] = [
  { id: "linen", label: "Thay ga, vỏ gối" }, { id: "towel", label: "Thay khăn tắm" }, { id: "water", label: "Bổ sung nước uống, đồ dùng" },
  { id: "bath", label: "Dọn và khử mùi nhà vệ sinh" }, { id: "floor", label: "Lau sàn, hút bụi" }, { id: "check", label: "Kiểm tra hư hỏng, đồ khách bỏ quên" },
];

export function parseHkConfig(d: unknown): HkConfig {
  const o = (d ?? {}) as { checklist?: unknown; periodic?: unknown };
  const arr = (v: unknown) => (Array.isArray(v) ? v : []) as Record<string, unknown>[];
  const checklist = arr(o.checklist).filter((x) => typeof x?.id === "string" && typeof x?.label === "string" && (x.label as string).trim()).map((x) => ({ id: x.id as string, label: x.label as string }));
  const periodic = arr(o.periodic).filter((x) => typeof x?.id === "string" && typeof x?.label === "string" && typeof x?.everyDays === "number" && x.everyDays >= 1)
    .map((x) => ({ id: x.id as string, label: x.label as string, everyDays: Math.floor(x.everyDays as number) }));
  return { checklist: Array.isArray(o.checklist) ? checklist : DEFAULT_CHECKLIST, periodic };
}

export function useHkConfig() {
  const [cfg, setCfg] = useState<HkConfig>({ checklist: DEFAULT_CHECKLIST, periodic: [] });
  useEffect(() => onSnapshot(doc(db, "settings", "housekeeping"), (s) => setCfg(parseHkConfig(s.data())), () => undefined), []);
  return cfg;
}

/** Việc định kỳ đã đến hạn: chưa làm lần nào, hoặc lần cuối cách hôm nay ≥ everyDays. */
export function dueTasks(tasks: PeriodicTask[], last: Record<string, string> | undefined, today: string) {
  const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
  return tasks.filter((t) => { const l = last?.[t.id]; return !l || days(l, today) >= t.everyDays; });
}

/** Ghi trạng thái buồng phòng (chỉ các trường hợp lệ theo luật Firestore). Gộp vào tài liệu cũ để giữ danh sách kiểm tra và việc định kỳ. */
export function setRoomStatus(roomId: string, status: RoomClean, by: { uid: string; name: string }, extra: { note?: string; assignedTo?: string; assignedName?: string } = {}) {
  return setDoc(doc(db, "roomStatus", roomId), {
    status, ...(extra.note ? { note: extra.note.slice(0, 300) } : {}),
    ...(extra.assignedTo ? { assignedTo: extra.assignedTo, assignedName: (extra.assignedName ?? "").slice(0, 100) } : status !== "cleaning" ? { assignedTo: deleteField(), assignedName: deleteField() } : {}),
    // Phòng vừa bẩn: bắt đầu một danh sách kiểm tra mới.
    ...(status === "dirty" ? { done: [] } : {}),
    updatedAt: serverTimestamp(), updatedBy: by.uid, updatedByName: by.name.slice(0, 100),
  }, { merge: true });
}

/** Tích / bỏ tích một việc trong danh sách kiểm tra dọn phòng. */
export function toggleCheck(roomId: string, status: RoomClean, itemId: string, on: boolean, by: { uid: string; name: string }) {
  return setDoc(doc(db, "roomStatus", roomId), { status, done: on ? arrayUnion(itemId) : arrayRemove(itemId), updatedAt: serverTimestamp(), updatedBy: by.uid, updatedByName: by.name.slice(0, 100) }, { merge: true });
}

/** Ghi nhận đã làm một việc định kỳ hôm nay. */
export function markTaskDone(roomId: string, status: RoomClean, taskId: string, day: string, by: { uid: string; name: string }) {
  return setDoc(doc(db, "roomStatus", roomId), { status, tasks: { [taskId]: day }, updatedAt: serverTimestamp(), updatedBy: by.uid, updatedByName: by.name.slice(0, 100) }, { merge: true });
}

/** Ghi chú nội bộ của phòng (không hiện công khai). */
export const saveRoomNote = (roomId: string, text: string, byName: string) =>
  setDoc(doc(db, "roomNotes", roomId), { text: text.slice(0, 1000), updatedAt: serverTimestamp(), updatedByName: byName.slice(0, 100) });

/** Khách trả phòng → phòng "bẩn" và báo qua Telegram (nút "Đã dọn xong"). Lỗi không làm hỏng việc trả phòng. */
export async function markRoomDirty(roomId: string, by: { uid: string; name: string }) {
  try { await setRoomStatus(roomId, "dirty", by); tgNotify("dirty", roomId); } catch (ex) { console.error("mark room dirty", ex); }
}
