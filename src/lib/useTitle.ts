import { useEffect } from "react";

/** Đặt tiêu đề tab trình duyệt cho từng trang. */
export function useTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} · Nhà Gỗ Homestay`;
    return () => { document.title = prev; };
  }, [title]);
}
