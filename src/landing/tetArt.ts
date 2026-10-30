/**
 * Hình vẽ chi tiết cho giao diện Tết: cây mai vàng và cô gái áo dài nón lá.
 * Chuỗi SVG do chương trình tự sinh (không chứa dữ liệu người dùng). Toạ độ cục bộ: chân/gốc ở (0, 0), hướng lên là y âm.
 * `id` làm hậu tố cho gradient/symbol để nhiều bức tranh trên cùng trang không trùng id.
 */
type P = [number, number];
const f = (v: number) => (Math.round(v * 10) / 10).toString();

function prng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const bez = (p0: P, p1: P, p2: P, p3: P, t: number): P => {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
};

/** Nét vẽ thon dần (thân, cành, tay áo) dọc theo đường cong Bézier bậc ba: trả về `d` của đa giác kín. */
function limb(p0: P, p1: P, p2: P, p3: P, w0: number, w1: number, n = 18): string {
  const c: P[] = [];
  for (let i = 0; i <= n; i++) c.push(bez(p0, p1, p2, p3, i / n));
  const L: P[] = [], R: P[] = [];
  c.forEach((p, i) => {
    const a = c[Math.max(0, i - 1)], b = c[Math.min(n, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    const w = (w0 + (w1 - w0) * (i / n)) / 2;
    L.push([p[0] - dy * w, p[1] + dx * w]);
    R.push([p[0] + dy * w, p[1] - dx * w]);
  });
  const pts = [...L, ...R.reverse()];
  return `M${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" L")}Z`;
}

/** Đường cong (không đóng) đi theo tâm của một nhánh, dùng cho nét vân gỗ. */
function line(p0: P, p1: P, p2: P, p3: P, a: number, b: number, off = 0, n = 10): string {
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = a + (b - a) * (i / n), p = bez(p0, p1, p2, p3, t), q = bez(p0, p1, p2, p3, Math.min(1, t + .02));
    let dx = q[0] - p[0], dy = q[1] - p[1]; const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    pts.push(`${f(p[0] - dy * off)},${f(p[1] + dx * off)}`);
  }
  return `M${pts.join(" L")}`;
}

/** Biểu tượng dùng chung: bông mai 5 cánh, nụ, lá non. */
function maiDefs(id: string) {
  const petal = "M0,0 C-4.6,-1.6 -6.2,-8.2 -2.3,-10.1 C-1,-10.7 1,-10.7 2.3,-10.1 C6.2,-8.2 4.6,-1.6 0,0Z";
  const petals = [0, 72, 144, 216, 288].map((a) => `<path d="${petal}" transform="rotate(${a})" fill="url(#mg${id})" stroke="#d9990f" stroke-width=".45"/>`).join("");
  const veins = [0, 72, 144, 216, 288].map((a) => `<path d="M0,-2.4 L0,-7" transform="rotate(${a})" stroke="#e0a21a" stroke-width=".35" opacity=".7"/>`).join("");
  const stamens = Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; return `<circle cx="${f(Math.cos(a) * 3.1)}" cy="${f(Math.sin(a) * 3.1)}" r=".7" fill="#e8741a"/>`; }).join("");
  return `<defs>
    <radialGradient id="mg${id}" cx=".5" cy=".92" r="1.05"><stop offset="0" stop-color="#fff6b8"/><stop offset=".5" stop-color="#ffdf4a"/><stop offset="1" stop-color="#f2b21a"/></radialGradient>
    <g id="mf${id}">${petals}${veins}<circle r="2.6" fill="#f4a31d"/>${stamens}<circle r="1" fill="#a85a08"/></g>
    <g id="mb${id}"><ellipse cx="0" cy="-3" rx="2.6" ry="3.8" fill="#f3b320"/><ellipse cx="-.7" cy="-4" rx="1" ry="1.8" fill="#ffe27a" opacity=".8"/><path d="M-2,0 Q0,2 2,0 L1.4,-1.6 L-1.4,-1.6Z" fill="#5d8f2c"/></g>
    <g id="ml${id}"><path d="M0,0 C3,-3.4 8,-3.6 11,0 C8,3.4 3,3.6 0,0Z" fill="#74c24c" stroke="#3f8f2f" stroke-width=".4"/><path d="M0,0 L10,0" stroke="#3f8f2f" stroke-width=".35"/></g>
  </defs>`;
}

