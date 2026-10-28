import { memo, useEffect, useMemo, useState } from "react";
import type { ThemeId } from "../lib/theme";
import { PALETTES, rng, sceneSvg } from "./forest";

/** Màn hình hẹp (điện thoại): đưa nhà gỗ vào giữa tranh để không bị cắt mất. */
function useNarrow(max = 760) {
  const q = `(max-width: ${max}px)`;
  const [narrow, setNarrow] = useState(() => typeof matchMedia === "function" && matchMedia(q).matches);
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setNarrow(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, [q]);
  return narrow;
}

/** Tranh nhà gỗ giữa rừng thông theo giao diện; SVG do chương trình tự sinh (không chứa dữ liệu người dùng). */
const ForestScene = memo(function ForestScene({ theme, id }: { theme: ThemeId; id: string }) {
  const narrow = useNarrow();
  const html = useMemo(() => {
    const p = PALETTES[theme];
    return sceneSvg(p, narrow ? { id, cabinX: 800, cabinScale: 1.35, withTree: false, withSnowman: false } : { id });
  }, [theme, id, narrow]);
  return <div className="lp-scene-art" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
});
export default ForestScene;

/** Đom đóm bay lơ lửng (chỉ là trang trí; tự tắt khi người dùng chọn giảm chuyển động hoặc chủ tắt hiệu ứng). */
export const Fireflies = memo(function Fireflies({ count = 16 }: { count?: number }) {
  const items = useMemo(() => {
    const r = rng(99);
    return Array.from({ length: count }, (_, i) => ({
      key: i, left: 4 + r() * 92, top: 38 + r() * 52, delay: -r() * 8, dur: 6 + r() * 6, size: 3 + r() * 3,
    }));
  }, [count]);
  return (
    <div className="lp-fireflies" aria-hidden="true">
      {items.map((f) => (
        <i key={f.key} style={{ left: `${f.left}%`, top: `${f.top}%`, width: f.size, height: f.size, animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s` }} />
      ))}
    </div>
  );
});

/** Tuyết rơi nhẹ (chỉ giao diện Noel; CSS ẩn ở giao diện khác). */
export const Snowfall = memo(function Snowfall({ count = 46 }: { count?: number }) {
  const flakes = useMemo(() => {
    const r = rng(2024);
    return Array.from({ length: count }, (_, i) => ({ key: i, left: r() * 100, size: 2 + r() * 4, dur: 8 + r() * 10, delay: -r() * 18, drift: (r() - .5) * 60, op: .45 + r() * .5 }));
  }, [count]);
  return (
    <div className="lp-snowfall" aria-hidden="true">
      {flakes.map((f) => (
        <i key={f.key} style={{ left: `${f.left}%`, width: f.size, height: f.size, opacity: f.op, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, ["--dx" as string]: `${f.drift}px` }} />
      ))}
    </div>
  );
});

/** Dây đèn Noel nhấp nháy dọc mép trên của tranh. */
export const Garland = memo(function Garland() {
  const bulbs = useMemo(() => Array.from({ length: 28 }, (_, i) => i), []);
  return (
    <div className="lp-garland" aria-hidden="true">
      <svg viewBox="0 0 1600 40" preserveAspectRatio="none"><path d="M0 4 Q 100 34 200 4 T 400 4 T 600 4 T 800 4 T 1000 4 T 1200 4 T 1400 4 T 1600 4" fill="none" stroke="#1b2a22" strokeWidth="2.5" /></svg>
      {bulbs.map((i) => <i key={i} style={{ left: `${(i + .5) * (100 / 28)}%`, top: i % 2 ? "14px" : "2px", animationDelay: `${(i % 7) * -.45}s` }} data-c={i % 4} />)}
    </div>
  );
});

/** Dải cây thông làm đường chân trời giữa các mục (tô bằng màu hiện tại của CSS `fill`). */
export const TreeLine = memo(function TreeLine({ seed = 5, flip = false }: { seed?: number; flip?: boolean }) {
  const d = useMemo(() => {
    const r = rng(seed);
    let x = -10, out = "";
    while (x < 1610) {
      const w = 26 + r() * 40, h = 28 + r() * 52, b = 90;
      out += `M${x.toFixed(0)} ${b} L${(x + w / 2).toFixed(0)} ${(b - h).toFixed(0)} L${(x + w).toFixed(0)} ${b}Z `;
      if (r() > .45) { const w2 = w * .7, h2 = h * .7, x2 = x + w * .55; out += `M${x2.toFixed(0)} ${b} L${(x2 + w2 / 2).toFixed(0)} ${(b - h2).toFixed(0)} L${(x2 + w2).toFixed(0)} ${b}Z `; }
      x += w * (.55 + r() * .35);
    }
    return out + "M-10 90 H1610 V92 H-10Z";
  }, [seed]);
  return (
    <svg className={`lp-treeline${flip ? " flip" : ""}`} viewBox="0 0 1600 92" preserveAspectRatio="none" aria-hidden="true"><path d={d} /></svg>
  );
});

/** Sương trôi chậm (Sương mai, Hoàng hôn); CSS chỉ bật cho hai giao diện này và tắt khi giảm chuyển động. */
export const Drift = memo(function Drift() {
  return <div className="lp-drift" aria-hidden="true"><i /><i /><i /></div>;
});
