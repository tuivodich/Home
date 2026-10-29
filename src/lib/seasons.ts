/** Mùa lễ để tự chuyển giao diện website (thuần tính toán, kiểm thử ở scripts/seasons.test.mts). Tháng 0-based. */
export type SeasonTheme = "halloween" | "noel" | "tet";

/** Halloween: 20/10 – 01/11. */
export function isHalloweenSeason(d: Date): boolean {
  const m = d.getMonth(), day = d.getDate();
  return (m === 9 && day >= 20) || (m === 10 && day <= 1);
}

/** Noel: 01/12 – 05/01. */
export function isNoelSeason(d: Date): boolean {
  const m = d.getMonth(), day = d.getDate();
  return m === 11 || (m === 0 && day <= 5);
}

/** Mùng 1 Tết Nguyên Đán (dương lịch) từng năm; ngoài bảng thì không tự bật giao diện Tết. */
export const TET_DAY_ONE: Record<number, string> = {
  2025: "2025-01-29", 2026: "2026-02-17", 2027: "2027-02-06", 2028: "2028-01-26", 2029: "2029-02-13", 2030: "2030-02-03",
  2031: "2031-01-23", 2032: "2032-02-11", 2033: "2033-01-31", 2034: "2034-02-19", 2035: "2035-02-08",
};
const DAY = 86400000;
const TET_BEFORE = 21, TET_AFTER = 10; // trang trí từ 21 ngày trước đến 10 ngày sau mùng 1

/** Tết: từ 21 ngày trước đến 10 ngày sau mùng 1 Tết. */
export function isTetSeason(d: Date): boolean {
  const day = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return [d.getFullYear(), d.getFullYear() + 1].some((y) => {
    const t = TET_DAY_ONE[y];
    if (!t) return false;
    const diff = Math.round((Date.parse(`${t}T00:00:00Z`) - day) / DAY); // số ngày còn lại tới mùng 1
    return diff <= TET_BEFORE && diff >= -TET_AFTER;
  });
}

/** Giao diện theo mùa của ngày `d`, hoặc null khi đang ngoài mùa lễ. */
export function seasonTheme(d: Date): SeasonTheme | null {
  if (isHalloweenSeason(d)) return "halloween";
  if (isNoelSeason(d)) return "noel";
  if (isTetSeason(d)) return "tet";
  return null;
}
