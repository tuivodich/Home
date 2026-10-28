import { useI18n } from "./index";

const vi = {
  title: "Điểm tham quan đẹp", sub: "Những điểm tham quan đẹp, quán ăn và cà phê quanh homestay, kèm bản đồ vệ tinh và hướng dẫn đường đi.",
  map: "Bản đồ vị trí homestay", openMap: "Mở Google Maps", directions: "Chỉ đường", noAddress: "Chủ homestay chưa nhập địa chỉ nên chưa hiện bản đồ.",
  all: "Tất cả", sight: "Tham quan", food: "Ăn uống", cafe: "Cà phê", shop: "Mua sắm", other: "Khác", viewOnMap: "Xem trên bản đồ", none: "Chưa có địa điểm nào.",
  edit: "Chỉnh sửa nội dung", save: "Lưu", cancel: "Hủy", saved: "Đã lưu.", failed: "Không lưu được. Vui lòng thử lại.", saving: "Đang lưu…",
  directionsTitle: "Hướng dẫn đường đi", placesTitle: "Điểm tham quan gợi ý", editorHint: "Dùng “## tiêu đề”, “- gạch đầu dòng”, **chữ đậm** trong phần hướng dẫn. Để trống bản tiếng Anh thì trang hiện bản tiếng Việt.",
  nameVi: "Tên (Việt)", nameEn: "Tên (Anh)", cat: "Loại", distance: "Khoảng cách / thời gian", descVi: "Mô tả (Việt)", descEn: "Mô tả (Anh)", mapUrl: "Đường dẫn bản đồ (https://…, tùy chọn)",
  addPlace: "Thêm địa điểm", remove: "Xóa", up: "Lên", down: "Xuống", dirVi: "Hướng dẫn (Việt)", dirEn: "Hướng dẫn (Anh)", sample: "Đang hiển thị nội dung mẫu; chủ/quản lý hãy chỉnh lại cho đúng các điểm tham quan thật quanh homestay.",
};
const en: typeof vi = {
  title: "Beautiful places to visit", sub: "Scenic spots, places to eat and coffee spots around the homestay, plus a satellite map and directions.",
  map: "Homestay location", openMap: "Open Google Maps", directions: "Get directions", noAddress: "The owner hasn't entered an address yet, so no map is shown.",
  all: "All", sight: "Sightseeing", food: "Food", cafe: "Coffee", shop: "Shopping", other: "Other", viewOnMap: "View on map", none: "No places yet.",
  edit: "Edit content", save: "Save", cancel: "Cancel", saved: "Saved.", failed: "Could not save. Please try again.", saving: "Saving…",
  directionsTitle: "Directions", placesTitle: "Suggested places to visit", editorHint: "Use “## heading”, “- bullet”, **bold** in the directions. Leave the English text empty to show Vietnamese.",
  nameVi: "Name (Vietnamese)", nameEn: "Name (English)", cat: "Type", distance: "Distance / time", descVi: "Description (Vietnamese)", descEn: "Description (English)", mapUrl: "Map link (https://…, optional)",
  addPlace: "Add place", remove: "Remove", up: "Up", down: "Down", dirVi: "Directions (Vietnamese)", dirEn: "Directions (English)", sample: "Showing sample content; the owner/manager should replace it with real local places.",
};
export type ExploreText = typeof vi;
export function useX() { const { lang } = useI18n(); return lang === "vi" ? vi : en; }