/** Cây mai vàng nở rộ: thân xoắn có vân gỗ và rễ nổi, cành chia nhiều tầng thon dần, hàng trăm bông mai năm cánh, nụ, lá non và cánh hoa rụng. Gốc ở (0, 0), cao khoảng 300. */
export function maiTree(id: string): string {
  const r = prng(77);
  const trunk: [P, P, P, P] = [[0, 0], [14, -44], [-20, -96], [6, -170]];
  const limbs: string[] = [], flowers: string[] = [], buds: string[] = [], leaves: string[] = [];
  const bloom = (p: P, s: number) => flowers.push(`<use href="#mf${id}" transform="translate(${f(p[0] + (r() - .5) * 7)} ${f(p[1] + (r() - .5) * 7)}) rotate(${f(r() * 72)}) scale(${f(s)})"/>`);
  /** Một cành cong tự chia nhánh (depth = số tầng còn lại); góc a tính từ phương thẳng đứng. */
  function grow(p0: P, a: number, len: number, w: number, depth: number) {
    const bend = (r() - .5) * 1.0;
    const at = (ang: number, l: number): P => [p0[0] + Math.sin(ang) * l, p0[1] - Math.cos(ang) * l];
    const p1 = at(a + bend * .3, len * .33), p2 = at(a + bend * .8, len * .68), p3 = at(a + bend * 1.25, len);
    const w1 = Math.max(1.1, w * .4);
    limbs.push(`<path d="${limb(p0, p1, p2, p3, w, w1, 12)}"/>`);
    const nF = depth >= 2 ? 4 : depth === 1 ? 3 : 2;
    for (let k = 0; k < nF; k++) bloom(bez(p0, p1, p2, p3, .42 + (.58 * k) / Math.max(1, nF - 1)), .5 + r() * .42);
    if (r() > .35) { const b = bez(p0, p1, p2, p3, 1); buds.push(`<use href="#mb${id}" transform="translate(${f(b[0])} ${f(b[1])}) rotate(${f((a + bend) * 57 + (r() - .5) * 60)}) scale(${f(.7 + r() * .4)})"/>`); }
    if (r() > .55) { const l = bez(p0, p1, p2, p3, .5 + r() * .4); leaves.push(`<use href="#ml${id}" transform="translate(${f(l[0])} ${f(l[1])}) rotate(${f(r() * 360)}) scale(${f(.45 + r() * .35)})"/>`); }
    if (depth > 0) {
      const n = depth === 2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const t = .36 + (.46 * i) / n + r() * .1, q = bez(p0, p1, p2, p3, t), side = i % 2 ? 1 : -1;
        grow(q, a + bend * (.5 + t * .7) + side * (.5 + r() * .5), len * (.5 + r() * .16), w1 * .95, depth - 1);
      }
    }
  }
  // cành chính mọc từ thân, luân phiên hai bên; ngọn thân là cành dẫn đầu
  ([[.34, -1.25, 86, 8], [.46, 1.15, 98, 8.5], [.58, -.95, 94, 7.5], [.7, .9, 88, 7], [.84, -.6, 80, 6.5]] as [number, number, number, number][])
    .forEach(([t, a, len, w]) => grow(bez(trunk[0], trunk[1], trunk[2], trunk[3], t), a, len, w, 2));
  grow(trunk[3], .08, 96, 8.5, 2);
  grow(trunk[3], -.62, 78, 6.5, 2);
  grow(trunk[3], .72, 74, 6.2, 2);
  const [t0, t1, t2, t3] = trunk;
  const roots = ([[-1, 42, 10], [1, 46, 10], [-1, 24, 7], [1, 26, 7]] as [number, number, number][]).map(([sd, l, w]) => `<path d="${limb([sd * 3, -10], [sd * 12, -8], [sd * (l * .6), -2], [sd * l, 3], w, 2.4, 8)}"/>`).join("");
  const fallen = Array.from({ length: 16 }, (_, i) => `<ellipse cx="${f((r() - .5) * 190)}" cy="${f(r() * 9 + 1)}" rx="3.3" ry="1.7" transform="rotate(${f(r() * 180)} ${f(i * 3)} 3)" fill="#ffd23f" opacity=".92"/>`).join("");
  return `${maiDefs(id)}
    <defs><linearGradient id="mk${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2d1a0e"/><stop offset=".45" stop-color="#5a3a21"/><stop offset=".7" stop-color="#7a5230"/><stop offset="1" stop-color="#3a2314"/></linearGradient></defs>
    <ellipse cx="0" cy="3" rx="54" ry="7" fill="#000" opacity=".3"/>
    <g fill="#4b2f1b">${limbs.join("")}</g><g fill="url(#mk${id})"><path d="${limb(t0, t1, t2, t3, 24, 9)}"/>${roots}</g>
    <g fill="none" stroke-linecap="round"><path d="${line(t0, t1, t2, t3, .05, .92, -3.8)}" stroke="#20120a" stroke-width="1.3" opacity=".55"/><path d="${line(t0, t1, t2, t3, .08, .8, 2.8)}" stroke="#9a6c42" stroke-width="1.1" opacity=".5"/><path d="${line(t0, t1, t2, t3, .15, .6, -.6)}" stroke="#20120a" stroke-width=".9" opacity=".4"/></g>
    <ellipse cx="-2" cy="-64" rx="3.4" ry="5.6" fill="#2a170c" opacity=".55" transform="rotate(8 -2 -64)"/>
    ${leaves.join("")}${buds.join("")}${flowers.join("")}${fallen}`;
}

