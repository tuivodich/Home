import type { ThemeId } from "../lib/theme";

/**
 * Vẽ cảnh nhà gỗ nhỏ giữa rừng thông có sương bằng SVG (không cần ảnh ngoài).
 * Dùng chung cho mọi giao diện: mỗi giao diện chỉ khác bảng màu và vài chi tiết (tuyết, cây Noel, người tuyết).
 * Kết quả là chuỗi SVG/HTML do chương trình tự sinh (không chứa dữ liệu người dùng).
 */
export interface ScenePalette {
  sky: [number, string][]; sun: [number, number, string]; sunR: number; moon?: string; stars?: boolean;
  fog: string; fogA: number; ridge: [string, string, string, string]; ground: [string, string];
  cabinX: number; wall: string; wallLine: string; roof: string; roofEdge: string; door: string; win: string; smoke: string;
  snow?: boolean; xmas?: boolean; snowRoof?: boolean; snowTrees?: [number, number][]; snowman?: number;
}

export const PALETTES: Record<ThemeId, ScenePalette> = {
  night: { sky: [[0, "#04100d"], [.5, "#0b2a25"], [1, "#164a3f"]], sun: [1180, 150, "#cfe8d8"], sunR: 46, moon: "#e9f3e3", stars: true, fog: "#9fd0c1", fogA: .55,
    ridge: ["#0f3a31", "#0b2c25", "#08201b", "#051410"], ground: ["#06150f", "#030a07"], cabinX: 1100, wall: "#3a2a1a", wallLine: "#24180d", roof: "#14100c", roofEdge: "#2a2118", door: "#140e08", win: "#ffd47a", smoke: "#9fb7ad" },
  mist: { sky: [[0, "#cfe3e6"], [.45, "#f2ece3"], [1, "#ffe2c8"]], sun: [1000, 400, "#fff0cf"], sunR: 70, fog: "#ffffff", fogA: .8,
    ridge: ["#b9cfcb", "#8fb1a8", "#5f8d80", "#2f6455"], ground: ["#2a5a4a", "#1d4234"], cabinX: 820, wall: "#a8754a", wallLine: "#8a5d38", roof: "#5a3a28", roofEdge: "#7a5238", door: "#4a2f20", win: "#fff0c4", smoke: "#ffffff" },
  dusk: { sky: [[0, "#1b2f4f"], [.35, "#5a3f6b"], [.7, "#d98a93"], [1, "#ffcfa0"]], sun: [700, 560, "#ffd9a8"], sunR: 62, fog: "#f7b8c3", fogA: .6,
    ridge: ["#6d4a67", "#4a3350", "#2f2140", "#190f27"], ground: ["#1b0f26", "#0f0816"], cabinX: 800, wall: "#4a3020", wallLine: "#2d1c12", roof: "#1a1018", roofEdge: "#3a2430", door: "#170d12", win: "#ffd08a", smoke: "#f1c9d2" },
  noel: { sky: [[0, "#030f14"], [.5, "#0a2b36"], [1, "#17525e"]], sun: [1240, 150, "#e8f4ff"], sunR: 44, moon: "#f1f7ff", stars: true, fog: "#bfe3f2", fogA: .5,
    ridge: ["#1d5c47", "#164b3c", "#0f3b2f", "#092b22"], ground: ["#e3eef4", "#a3b9c6"], cabinX: 1090, wall: "#4b3322", wallLine: "#2e1f14", roof: "#1b1410", roofEdge: "#33261c", door: "#170f08", win: "#ffd27a", smoke: "#dfeaf2",
    snow: false, xmas: true, snowRoof: true, snowTrees: [[170, 400], [1000, 330], [1560, 240]], snowman: 1480 },
};

/** Bộ sinh số ngẫu nhiên có hạt giống: cùng một cảnh luôn giống nhau giữa các lần tải. */
export function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const R: [number, number][] = [[0, -1], [.30, -.66], [.16, -.66], [.42, -.38], [.24, -.38], [.52, -.10]];
const f = (v: number) => v.toFixed(1);

function snowCaps(x: number, y: number, h: number, w: number) {
  let o = `<polygon fill="#f3f8fc" opacity=".92" points="${f(x)},${f(y - h)} ${f(x + .11 * w)},${f(y - .87 * h)} ${f(x + .04 * w)},${f(y - .85 * h)} ${f(x)},${f(y - .88 * h)} ${f(x - .04 * w)},${f(y - .85 * h)} ${f(x - .11 * w)},${f(y - .87 * h)}"/>`;
  [[.30, -.66], [.42, -.38], [.52, -.10]].forEach(([a, b]) => {
    o += `<polygon fill="#eaf3f8" opacity=".85" points="${f(x + a * w)},${f(y + b * h)} ${f(x + (a - .13) * w)},${f(y + b * h)} ${f(x + (a - .07) * w)},${f(y + (b - .045) * h)}"/>`;
    o += `<polygon fill="#eaf3f8" opacity=".85" points="${f(x - a * w)},${f(y + b * h)} ${f(x - (a - .13) * w)},${f(y + b * h)} ${f(x - (a - .07) * w)},${f(y + (b - .045) * h)}"/>`;
  });
  return o;
}

