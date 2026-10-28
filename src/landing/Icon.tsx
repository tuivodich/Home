/** Bộ biểu tượng nét mảnh dùng trên trang giới thiệu (thay emoji để giao diện đồng nhất). */
const PATHS = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  bed: "M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 15h18M7 9V6h4v3",
  shower: "M6 20v-8a5 5 0 0 1 10 0M4 12h14M8 15v.01M12 15v.01M10 18v.01M14 18v.01",
  pot: "M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3zM3 10h18M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2",
  tree: "M12 21v-8M12 13c-4 0-7-3-7-8 5 0 7 3 7 8zm0 0c4 0 7-3 7-8-5 0-7 3-7 8z",
  water: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z",
  car: "M5 16v-4l2-5h10l2 5v4M5 16h14M5 16v2M19 16v2M8 13h.01M16 13h.01",
  wifi: "M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0M12 19h.01",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  mail: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM3 7l9 6 9-6",
  pin: "M12 21s7-6.2 7-11a7 7 0 0 0-14 0c0 4.8 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12zM8.5 12h.01M12 12h.01M15.5 12h.01",
  facebook: "M14 8h3V4h-3a4 4 0 0 0-4 4v2H7v4h3v7h4v-7h3l1-4h-4V8.5a.5.5 0 0 1 .5-.5z",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14",
} as const;

export type IconName = keyof typeof PATHS;

/** Nội dung trong landing.ts vẫn dùng emoji làm khóa; chuyển sang biểu tượng tương ứng. */
const FROM_EMOJI: Record<string, IconName> = {
  "🏡": "home", "🛏️": "bed", "🚿": "shower", "🍳": "pot", "🌳": "tree", "💧": "water", "🚗": "car", "📶": "wifi", "🛡️": "shield",
};

export default function Icon({ name }: { name: IconName | string }) {
  const key = (name in PATHS ? name : FROM_EMOJI[name] ?? "home") as IconName;
  return (
    <svg className="lp-svg" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[key]} />
    </svg>
  );
}
