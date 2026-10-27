/** Tranh minh họa nhà gỗ giữa vườn (SVG thuần, không cần ảnh ngoài). */
export default function HeroArt() {
  const tree = (x: number, y: number, r: number, c: string) => (
    <g key={`${x}-${y}`}>
      <rect x={x - 4} y={y} width="8" height={r * 0.9} rx="3" fill="#6b4423" />
      <circle cx={x} cy={y} r={r} fill={c} />
      <circle cx={x - r * 0.35} cy={y - r * 0.1} r="4" fill="#ff9f43" />
      <circle cx={x + r * 0.4} cy={y + r * 0.2} r="4" fill="#ff9f43" />
      <circle cx={x + r * 0.05} cy={y - r * 0.5} r="4" fill="#ff7a59" />
    </g>
  );
  return (
    <svg viewBox="0 0 800 560" className="heroart" role="img" aria-label="Nhà gỗ giữa vườn trái cây" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffcf8a" /><stop offset=".6" stopColor="#ffe7c2" /><stop offset="1" stopColor="#fff4de" />
        </linearGradient>
        <radialGradient id="sun" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#fff2b8" /><stop offset="1" stopColor="#ffb347" />
        </radialGradient>
      </defs>
      <rect width="800" height="560" fill="url(#sky)" />
      <circle cx="610" cy="130" r="120" fill="#ffd27a" opacity=".35" />
      <circle cx="610" cy="130" r="58" fill="url(#sun)" />
      <g fill="#fff" opacity=".8">
        <ellipse cx="170" cy="110" rx="60" ry="16" /><ellipse cx="210" cy="98" rx="40" ry="14" />
        <ellipse cx="430" cy="70" rx="46" ry="12" /><ellipse cx="462" cy="62" rx="30" ry="10" />
      </g>
      <path d="M0 360 Q140 270 300 350 T620 330 T800 350 V560 H0Z" fill="#9fc99a" />
      <path d="M0 410 Q220 330 420 400 T800 380 V560 H0Z" fill="#6fae7a" />
      {/* nhà sàn gỗ */}
      <g transform="translate(250 250)">
        <rect x="14" y="150" width="10" height="46" fill="#5a3a1c" /><rect x="126" y="150" width="10" height="46" fill="#5a3a1c" />
        <rect x="205" y="150" width="10" height="46" fill="#5a3a1c" /><rect x="-22" y="150" width="10" height="46" fill="#5a3a1c" />
        <rect x="-30" y="140" width="260" height="14" rx="3" fill="#7a4e24" />
        <rect x="-14" y="64" width="228" height="78" fill="#b87a3d" />
        <g stroke="#9c6228" strokeWidth="2">
          {Array.from({ length: 11 }, (_, i) => <line key={i} x1={-14 + i * 21} y1="64" x2={-14 + i * 21} y2="142" />)}
        </g>
        <path d="M-44 70 L100 -10 L244 70 Z" fill="#7b3f1d" />
        <path d="M-44 70 L100 -10 L244 70" fill="none" stroke="#5e2d12" strokeWidth="5" strokeLinejoin="round" />
        <rect x="10" y="84" width="44" height="40" rx="3" fill="#ffe08a" /><line x1="32" y1="84" x2="32" y2="124" stroke="#9c6228" strokeWidth="3" />
        <rect x="146" y="84" width="44" height="40" rx="3" fill="#ffe08a" /><line x1="168" y1="84" x2="168" y2="124" stroke="#9c6228" strokeWidth="3" />
        <rect x="78" y="82" width="44" height="60" rx="4" fill="#5e2d12" /><circle cx="114" cy="114" r="2.5" fill="#ffd27a" />
        <path d="M70 154 L130 154 L146 196 L54 196 Z" fill="#c89256" opacity=".0" />
        <g stroke="#7a4e24" strokeWidth="4"><line x1="86" y1="154" x2="80" y2="196" /><line x1="114" y1="154" x2="120" y2="196" /></g>
      </g>
      <path d="M0 470 Q200 430 420 470 T800 455 V560 H0Z" fill="#2f6b4a" />
      {tree(90, 380, 52, "#3f8f5a")}
      {tree(690, 372, 58, "#3a8453")}
      {tree(580, 430, 40, "#4a9a63")}
      {tree(170, 440, 36, "#4a9a63")}
      <g fill="#245a3c">
        {Array.from({ length: 16 }, (_, i) => <ellipse key={i} cx={20 + i * 52} cy="520" rx="34" ry="14" />)}
      </g>
    </svg>
  );
}
