import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "./firebase";

const functions = getFunctions(app, "us-central1");
const call = <I, O>(name: string) => httpsCallable<I, O>(functions, name);

/** Báo cho bot Telegram một sự kiện của khách (yêu cầu đặt phòng, hủy, cảm nhận). Lỗi không ảnh hưởng người dùng. */
export function tgNotify(type: "booking" | "cancel" | "review", id?: string) {
  if (import.meta.env.VITE_USE_EMULATOR) return; // chạy thử cục bộ: không có Cloud Functions
  call<{ type: string; id?: string }, { sent: number }>("tgNotify")({ type, id }).catch((e) => console.warn("tgNotify", e));
}

export const tgLinkCode = () => call<void, { code: string; username: string; link: string }>("tgLinkCode")().then((r) => r.data);
export const tgSetup = () => call<void, { username: string; url: string }>("tgSetup")().then((r) => r.data);
