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
  lift?: number; halloween?: boolean; tet?: boolean; snow?: boolean; xmas?: boolean; snowRoof?: boolean; snowTrees?: [number, number][]; snowman?: number;
}

export const PALETTES: Record<ThemeId, ScenePalette> = {
  night: { sky: [[0, "#04100d"], [.5, "#0b2a25"], [1, "#164a3f"]], sun: [1180, 150, "#cfe8d8"], sunR: 46, moon: "#e9f3e3", stars: true, fog: "#9fd0c1", fogA: .55,
    ridge: ["#0f3a31", "#0b2c25", "#08201b", "#051410"], ground: ["#06150f", "#030a07"], cabinX: 1100, wall: "#3a2a1a", wallLine: "#24180d", roof: "#14100c", roofEdge: "#2a2118", door: "#140e08", win: "#ffd47a", smoke: "#9fb7ad" },
  mist: { sky: [[0, "#cfe3e6"], [.45, "#f2ece3"], [1, "#ffe2c8"]], sun: [1300, 330, "#fff0cf"], sunR: 70, fog: "#ffffff", fogA: .8,
    ridge: ["#b9cfcb", "#8fb1a8", "#5f8d80", "#2f6455"], ground: ["#2a5a4a", "#1d4234"], cabinX: 1100, wall: "#a8754a", wallLine: "#8a5d38", roof: "#5a3a28", roofEdge: "#7a5238", door: "#4a2f20", win: "#fff0c4", smoke: "#ffffff" },
  dusk: { sky: [[0, "#1b2f4f"], [.35, "#5a3f6b"], [.7, "#d98a93"], [1, "#ffcfa0"]], sun: [1280, 560, "#ffd9a8"], sunR: 62, fog: "#f7b8c3", fogA: .6,
    ridge: ["#6d4a67", "#4a3350", "#2f2140", "#190f27"], ground: ["#1b0f26", "#0f0816"], cabinX: 1100, wall: "#4a3020", wallLine: "#2d1c12", roof: "#1a1018", roofEdge: "#3a2430", door: "#170d12", win: "#ffd08a", smoke: "#f1c9d2" },
  noel: { sky: [[0, "#030f14"], [.5, "#0a2b36"], [1, "#17525e"]], sun: [1240, 150, "#e8f4ff"], sunR: 44, moon: "#f1f7ff", stars: true, fog: "#bfe3f2", fogA: .5,
    ridge: ["#1d5c47", "#164b3c", "#0f3b2f", "#092b22"], ground: ["#e3eef4", "#a3b9c6"], cabinX: 1090, wall: "#4b3322", wallLine: "#2e1f14", roof: "#1b1410", roofEdge: "#33261c", door: "#170f08", win: "#ffd27a", smoke: "#dfeaf2",
    snow: false, xmas: true, snowRoof: true, snowTrees: [[170, 400], [1000, 330], [1560, 240]], snowman: 1480 },
  halloween: { sky: [[0, "#080212"], [.45, "#27103a"], [.8, "#5a1f2e"], [1, "#a04a1e"]], sun: [1160, 230, "#ffb347"], sunR: 96, moon: "#ffb04a", stars: true, fog: "#b46bd6", fogA: .38,
    ridge: ["#2d1445", "#1f0c32", "#14061f", "#0a0212"], ground: ["#10081a", "#05020a"], cabinX: 1090, wall: "#34223f", wallLine: "#1d1226", roof: "#0b0613", roofEdge: "#2b1b38", door: "#0d0710", win: "#ff9a2e", smoke: "#bda3d0", halloween: true, lift: 78 },
  tet: { sky: [[0, "#4a0b14"], [.4, "#a3222c"], [.78, "#ff9d4d"], [1, "#ffd98a"]], sun: [1250, 470, "#fff1b8"], sunR: 78, fog: "#ffd9a0", fogA: .45,
    ridge: ["#4f8f55", "#3a7a45", "#2a6236", "#1b4a28"], ground: ["#3c7a35", "#1a3f1c"], cabinX: 1090, wall: "#8a5a34", wallLine: "#5f3c1f", roof: "#7a2a22", roofEdge: "#a8402f", door: "#6e1212", win: "#ffe08a", smoke: "#fff3dc", tet: true, lift: 78 },
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


const px = (n: number) => n.toFixed(1);

/** Bí ngô có mặt cười phát sáng (Halloween). (x, y) là điểm chạm đất, s là tỉ lệ. */
function pumpkin(x: number, y: number, s: number, id: string) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <circle cx="0" cy="-34" r="78" fill="url(#pg${id})" class="lit"/>
    <ellipse cx="0" cy="3" rx="52" ry="7" fill="#000" opacity=".35"/>
    <ellipse cx="0" cy="-32" rx="48" ry="36" fill="#d8641a"/><ellipse cx="-26" cy="-32" rx="26" ry="35" fill="#ee8328"/><ellipse cx="26" cy="-32" rx="26" ry="35" fill="#ee8328"/><ellipse cx="0" cy="-32" rx="21" ry="36" fill="#ff9a3a"/>
    <path d="M-1 -66 Q-6 -32 -1 2 M-27 -62 Q-38 -32 -25 -2 M27 -62 Q38 -32 25 -2" stroke="#9a420c" stroke-width="2" fill="none" opacity=".7"/>
    <path d="M-4 -68 L-3 -80 Q4 -86 9 -78" stroke="#5b4a1f" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M6 -74 q18 -10 26 4 q-14 6 -26 -4z" fill="#4c7d2b"/>
    <g fill="#ffe08a" class="lit"><polygon points="-26,-46 -9,-46 -17.5,-62"/><polygon points="9,-46 26,-46 17.5,-62"/><polygon points="0,-38 -6,-28 6,-28"/>
    <polygon points="-30,-22 -19,-10 -10,-18 0,-8 10,-18 19,-10 30,-22 26,-4 13,0 0,2 -13,0 -26,-4"/></g>
  </g>`;
}

function bat(x: number, y: number, s: number) {
  return `<g transform="translate(${px(x)} ${px(y)}) scale(${s})" fill="#05020b"><path d="M0 0 C-6 -9 -19 -15 -34 -10 C-27 -4 -25 2 -19 7 C-15 3 -9 3 -5 9 C-3 4 3 4 5 9 C9 3 15 3 19 7 C25 2 27 -4 34 -10 C19 -15 6 -9 0 0Z"/><path d="M-4 -3 L-3 -11 L0 -6 L3 -11 L4 -3Z"/></g>`;
}

/** Cây khô (nét vẽ dày dần về gốc), gốc ở (0, 0). */
function bareTree() {
  const br: [string, number][] = [
    ["M0 0 C-7 -70 7 -130 -4 -215", 22], ["M-4 -215 C-40 -255 -75 -272 -122 -270", 10], ["M-3 -178 C34 -220 78 -236 124 -258", 10], ["M-2 -135 C-30 -158 -64 -154 -98 -182", 7],
    ["M2 -105 C32 -128 66 -128 96 -116", 6], ["M-60 -255 C-70 -285 -64 -300 -50 -318", 5], ["M80 -234 C92 -262 90 -282 104 -300", 5], ["M-100 -266 C-120 -280 -140 -278 -156 -290", 4],
    ["M-4 -215 C-2 -250 6 -280 -2 -310", 7],
  ];
  return `<g fill="none" stroke="#06020c" stroke-linecap="round">${br.map(([d, w]) => `<path d="${d}" stroke-width="${w}"/>`).join("")}</g>`;
}

function ghost(x: number, y: number, s: number) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><g class="ghost"><path d="M-24 0 V-42 A24 28 0 0 1 24 -42 V0 L16 -9 L8 0 L0 -9 L-8 0 L-16 -9Z" fill="#f4f1ff" opacity=".88"/><ellipse cx="-8" cy="-44" rx="3.6" ry="5.4" fill="#1a1030"/><ellipse cx="8" cy="-44" rx="3.6" ry="5.4" fill="#1a1030"/><ellipse cx="0" cy="-30" rx="4" ry="5" fill="#1a1030"/></g></g>`;
}

