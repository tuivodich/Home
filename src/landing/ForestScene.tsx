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

/** Sương trôi chậm (Sương mai, Hoàng hôn); CSS chỉ bật cho hai giao diện này và tắt khi giảm chuyển động. */
export const Drift = memo(function Drift() {
  return <div className="lp-drift" aria-hidden="true"><i /><i /><i /></div>;
});
