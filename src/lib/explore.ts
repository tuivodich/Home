import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export type PlaceCat = "sight" | "food" | "cafe" | "shop" | "other";
export const PLACE_CATS: PlaceCat[] = ["sight", "food", "cafe", "shop", "other"];
export interface Place { nameVi: string; nameEn: string; cat: PlaceCat; distance: string; descVi: string; descEn: string; mapUrl: string }
export interface ExploreDoc { directionsVi: string; directionsEn: string; places: Place[]; updatedAt?: { seconds: number } }

/** Nội dung mẫu: chủ/quản lý thay bằng địa điểm thật quanh homestay ở trang "Khám phá khu vực". */
export const DEFAULT_EXPLORE: ExploreDoc = {
  directionsVi: "## Cách đi\n- Từ trung tâm: đi theo đường chính, rẽ vào đường làng, homestay nằm bên tay phải (nội dung mẫu — chủ homestay sẽ cập nhật chỉ dẫn chính xác).\n- Bãi đậu xe rộng trong khuôn viên, ô tô vào tận cổng.\n- Cần đón tại bến xe/sân bay? Hãy chọn dịch vụ đón đưa khi đặt phòng hoặc liên hệ homestay.",
  directionsEn: "## Getting here\n- From the town centre: follow the main road, then turn onto the village lane; the homestay is on your right (sample text — the owner will add exact directions).\n- Plenty of parking inside the grounds; cars can drive to the gate.\n- Need a pickup from the bus station or airport? Choose the pickup service when booking or contact the homestay.",
  places: [
    { nameVi: "Điểm ngắm cảnh gần homestay", nameEn: "Nearby viewpoint", cat: "sight", distance: "≈ 3 km · 10 phút", descVi: "Nội dung mẫu: nơi ngắm hoàng hôn và biển mây, hợp để đi dạo buổi sáng sớm hoặc chiều muộn.", descEn: "Sample text: a spot for sunsets and sea of clouds, lovely for an early-morning or late-afternoon walk.", mapUrl: "" },
    { nameVi: "Thác / suối gần đó", nameEn: "Waterfall / stream nearby", cat: "sight", distance: "≈ 8 km · 20 phút", descVi: "Nội dung mẫu: thích hợp cho gia đình và nhóm bạn, nên đi vào buổi sáng.", descEn: "Sample text: great for families and groups; best visited in the morning.", mapUrl: "" },
    { nameVi: "Quán ăn đặc sản địa phương", nameEn: "Local specialty restaurant", cat: "food", distance: "≈ 2 km · 5 phút", descVi: "Nội dung mẫu: món ăn địa phương, giá bình dân, phục vụ nhóm đông.", descEn: "Sample text: local dishes at friendly prices, good for large groups.", mapUrl: "" },
    { nameVi: "Quán cà phê view đẹp", nameEn: "Scenic café", cat: "cafe", distance: "≈ 1.5 km · 4 phút", descVi: "Nội dung mẫu: không gian thoáng, có chỗ ngồi ngoài trời.", descEn: "Sample text: airy space with outdoor seating.", mapUrl: "" },
    { nameVi: "Chợ / cửa hàng tiện lợi", nameEn: "Market / convenience store", cat: "shop", distance: "≈ 1 km · 3 phút", descVi: "Nội dung mẫu: mua nhu yếu phẩm, đặc sản làm quà.", descEn: "Sample text: groceries and local specialties to take home.", mapUrl: "" },
  ],
};

export function useExplore() {
  const [data, setData] = useState<ExploreDoc | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => onSnapshot(doc(db, "pages", "explore"), (s) => { setData(s.exists() ? (s.data() as ExploreDoc) : null); setLoading(false); }, () => setLoading(false)), []);
  return { doc: data ?? DEFAULT_EXPLORE, custom: !!data, loading };
}

export const saveExplore = (d: Omit<ExploreDoc, "updatedAt">) => setDoc(doc(db, "pages", "explore"), { ...d, updatedAt: serverTimestamp() });

export const CAT_EMOJI: Record<PlaceCat, string> = { sight: "🏞️", food: "🍜", cafe: "☕", shop: "🛍️", other: "📍" };
/** Đường dẫn bản đồ an toàn (chỉ http/https); không có thì tìm theo tên địa điểm. */
export const placeLink = (p: Place, area: string) =>
  /^https?:\/\//i.test(p.mapUrl.trim()) ? p.mapUrl.trim() : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.nameVi} ${area}`.trim())}`;