/** Chi tiết riêng của giao diện Halloween: dơi bay qua trăng, cây khô, bóng ma, bí ngô thắp nến. */
function halloweenBack(p: ScenePalette, cx: number, gy: number, sc: number) {
  const [mx, my] = p.sun;
  return `${bat(mx - 150, my - 70, 1.15)}${bat(mx + 40, my - 120, .8)}${bat(mx + 150, my - 30, 1.0)}${bat(mx - 260, my + 30, .7)}
    <g transform="translate(${cx - 310 * sc} ${gy + 4}) scale(${1.15 * sc})">${bareTree()}</g>
    ${ghost(cx - 230 * sc, gy - 150 * sc, 1.2 * sc)}`;
}
function halloweenFront(cx: number, gy: number, sc: number, id: string) {
  return `${pumpkin(cx + 150 * sc, gy + 12, 1.05 * sc, id)}${pumpkin(cx + 215 * sc, gy + 22, .72 * sc, id)}${pumpkin(cx - 140 * sc, gy + 20, .88 * sc, id)}${pumpkin(cx + 18 * sc, gy + 36, .55 * sc, id)}`;
}

/** Hoa mai năm cánh vàng. */
function mai(x: number, y: number, r: number) {
  let o = "";
  for (let i = 0; i < 5; i++) { const a = (i * 72 - 90) * Math.PI / 180; o += `<circle cx="${px(x + Math.cos(a) * r * .55)}" cy="${px(y + Math.sin(a) * r * .55)}" r="${px(r * .5)}" fill="#ffd23f"/>`; }
  return `${o}<circle cx="${px(x)}" cy="${px(y)}" r="${px(r * .26)}" fill="#e0901a"/>`;
}