/** Cô gái áo dài đỏ thêu mai vàng, nón lá, tóc dài, tay cầm cành mai và bao lì xì. Chân ở (0, 0), cao khoảng 212. */
export function aoDai(id: string): string {
  const defs = `${maiDefs(id)}<defs>
    <linearGradient id="ar${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b3202a"/><stop offset=".35" stop-color="#ef3d38"/><stop offset=".6" stop-color="#d8302f"/><stop offset="1" stop-color="#97171f"/></linearGradient>
    <linearGradient id="ab${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8e151d"/><stop offset=".5" stop-color="#b8222a"/><stop offset="1" stop-color="#82121a"/></linearGradient>
    <radialGradient id="sk${id}" cx=".45" cy=".4" r=".75"><stop offset="0" stop-color="#fde3c6"/><stop offset=".7" stop-color="#f1c29a"/><stop offset="1" stop-color="#dba37a"/></radialGradient>
    <linearGradient id="hr${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0c0707"/><stop offset=".4" stop-color="#2c1b1b"/><stop offset="1" stop-color="#0a0505"/></linearGradient>
    <linearGradient id="ht${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c9a257"/><stop offset=".35" stop-color="#f6e4ac"/><stop offset=".65" stop-color="#e9cf86"/><stop offset="1" stop-color="#b78f45"/></linearGradient>
    <linearGradient id="pt${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e4dccb"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#dcd3c0"/></linearGradient>
    <radialGradient id="gm${id}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff2a8"/><stop offset="1" stop-color="#f1c34b"/></radialGradient>
  </defs>`;
  const goldFlower = (x: number, y: number, s: number, rot = 0) => `<use href="#mf${id}" transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" opacity=".92"/>`;
  const trims = (y: number) => `<path d="M-30,${y} Q0,${y + 5} 30,${y}" stroke="#f1c34b" stroke-width="1.2" fill="none" opacity=".9"/>`;
  const dots = [[3, -127], [7, -124.4], [11, -121], [13.6, -116.6], [14.6, -111.4], [14.4, -106]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="url(#gm${id})" stroke="#b8860b" stroke-width=".25"/>`).join("");
  const rings = [1, 2, 3, 4, 5].map((k) => { const w = (44 * k) / 6.2, y0 = -212 + (38 * k) / 6.2; return `<path d="M${f(-w)},${f(y0)} Q0,${f(y0 + w * .42)} ${f(w)},${f(y0)}" stroke="#a98338" stroke-width=".7" fill="none" opacity=".55"/>`; }).join("");
  const ribs = [-34, -22, -11, 0, 11, 22, 34].map((x) => `<path d="M0,-212 L${x},-174" stroke="#b8923f" stroke-width=".5" opacity=".4"/>`).join("");
  return `${defs}
    <ellipse cx="0" cy="2" rx="38" ry="6" fill="#000" opacity=".3"/>
    <!-- tóc dài phía sau -->
    <path d="M-13,-160 C-20,-150 -19,-128 -22,-108 C-23,-96 -17,-92 -13,-97 C-13,-116 -12,-136 -10,-150Z" fill="url(#hr${id})"/>
    <path d="M13,-160 C20,-150 20,-130 20,-110 C20,-98 15,-93 11,-99 C13,-118 12,-138 10,-150Z" fill="url(#hr${id})"/>
    <!-- quần lụa trắng -->
    <path d="M-17,-32 C-19,-20 -20,-10 -21,-3 C-14,1 -7,0 -1,-3 C-1,-14 -1,-24 -1,-32Z" fill="url(#pt${id})"/><path d="M17,-32 C19,-20 20,-10 21,-3 C14,1 7,0 1,-3 C1,-14 1,-24 1,-32Z" fill="url(#pt${id})"/>
    <path d="M-13,-26 Q-14,-14 -15,-5 M13,-26 Q14,-14 15,-5" stroke="#cfc6b2" stroke-width=".6" fill="none"/>
    <ellipse cx="-12" cy="-1.5" rx="8.5" ry="3" fill="#e2b13f"/><ellipse cx="12" cy="-1.5" rx="8.5" ry="3" fill="#e2b13f"/><path d="M-18,-2 Q-12,-5.5 -5,-2 M5,-2 Q12,-5.5 18,-2" stroke="#fff0b0" stroke-width=".8" fill="none" opacity=".8"/>
    <!-- vạt sau + vạt trước áo dài -->
    <path d="M-17,-126 C-22,-112 -19,-100 -14,-90 C-20,-64 -30,-40 -38,-19 C-24,-12 -8,-13 0,-17 C8,-13 24,-12 38,-19 C30,-40 20,-64 14,-90 C19,-100 22,-112 17,-126Z" fill="url(#ab${id})"/>
    <path d="M-15,-125 C-19,-110 -16,-100 -12,-90 C-16,-64 -22,-40 -27,-18 C-17,-12 -6,-14 0,-18 C6,-14 17,-12 27,-18 C22,-40 16,-64 12,-90 C16,-100 19,-110 15,-125 Q0,-130 -15,-125Z" fill="url(#ar${id})"/>
    <path d="M-12,-90 C-14,-64 -19,-40 -22,-19 M12,-90 C14,-64 19,-40 22,-19" stroke="#8a121a" stroke-width=".9" fill="none" opacity=".85"/>
    <path d="M-5,-92 C-6,-68 -8,-44 -9,-18 M5,-92 C6,-68 8,-44 9,-18 M0,-90 C0,-64 0,-40 0,-17" stroke="#ff8a7e" stroke-width=".6" fill="none" opacity=".45"/>
    <path d="M-12,-96 C-5,-92 5,-92 12,-96" stroke="#7d0f16" stroke-width="1" fill="none" opacity=".6"/>
    ${trims(-19.5)}${trims(-23.5).replace('opacity=".9"', 'opacity=".5"')}
    ${goldFlower(-14, -30, .42, 10)}${goldFlower(-5, -34, .38, -12)}${goldFlower(5, -29, .42, 25)}${goldFlower(14, -35, .38, 5)}${goldFlower(-9, -52, .4, 40)}${goldFlower(8, -57, .4, -8)}${goldFlower(-6, -74, .36, 18)}${goldFlower(5, -82, .34, 0)}
    <path d="M-30,-23 Q-16,-18 0,-22 Q16,-18 30,-23" stroke="#f1c34b" stroke-width=".9" fill="none" opacity=".8"/>
    <!-- thân áo, cổ trụ, hàng cúc vàng -->
    <path d="M-16,-125 C-18,-116 -15,-104 -12,-96 L12,-96 C15,-104 18,-116 16,-125 Q0,-131 -16,-125Z" fill="url(#ar${id})" opacity=".0"/>
    <path d="M-17,-127 Q0,-133 17,-127 L16,-122 Q0,-127 -16,-122Z" fill="#c02a2e" opacity=".9"/>
    <path d="M3,-127 C9,-125 14,-121 15,-114 C16,-108 14,-104 12,-98" stroke="#f1c34b" stroke-width="1.1" fill="none"/>${dots}
    <path d="M-6,-120 Q-14,-110 -12,-98" stroke="#d65a52" stroke-width=".8" fill="none" opacity=".5"/>
    <!-- tay áo trái (cầm cành mai) và tay phải (cầm bao lì xì) -->
    <path d="${limb([-16, -125], [-26, -121], [-30, -106], [-23, -88], 9.5, 6.2)}" fill="url(#ar${id})"/>
    <path d="${limb([16, -125], [27, -121], [31, -108], [22, -92], 9.5, 6.2)}" fill="url(#ar${id})"/>
    <ellipse cx="-23" cy="-87" rx="3.6" ry="1.5" fill="#f1c34b" transform="rotate(-18 -23 -87)"/><ellipse cx="22" cy="-91" rx="3.6" ry="1.5" fill="#f1c34b" transform="rotate(20 22 -91)"/>
    <path d="M-27,-114 Q-31,-104 -26,-93 M27,-117 Q32,-106 26,-96" stroke="#7d0f16" stroke-width=".7" fill="none" opacity=".5"/>
    <path d="M-24,-85 q-1.5,-3 1,-4.4 q3.4,-.8 3.8,2 q.6,3.2 -1.6,4.4 q-2.4,.8 -3.2,-2z" fill="url(#sk${id})"/>
    <path d="M22,-89 q1.5,-3 -1,-4.4 q-3.4,-.8 -3.8,2 q-.6,3.2 1.6,4.4 q2.4,.8 3.2,-2z" fill="url(#sk${id})"/>
    <!-- bao lì xì -->
    <g transform="rotate(-7 17 -98)"><rect x="11" y="-110" width="13" height="18" rx="1.6" fill="#d62d2d" stroke="#f1c34b" stroke-width=".9"/><path d="M11,-106 L17.5,-101 L24,-106" stroke="#f1c34b" stroke-width=".8" fill="none"/><circle cx="17.5" cy="-99" r="2.6" fill="url(#gm${id})"/><path d="M16,-99 h3 M17.5,-100.5 v3" stroke="#b8860b" stroke-width=".5"/></g>
    <path d="M20,-90 q1.5,-3 -.6,-4 q-2.4,.2 -2.8,2.4 q-.2,2.4 1.4,3.2 q1.4,.2 2,-1.6z" fill="url(#sk${id})"/>
    <!-- cành mai trên tay trái -->
    <path d="M-23,-88 C-28,-112 -34,-134 -44,-160" stroke="#4a2c18" stroke-width="2.4" stroke-linecap="round" fill="none"/><path d="M-30,-118 C-38,-124 -46,-124 -54,-132 M-36,-140 C-30,-148 -26,-152 -22,-160" stroke="#4a2c18" stroke-width="1.5" stroke-linecap="round" fill="none"/>
    <use href="#ml${id}" transform="translate(-33 -128) rotate(-150) scale(.5)"/><use href="#ml${id}" transform="translate(-40 -150) rotate(-20) scale(.45)"/>
    <use href="#mf${id}" transform="translate(-44 -161) rotate(10) scale(.95)"/><use href="#mf${id}" transform="translate(-55 -133) rotate(40) scale(.85)"/><use href="#mf${id}" transform="translate(-22 -162) rotate(70) scale(.8)"/><use href="#mf${id}" transform="translate(-37 -142) rotate(25) scale(.8)"/><use href="#mf${id}" transform="translate(-30 -118) rotate(5) scale(.7)"/>
    <use href="#mb${id}" transform="translate(-50 -150) rotate(-40) scale(.9)"/><use href="#mb${id}" transform="translate(-26 -148) rotate(30) scale(.8)"/>
    <!-- cổ, mặt, tóc, nón lá -->
    <path d="M-4.6,-143 L-4.6,-130 Q0,-126.5 4.6,-130 L4.6,-143Z" fill="#e5ac80"/>
    <path d="M-7,-132.5 Q0,-127 7,-132.5 L6.4,-128 Q0,-123.4 -6.4,-128Z" fill="#c02a2e" stroke="#f1c34b" stroke-width=".7"/>
    <path d="M-11.5,-158 C-12,-148 -7,-141 0,-140.4 C7,-141 12,-148 11.5,-158 C11,-166.5 -11,-166.5 -11.5,-158Z" fill="url(#sk${id})"/>
    <path d="M-13.2,-160 C-13.6,-172 13.6,-172 13.2,-160 C11,-166 6,-168 0,-168 C-6,-168 -11,-166 -13.2,-160Z" fill="url(#hr${id})"/>
    <path d="M-12,-158 C-12.4,-150 -10,-146 -8,-143 C-10,-148 -10.6,-153 -10.4,-158Z M12,-158 C12.4,-150 10,-146 8,-143 C10,-148 10.6,-153 10.4,-158Z" fill="#0e0808"/>
    <ellipse cx="-6.6" cy="-150.4" rx="2.6" ry="1.9" fill="#f08a8a" opacity=".35"/><ellipse cx="6.6" cy="-150.4" rx="2.6" ry="1.9" fill="#f08a8a" opacity=".35"/>
    <path d="M-8.4,-155.4 Q-5.6,-158.2 -2.8,-155.4 Q-5.6,-153.4 -8.4,-155.4Z M2.8,-155.4 Q5.6,-158.2 8.4,-155.4 Q5.6,-153.4 2.8,-155.4Z" fill="#fff"/>
    <circle cx="-5.6" cy="-155.5" r="1.45" fill="#2a1710"/><circle cx="5.6" cy="-155.5" r="1.45" fill="#2a1710"/><circle cx="-5.2" cy="-156" r=".45" fill="#fff"/><circle cx="6" cy="-156" r=".45" fill="#fff"/>
    <path d="M-8.8,-156 Q-5.6,-158.9 -2.6,-156 M2.6,-156 Q5.6,-158.9 8.8,-156" stroke="#140a08" stroke-width=".7" fill="none"/>
    <path d="M-9,-159.4 Q-5.8,-161.4 -2.8,-160 M2.8,-160 Q5.8,-161.4 9,-159.4" stroke="#241413" stroke-width=".8" fill="none" stroke-linecap="round"/>
    <path d="M0,-154 Q-1.6,-150.4 .2,-149.6 Q1,-149.5 1.6,-150.2" stroke="#c98d68" stroke-width=".7" fill="none"/>
    <path d="M-3.4,-146 Q-1.6,-147.8 0,-147 Q1.6,-147.8 3.4,-146 Q0,-143.4 -3.4,-146Z" fill="#c4363a"/><path d="M-3.4,-146 Q0,-146.8 3.4,-146" stroke="#8c1e24" stroke-width=".4" fill="none"/>
    <path d="M0,-212 L-44,-174 A44,9.5 0 0 0 44,-174 Z" fill="url(#ht${id})"/>${rings}${ribs}
    <path d="M-44,-174 A44,9.5 0 0 0 44,-174" stroke="#9b7630" stroke-width="1.3" fill="none"/><path d="M-30,-181 Q0,-168 30,-181" stroke="#fff6d2" stroke-width="1" fill="none" opacity=".5"/>
    <path d="M-14.5,-167 C-14,-156 -11,-147 -3.6,-141.6 M14.5,-167 C14,-156 11,-147 3.6,-141.6" stroke="#e8505a" stroke-width="1.3" fill="none" stroke-linecap="round"/>
    <path d="M-4,-141 C-8,-134 -9,-128 -7,-122 M4,-141 C8,-134 9,-128 7,-122" stroke="#e8505a" stroke-width="1.6" fill="none" stroke-linecap="round"/><ellipse cx="0" cy="-141" rx="2.6" ry="1.9" fill="#d13b48"/>`;
}
