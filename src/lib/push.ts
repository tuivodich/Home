import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { app, db } from "./firebase";

/** Thông báo đẩy trên thiết bị nhân viên (Firebase Cloud Messaging qua service worker /sw.js). */
export async function pushSupported(): Promise<boolean> {
  try { return "Notification" in window && "serviceWorker" in navigator && "PushManager" in window && (await isSupported()); } catch { return false; }
}

const KEY = "nhago.pushToken";
export const savedPushToken = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };

/** Xin quyền, lấy token FCM của thiết bị này và lưu vào fcmTokens/{token}. Trả về token. */
export async function enablePush(uid: string): Promise<string> {
  if (!(await pushSupported())) throw new Error("unsupported");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("denied");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { serviceWorkerRegistration: reg });
  if (!token) throw new Error("no-token");
  await setDoc(doc(db, "fcmTokens", token), { uid, ua: navigator.userAgent.slice(0, 120), at: serverTimestamp() });
  try { localStorage.setItem(KEY, token); } catch { /* bỏ qua */ }
  return token;
}

/** Tắt thông báo đẩy trên thiết bị này (xóa token đã lưu). */
export async function disablePush(): Promise<void> {
  const t = savedPushToken();
  if (t) await deleteDoc(doc(db, "fcmTokens", t)).catch(() => {});
  try { localStorage.removeItem(KEY); } catch { /* bỏ qua */ }
}

/** Token đã lưu có còn ở máy chủ không (bị dọn khi hết hạn/hạ quyền). */
export async function pushStillRegistered(): Promise<boolean> {
  const t = savedPushToken();
  if (!t) return false;
  try { return (await getDoc(doc(db, "fcmTokens", t))).exists(); } catch { return false; }
}