/** Cây mai nở vàng, gốc ở (0, 0). */
function maiTree() {
  const br: [string, number][] = [["M0 0 C12 -55 -16 -105 6 -165", 15], ["M6 -165 C44 -195 76 -205 112 -238", 8], ["M2 -130 C-26 -160 -62 -168 -98 -202", 7], ["M4 -95 C34 -118 70 -116 102 -138", 6], ["M8 -165 C4 -205 14 -240 4 -280", 6], ["M-58 -176 C-70 -204 -64 -230 -80 -254", 4], ["M76 -204 C90 -232 86 -256 104 -276", 4]];
  const r = rng(77);
  const fl: [number, number][] = [[112, -238], [4, -280], [-98, -202], [102, -138], [-80, -254], [104, -276], [6, -165], [60, -215], [-30, -240], [40, -265], [-60, -190], [78, -160], [20, -215], [-12, -260], [92, -250], [-86, -226], [52, -128], [-40, -150], [30, -190], [-10, -200]];
  const flowers = fl.map(([a, b]) => mai(a + (r() - .5) * 14, b + (r() - .5) * 14, 11 + r() * 5)).join("");
  const buds = Array.from({ length: 16 }, () => { const [a, b] = fl[Math.floor(r() * fl.length)]; return `<circle cx="${px(a + (r() - .5) * 46)}" cy="${px(b + (r() - .5) * 46)}" r="${px(3 + r() * 2)}" fill="#f0a020"/>`; }).join("");
  return `<g fill="none" stroke="#4a2c18" stroke-linecap="round">${br.map(([d, w]) => `<path d="${d}" stroke-width="${w}"/>`).join("")}</g>${buds}${flowers}`;
}

