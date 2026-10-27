import { useEffect } from "react";

/** Hiệu ứng hiện dần khi cuộn tới; tắt khi người dùng chọn giảm chuyển động. */
export function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".landing .reveal");
    if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  });
}