let clipCounter = 0;
/** Cây thông phủ tuyết: tuyết đọng ở phần trên của từng tầng cành, cắt đúng theo hình cây (clipPath). */
function heavyPine(x: number, y: number, h: number, w: number) {
  const id = `sp${++clipCounter}`;
  const pts = [...R.map(([a, b]) => [x + a * w, y + b * h]), ...[...R].reverse().slice(0, 5).map(([a, b]) => [x - a * w, y + b * h])].map((q) => q.map(f).join(",")).join(" ");
  const bands = ([[-1, -.66], [-.66, -.38], [-.38, -.10]] as [number, number][]).map(([t0, t1]) => `<rect x="${f(x - w)}" y="${f(y + t0 * h)}" width="${f(2 * w)}" height="${f(.62 * (t1 - t0) * h)}"/>`).join("");
  return `<clipPath id="${id}"><polygon points="${pts}"/></clipPath><polygon points="${pts}"/><rect x="${f(x - w * .04)}" y="${f(y - h * .1)}" width="${f(w * .08)}" height="${f(h * .1 + 4)}"/><g clip-path="url(#${id})" fill="#f6fafd">${bands}</g>`;
}

function pinePoly(x: number, y: number, h: number, w: number, snow?: boolean | "heavy") {
  if (snow === "heavy") return heavyPine(x, y, h, w);
  const right = R.map(([a, b]) => `${f(x + a * w)},${f(y + b * h)}`);
  const left = [...R].reverse().slice(0, 5).map(([a, b]) => `${f(x - a * w)},${f(y + b * h)}`);
  return `<polygon points="${right.join(" ")} ${left.join(" ")}"/><rect x="${f(x - w * .04)}" y="${f(y - h * .1)}" width="${f(w * .08)}" height="${f(h * .1 + 4)}"/>${snow ? snowCaps(x, y, h, w) : ""}`;
}

function layer(seed: number, base: number, count: number, hMin: number, hMax: number, fill: string, skip?: [number, number], snow?: boolean, extras?: [number, number][]) {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < count; i++) {
    const x = -40 + (1680 / count) * i + (r() - .5) * (1680 / count) * 1.1;
    if (skip && x > skip[0] && x < skip[1]) continue;
    const h = hMin + r() * (hMax - hMin), w = h * (.34 + r() * .1);
    out += pinePoly(x, base + (r() - .5) * 14, h, w, snow);
  }
  (extras ?? []).forEach(([ex, eh]) => { out += pinePoly(ex, base, eh, eh * .4, "heavy"); });
  return `<g fill="${fill}">${out}<rect x="-20" y="${base - 6}" width="1660" height="${910 - base}"/></g>`;
}

function xmas(x: number, y: number, sc: number, id: string) {
  const cols = ["#ff5a5f", "#ffd15c", "#5bd68a", "#69c1ff"];
  const tiers: [[number, number], [number, number]][] = [[[0, -300], [55, -205]], [[0, -250], [88, -128]], [[0, -190], [118, -52]], [[0, -122], [142, 6]]];
  const fills = ["#1f7554", "#19614a", "#134f3d", "#0e3f31"];
  let o = `<defs><radialGradient id="sx${id}"><stop offset="0" stop-color="#fff2b0" stop-opacity=".95"/><stop offset="1" stop-color="#fff2b0" stop-opacity="0"/></radialGradient></defs>`;
  o += `<circle cx="0" cy="-312" r="74" fill="url(#sx${id})" class="lit"/><rect x="-9" y="0" width="18" height="30" fill="#4a2c18"/>`;
  tiers.forEach(([[tx, ty], [bx, by]], i) => {
    o += `<polygon points="${tx},${ty} ${bx},${by} ${-bx},${by}" fill="${fills[i]}"/>`;
    o += `<polygon points="${tx},${ty} ${bx * .22},${ty + (by - ty) * .22} ${-bx * .22},${ty + (by - ty) * .22}" fill="#f3f8fc" opacity=".9"/>`;
    for (let k = 0; k < 6; k++) {
      const t = k / 5;
      o += `<circle class="bulb" cx="${(-bx * .82 + t * bx * 1.64).toFixed(1)}" cy="${(by - 6 - Math.sin(t * Math.PI) * 14).toFixed(1)}" r="4.6" fill="${cols[(i + k) % 4]}" style="animation-delay:${(-((i * 6 + k) % 7) * .4).toFixed(1)}s"/>`;
    }
  });
  ([[-38, -150, "#d63a44"], [30, -100, "#f1c76a"], [-72, -52, "#f1c76a"], [64, -28, "#d63a44"], [0, -214, "#d63a44"], [-14, -88, "#69c1ff"], [92, -66, "#f1c76a"]] as [number, number, string][])
    .forEach(([bx, by, c]) => { o += `<circle cx="${bx}" cy="${by}" r="8.5" fill="${c}"/><circle cx="${bx - 2.6}" cy="${by - 3}" r="2.4" fill="#fff" opacity=".75"/>`; });
  o += `<polygon points="0,-336 7,-318 26,-318 11,-306 17,-288 0,-299 -17,-288 -11,-306 -26,-318 -7,-318" fill="#ffd75e"/>`;
  o += `<rect x="-128" y="-24" width="40" height="30" fill="#d63a44"/><rect x="-110" y="-24" width="6" height="30" fill="#ffe7a8"/><rect x="-128" y="-12" width="40" height="5" fill="#ffe7a8"/>`;
  o += `<rect x="96" y="-18" width="34" height="24" fill="#2f6fb3"/><rect x="110" y="-18" width="6" height="24" fill="#ffe7a8"/>`;
  return `<g transform="translate(${x} ${y}) scale(${sc})">${o}</g>`;
}