/** Cây nêu ngày Tết: thân tre, chùm lá, cờ đỏ vàng, khánh đất nung, vôi bột rắc quanh gốc. Gốc ở (0, 0). */
function treeNeu() {
  const nodes = Array.from({ length: 9 }, (_, i) => `<rect x="-5" y="${-i * 48 - 6}" width="10" height="5" rx="2" fill="#5a3e1c"/>`).join("");
  const leaves = [[-34, -22], [-52, -6], [-18, -34], [34, -22], [52, -6], [18, -34], [0, -40]].map(([dx, dy]) => `<path d="M0 -430 Q${dx * .6} ${-430 + dy - 10} ${dx} ${-430 + dy + 24}" stroke="#2f8f3a" stroke-width="5" stroke-linecap="round" fill="none"/>`).join("");
  return `<ellipse cx="0" cy="3" rx="46" ry="9" fill="#f5f1e4" opacity=".85"/><g stroke="#f5f1e4" stroke-width="3" opacity=".9"><line x1="-30" y1="-2" x2="-18" y2="6"/><line x1="30" y1="-2" x2="18" y2="6"/><line x1="0" y1="4" x2="0" y2="10"/></g>
    <line x1="0" y1="0" x2="0" y2="-430" stroke="#8a6a2f" stroke-width="8" stroke-linecap="round"/>${nodes}${leaves}
    <polygon points="4,-412 70,-396 4,-380" fill="#d62d2d" stroke="#f1c34b" stroke-width="2"/><circle cx="26" cy="-396" r="5" fill="#f1c34b"/>
    <line x1="0" y1="-372" x2="0" y2="-320" stroke="#8a6a2f" stroke-width="2"/><g class="bulb"><path d="M-9 -318 L0 -334 L9 -318 L0 -302Z" fill="#e8a317" stroke="#a96a0c" stroke-width="1.5"/></g>
    <line x1="-16" y1="-352" x2="-16" y2="-326" stroke="#8a6a2f" stroke-width="2"/><g class="bulb" style="animation-delay:-.9s"><ellipse cx="-16" cy="-318" rx="7" ry="10" fill="#c0702a"/></g>
    <line x1="16" y1="-352" x2="16" y2="-336" stroke="#8a6a2f" stroke-width="2"/><g class="bulb" style="animation-delay:-1.6s"><ellipse cx="16" cy="-328" rx="7" ry="10" fill="#c0702a"/></g>`;
}

