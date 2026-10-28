import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

const functions = getFunctions(app, "us-central1");
const call = <I, O>(name: string) => httpsCallable<I, O>(functions, name);

/** Báo cho bot Telegram một sự kiện của khách (yêu cầu đặt phòng, hủy, cảm nhận). Lỗi không ảnh hưởng người dùng. */
export function tgNotify(type: "booking" | "cancel" | "review" | "dirty", id?: string) {
  if (import.meta.env.VITE_USE_EMULATOR) return; // chạy thử cục bộ: không có Cloud Functions
  call<{ type: string; id?: string }, { sent: number }>("tgNotify")({ type, id }).catch((e) => console.warn("tgNotify", e));
}

export const tgLinkCode = () => call<void, { code: string; username: string; link: string }>("tgLinkCode")().then((r) => r.data);
export const tgGuestLink = () => call<void, { code: string; username: string; link: string }>("tgGuestLink")().then((r) => r.data);
/** Nhân viên vừa xác nhận/hủy đặt phòng trên web: báo khách (email/Telegram). Lỗi không ảnh hưởng thao tác. */
export function guestNotify(id: string) {
  if (import.meta.env.VITE_USE_EMULATOR) return;
  call<{ id: string }, { sent: boolean }>("guestNotify")({ id }).catch((e) => console.warn("guestNotify", e));
}
export const mailTest = (to: string) => call<{ to: string }, { ok: boolean }>("mailTest")({ to }).then((r) => r.data);
export const mailStatus = () => call<void, { configured: boolean }>("mailStatus")().then((r) => r.data);
export const tgSetup = () => call<void, { username: string; url: string }>("tgSetup")().then((r) => r.data);

/** Thành viên nhận mã giảm giá riêng của hạng hiện tại (Cloud Functions kiểm tra hạng ở máy chủ; mỗi hạng một mã). */
export const loyaltyClaim = () => call<void, { code: string; percent: number; expiresAt: number; existing: boolean }>("loyaltyClaim")().then((r) => r.data);

/** Sao lưu dữ liệu (chỉ chủ): chạy ngay, liệt kê và tải một bản đã lưu trên Cloud Storage. */
export interface BackupStatus { at: string; ok: boolean; file?: string; bytes?: number; counts?: Record<string, number>; error?: string; kept?: number }
export const backupNow = () => call<void, BackupStatus>("backupNow")().then((r) => r.data);
export const backupList = () => call<void, { files: { name: string; bytes: number }[] }>("backupList")().then((r) => r.data.files);
export const backupGet = (name: string) => call<{ name: string }, { name: string; json: string }>("backupGet")({ name }).then((r) => r.data.json);