function snowman(x: number, y: number, sc: number) {
  return `<g transform="translate(${x} ${y}) scale(${sc})">
    <ellipse cx="0" cy="4" rx="64" ry="9" fill="#9fb6c4" opacity=".55"/>
    <circle cx="0" cy="-42" r="46" fill="#f6fafd"/><circle cx="14" cy="-30" r="34" fill="#dbe8f0" opacity=".55"/>
    <circle cx="0" cy="-100" r="34" fill="#f8fbfe"/><circle cx="12" cy="-92" r="24" fill="#dbe8f0" opacity=".5"/>
    <circle cx="0" cy="-152" r="26" fill="#fbfdff"/>
    <rect x="-23" y="-206" width="46" height="34" rx="4" fill="#1c2430"/><rect x="-34" y="-176" width="68" height="9" rx="4" fill="#1c2430"/><rect x="-23" y="-186" width="46" height="7" fill="#d63a44"/>
    <circle cx="-9" cy="-158" r="3.4" fill="#10161d"/><circle cx="9" cy="-158" r="3.4" fill="#10161d"/>
    <polygon points="0,-151 26,-146 0,-141" fill="#f08a2e"/>
    <g fill="#10161d"><circle cx="-7" cy="-143" r="1.7"/><circle cx="-3" cy="-140" r="1.7"/><circle cx="3" cy="-140" r="1.7"/><circle cx="7" cy="-143" r="1.7"/></g>
    <path d="M-26 -128 Q0 -112 26 -128 L26 -118 Q0 -102 -26 -118Z" fill="#d63a44"/><path d="M12 -116 L24 -84 L12 -84 L4 -108Z" fill="#c1303a"/>
    <circle cx="0" cy="-88" r="4.2" fill="#10161d"/><circle cx="0" cy="-66" r="4.2" fill="#10161d"/><circle cx="0" cy="-44" r="4.2" fill="#10161d"/>
    <g stroke="#6b4a2b" stroke-width="5" stroke-linecap="round" fill="none"><path d="M-32 -100 L-84 -128 M-66 -118 L-72 -140 M-66 -118 L-86 -112"/><path d="M32 -100 L84 -122 M68 -116 L76 -138 M68 -116 L88 -110"/></g>
  </g>`;
}

export interface SceneOptions { id: string; cabinX?: number; cabinScale?: number; withTree?: boolean; withSnowman?: boolean }