/** Bánh chưng xanh buộc lạt: (x, y) là tâm đáy. */
function banhChung(x: number, y: number, s: number, rot: number) {
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
    <rect x="-30" y="-60" width="60" height="60" rx="5" fill="#2f8a4f"/><rect x="-30" y="-60" width="60" height="60" rx="5" fill="none" stroke="#1d6b3a" stroke-width="2.5"/>
    <g stroke="#1f6b3a" stroke-width="1.4" opacity=".75"><line x1="-30" y1="-45" x2="30" y2="-39"/><line x1="-30" y1="-30" x2="30" y2="-31"/><line x1="-30" y1="-15" x2="30" y2="-20"/></g>
    <g stroke="#e8d68a" stroke-width="3.2"><line x1="-10" y1="-60" x2="-10" y2="0"/><line x1="10" y1="-60" x2="10" y2="0"/><line x1="-30" y1="-40" x2="30" y2="-40"/><line x1="-30" y1="-20" x2="30" y2="-20"/></g>
    <path d="M0 -60 Q-6 -70 -2 -74 M0 -60 Q6 -70 2 -74" stroke="#e8d68a" stroke-width="2.5" fill="none"/>
  </g>`;
}

/** Cô gái mặc áo dài đỏ, đội nón lá, cầm cành mai. Chân ở (0, 0). */
function aoDai(x: number, y: number, s: number) {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="3" rx="30" ry="6" fill="#000" opacity=".28"/>
    <path d="M-8 -64 V-4 H-2 V-64Z M2 -64 V-4 H8 V-64Z" fill="#fbf6ea"/><ellipse cx="-5" cy="-2" rx="7" ry="3" fill="#2a1a12"/><ellipse cx="5" cy="-2" rx="7" ry="3" fill="#2a1a12"/>
    <path d="M-15 -112 Q0 -119 15 -112 L18 -72 Q20 -44 31 -12 L3 -20 L0 -58 L-3 -20 L-31 -12 Q-20 -44 -18 -72 Z" fill="#d62d2d" stroke="#f1c34b" stroke-width="2"/>
    <path d="M-17 -80 Q0 -72 17 -80" stroke="#f1c34b" stroke-width="2" fill="none"/><path d="M-3 -20 L0 -58 L3 -20" stroke="#f1c34b" stroke-width="1.6" fill="none"/>
    <rect x="-4" y="-117" width="8" height="8" rx="2" fill="#f3cfa6"/><path d="M-9 -113 Q0 -108 9 -113" stroke="#f1c34b" stroke-width="3" fill="none"/>
    <path d="M-15 -108 Q-30 -92 -34 -74" stroke="#f3cfa6" stroke-width="7" stroke-linecap="round" fill="none"/><path d="M15 -108 Q29 -94 30 -76" stroke="#f3cfa6" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M-34 -74 L-44 -126" stroke="#4a2c18" stroke-width="3" stroke-linecap="round"/>${mai(-44, -130, 7)}${mai(-52, -114, 6)}${mai(-38, -108, 5.5)}
    <circle cx="0" cy="-130" r="14" fill="#f3cfa6"/><path d="M-14 -131 Q-14 -146 0 -146 Q14 -146 14 -131 Q10 -138 0 -138 Q-10 -138 -14 -131Z" fill="#1a1010"/><path d="M12 -130 Q18 -110 10 -96" stroke="#1a1010" stroke-width="5" stroke-linecap="round" fill="none"/>
    <circle cx="-5" cy="-129" r="1.5" fill="#2a1a12"/><circle cx="5" cy="-129" r="1.5" fill="#2a1a12"/><path d="M-3 -123 Q0 -120 3 -123" stroke="#c0452f" stroke-width="1.6" fill="none"/>
    <polygon points="-40,-139 0,-176 40,-139" fill="#efd89a" stroke="#c9a85a" stroke-width="1.5"/><path d="M-26 -148 L0 -140 L26 -148 M-14 -163 L0 -150 L14 -163" stroke="#c9a85a" stroke-width="1" fill="none" opacity=".8"/><path d="M-14 -137 Q0 -128 14 -137" stroke="#d62d2d" stroke-width="2.5" fill="none"/>
  </g>`;
}

/** Dây pháo đỏ treo từ mái nhà xuống; tàn lửa nhấp nháy ở đầu dưới. */
function pao(x: number, y: number, n: number) {
  let o = `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 8}" stroke="#7a5a2c" stroke-width="2"/>`;
  for (let i = 0; i < n; i++) {
    const cy = y + 8 + i * 19, dx = i % 2 ? 4 : -4;
    o += `<g transform="translate(${x + dx} ${cy})"><rect x="-5" y="0" width="10" height="17" rx="2" fill="#d62d2d"/><rect x="-5" y="2" width="10" height="2.5" fill="#f1c34b"/><rect x="-5" y="12.5" width="10" height="2.5" fill="#f1c34b"/><line x1="0" y1="-3" x2="0" y2="0" stroke="#7a5a2c" stroke-width="1.5"/></g>`;
  }
  const by = y + 8 + n * 19 + 4;
  return `${o}<g class="bulb"><polygon points="${x},${by - 4} ${x + 4},${by + 2} ${x + 11},${by + 2} ${x + 5},${by + 7} ${x + 7},${by + 14} ${x},${by + 9} ${x - 7},${by + 14} ${x - 5},${by + 7} ${x - 11},${by + 2} ${x - 4},${by + 2}" fill="#ffd23f"/></g>`;
}

