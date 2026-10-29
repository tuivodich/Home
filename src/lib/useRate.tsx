import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { DEFAULT_USD_RATE, formatMoney, usdText } from "./format";

/** Số tiền VNĐ (chữ "VNĐ" nhỏ hơn) kèm quy đổi USD. */
export function Money({ vnd, rate = DEFAULT_USD_RATE }: { vnd: number; rate?: number }) {
  return <>{new Intl.NumberFormat("vi-VN").format(Math.round(vnd))} <span className="cur">VNĐ</span> ({usdText(vnd, rate)})</>;
}

/** Trả về hàm `money(vnd)` hiển thị VNĐ kèm quy đổi USD theo tỷ giá trong Cài đặt. */
export function useMoney() {
  const [rate, setRate] = useState(DEFAULT_USD_RATE);
  useEffect(() => onSnapshot(doc(db, "settings", "app"), (s) => {
    const r = s.data()?.usdRate;
    if (typeof r === "number" && r > 0) setRate(r);
  }, () => {}), []);
  // `money` trả về phần tử React (dùng trong JSX); `moneyText` trả về CHUỖI để ghép vào văn bản (tooltip, chuỗi mẫu, CSV…).
  // Không đặt `money(...)` trong chuỗi mẫu vì sẽ in "[object Object]".
  return { rate, money: (vnd: number) => <Money vnd={vnd} rate={rate} />, moneyText: (vnd: number) => formatMoney(vnd, rate) };
}
