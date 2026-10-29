/** Chuỗi ngẫu nhiên chữ-số (không dấu) dùng làm mã bí mật cho đường dẫn / webhook. */
export function randomToken(len = 32): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => chars[x % chars.length]).join("");
}

/** Sao chép vào bộ nhớ tạm; trình duyệt chặn thì trả false. */
export async function copyText(v: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(v); return true; } catch { return false; }
}