function tetBack(cx: number, gy: number, sc: number) {
  return `<g transform="translate(${cx - 330 * sc} ${gy + 4}) scale(${1.1 * sc})">${maiTree()}</g>
    <g transform="translate(${cx + 330 * sc} ${gy + 6}) scale(${1.05 * sc})">${treeNeu()}</g>`;
}
function tetFront(cx: number, gy: number, sc: number) {
  return `<g transform="translate(${cx} ${gy}) scale(${sc})">${pao(-100, -84, 5)}${pao(100, -84, 5)}</g>
    <rect x="${px(cx + 108 * sc)}" y="${px(gy + 6 * sc)}" width="${px(88 * sc)}" height="${px(10 * sc)}" rx="${px(3 * sc)}" fill="#b3202a"/><rect x="${px(cx + 108 * sc)}" y="${px(gy + 6 * sc)}" width="${px(88 * sc)}" height="${px(3 * sc)}" fill="#f1c34b"/>
    ${banhChung(cx + 134 * sc, gy + 6 * sc, .8 * sc, -3)}${banhChung(cx + 176 * sc, gy + 6 * sc, .7 * sc, 4)}${banhChung(cx + 155 * sc, gy - 46 * sc, .6 * sc, 0)}
    ${aoDai(cx - 140 * sc, gy + 22 * sc, .95 * sc)}`;
}

export interface SceneOptions { id: string; /** Nâng cả mặt đất lên (đơn vị tranh) để nhà và đồ trang trí không bị khung đặt phòng che; chỉ dùng cho màn hình rộng. */ lift?: number; cabinX?: number; cabinScale?: number; withTree?: boolean; withSnowman?: boolean }

/** Chuỗi SVG của cả cảnh (bầu trời, 4 lớp rừng thông, sương, nhà gỗ, và chi tiết riêng của giao diện). */
export function sceneSvg(p: ScenePalette, o: SceneOptions): string {
  const id = o.id, cx = o.cabinX ?? p.cabinX, gy = 800 - (o.lift ?? 0), scale = o.cabinScale ?? 1;
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
      <radialGradient id="pg${id}"><stop offset="0" stop-color="#ff9a2e" stop-opacity=".55"/><stop offset="1" stop-color="#ff9a2e" stop-opacity="0"/></radialGradient>
      <linearGradient id="gr${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.ground[0]}"/><stop offset="1" stop-color="${p.ground[1]}"/></linearGradient>
    </defs>
    <rect width="1600" height="900" fill="url(#sk${id})"/>${stars}
    <circle cx="${p.sun[0]}" cy="${p.sun[1]}" r="${p.sunR * 4}" fill="url(#sg${id})"/>
    <circle cx="${p.sun[0]}" cy="${p.sun[1]}" r="${p.sunR}" fill="${p.moon ?? p.sun[2]}" opacity="${p.moon ? 1 : .9}"/>
    ${layer(11, 520, 36, 110, 190, p.ridge[0], undefined, p.snow)}${fog(380, 220, 1)}
    ${layer(23, 610, 30, 170, 270, p.ridge[1], undefined, p.snow, st && [st[2]])}${fog(480, 230, .9)}
    ${layer(37, 700, 24, 240, 350, p.ridge[2], undefined, p.snow, st && [st[1]])}${fog(570, 220, .85)}
    ${layer(53, 790, 20, 330, 520, p.ridge[3], [cx - 250, cx + 250], p.snow, st && [st[0]])}
    <rect x="0" y="${gy - 4}" width="1600" height="${914 - gy}" fill="url(#gr${id})"/>
    <ellipse cx="${cx}" cy="${gy + 6}" rx="230" ry="26" fill="${p.win}" opacity=".16" class="lit"/>
    ${tree ? xmas(cx + 235, gy, 1.5, id) : ""}
    ${p.halloween ? halloweenBack(p, cx, gy, scale) : ""}${p.tet ? tetBack(cx, gy, scale) : ""}
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
    ${p.halloween ? halloweenFront(cx, gy, scale, id) : ""}${p.tet ? tetFront(cx, gy, scale) : ""}
    ${fog(720, 150, .8)}
  </svg>`;
}
