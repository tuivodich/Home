import { useEffect } from "react";

/**
 * Hiệu ứng hiện dần khi cuộn tới; tắt khi người dùng chọn giảm chuyển động.
 * Theo dõi cả các thẻ được thêm vào sau (dữ liệu tải từ Firestore như phòng, cảm nhận) để không bị ẩn mãi.
 */
export function useReveal() {
  useEffect(() => {
    const instant = !("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = instant ? null : new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io?.unobserve(e.target); } });
    }, { threshold: 0.12 });

    const scan = () => {
      document.querySelectorAll<HTMLElement>(".landing .reveal:not(.in)").forEach((el) => {
        if (io) io.observe(el); else el.classList.add("in");
      });
    };
    scan();
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io?.disconnect(); mo.disconnect(); };
  }, []);
}