/** Chuỗi SVG của cả cảnh (bầu trời, 4 lớp rừng thông, sương, nhà gỗ, và chi tiết riêng của giao diện). */
export function sceneSvg(p: ScenePalette, o: SceneOptions): string {
  const id = o.id, cx = o.cabinX ?? p.cabinX, gy = 800, scale = o.cabinScale ?? 1;
  const tree = o.withTree !== false && p.xmas, man = o.withSnowman !== false && p.snowman;
  const fog = (y: number, h: number, op: number) => `<rect x="0" y="${y}" width="1600" height="${h}" fill="url(#fg${id})" opacity="${op}"/>`;
  const stars = p.stars ? Array.from({ length: 70 }, (_, i) => { const r = rng(i + 7); return `<circle cx="${(r() * 1600).toFixed(0)}" cy="${(r() * 300).toFixed(0)}" r="${(r() * 1.4 + .3).toFixed(1)}" fill="#fff" opacity="${(r() * .6 + .2).toFixed(2)}"/>`; }).join("") : "";
  const st = p.snowTrees;
  return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" role="img" aria-label="Nhà gỗ nhỏ giữa rừng thông có sương">
    <defs>
      <linearGradient id="sk${id}" x1="0" y1="0" x2="0" y2="1">${p.sky.map(([off, c]) => `<stop offset="${off}" stop-color="${c}"/>`).join("")}</linearGradient>
      <radialGradient id="sg${id}"><stop offset="0" stop-color="${p.sun[2]}" stop-opacity=".95"/><stop offset=".35" stop-color="${p.sun[2]}" stop-opacity=".35"/><stop offset="1" stop-color="${p.sun[2]}" stop-opacity="0"/></radialGradient>
      <linearGradient id="fg${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.fog}" stop-opacity="0"/><stop offset=".5" stop-color="${p.fog}" stop-opacity="${p.fogA}"/><stop offset="1" stop-color="${p.fog}" stop-opacity="0"/></linearGradient>
      <radialGradient id="wg${id}"><stop offset="0" stop-color="${p.win}" stop-opacity=".85"/><stop offset="1" stop-color="${p.win}" stop-opacity="0"/></radialGradient>
      <linearGradient id="gr${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.ground[0]}"/><stop offset="1" stop-color="${p.ground[1]}"/></linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#sk${id})"/>${stars}
    <circle cx="${p.sun[0]}" cy="${p.sun[1]}" r="${p.sunR * 4}" fill="url(#sg${id})"/>
    <circle cx="${p.sun[0]}" cy="${p.sun[1]}" r="${p.sunR}" fill="${p.moon ?? p.sun[2]}" opacity="${p.moon ? 1 : .9}"/>
    ${layer(11, 520, 36, 110, 190, p.ridge[0], undefined, p.snow)}${fog(380, 220, 1)}
    ${layer(23, 610, 30, 170, 270, p.ridge[1], undefined, p.snow, st && [st[2]])}${fog(480, 230, .9)}
    ${layer(37, 700, 24, 240, 350, p.ridge[2], undefined, p.snow, st && [st[1]])}${fog(570, 220, .85)}
    ${layer(53, 790, 20, 330, 520, p.ridge[3], [cx - 250, cx + 250], p.snow, st && [st[0]])}
    <rect x="0" y="${gy - 4}" width="1600" height="110" fill="url(#gr${id})"/>
    <ellipse cx="${cx}" cy="${gy + 6}" rx="230" ry="26" fill="${p.win}" opacity=".16" class="lit"/>
    ${tree ? xmas(cx - 330, gy, 1.5, id) : ""}
    <g transform="translate(${cx} ${gy}) scale(${scale})">
      <circle cx="-48" cy="-44" r="70" fill="url(#wg${id})" class="lit"/><circle cx="46" cy="-44" r="70" fill="url(#wg${id})" class="lit"/>
      <rect x="-82" y="-86" width="164" height="86" fill="${p.wall}"/>
      <g stroke="${p.wallLine}" stroke-width="2" opacity=".8">${[-64, -44, -24, -6].map((y) => `<line x1="-82" y1="${y}" x2="82" y2="${y}"/>`).join("")}</g>
      <rect x="38" y="-170" width="20" height="60" fill="${p.roof}"/>
      <polygon points="-108,-84 0,-158 108,-84" fill="${p.roof}"/><polyline points="-108,-84 0,-158 108,-84" fill="none" stroke="${p.roofEdge}" stroke-width="4" stroke-linejoin="round"/>
      ${p.snowRoof ? '<polygon points="-104,-86 0,-155 104,-86 92,-82 0,-139 -92,-82" fill="#f3f8fc"/>' : ""}
      <rect x="-14" y="-52" width="28" height="52" rx="2" fill="${p.door}"/>
      <rect x="-70" y="-64" width="36" height="32" rx="2" fill="${p.win}" class="lit"/><rect x="34" y="-64" width="36" height="32" rx="2" fill="${p.win}" class="lit"/>
      <g stroke="${p.door}" stroke-width="2"><line x1="-52" y1="-64" x2="-52" y2="-32"/><line x1="52" y1="-64" x2="52" y2="-32"/></g>
      <circle class="smoke" cx="48" cy="-178" r="12" fill="${p.smoke}"/><circle class="smoke" style="animation-delay:-2.4s" cx="52" cy="-178" r="10" fill="${p.smoke}"/><circle class="smoke" style="animation-delay:-4.8s" cx="46" cy="-178" r="13" fill="${p.smoke}"/>
    </g>
    ${man ? snowman(man, gy + 2, 1.2) : ""}
    ${fog(720, 150, .8)}
  </svg>`;
}
