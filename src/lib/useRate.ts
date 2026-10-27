import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import { DEFAULT_USD_RATE, formatMoney } from "./format";

/** Trả về hàm `money(vnd)` hiển thị VNĐ kèm quy đổi USD theo tỷ giá trong Cài đặt. */
export function useMoney() {
  const [rate, setRate] = useState(DEFAULT_USD_RATE);
  useEffect(() => onSnapshot(doc(db, "settings", "app"), (s) => {
    const r = s.data()?.usdRate;
    if (typeof r === "number" && r > 0) setRate(r);
  }, () => {}), []);
  return { rate, money: (vnd: number) => formatMoney(vnd, rate) };
}
