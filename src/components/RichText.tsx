import type { ReactNode } from "react";

/** Chữ đậm **như vậy**; mọi thứ khác là văn bản thuần (không chèn HTML nên an toàn khi admin sửa nội dung). */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part);
}

/** Hiển thị nội dung có cú pháp đơn giản: "## tiêu đề", "- gạch đầu dòng", dòng trống ngăn đoạn. */
export default function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flushList = () => { if (list.length) { blocks.push(<ul key={blocks.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  const flushPara = () => { if (para.length) { blocks.push(<p key={blocks.length}>{inline(para.join(" "))}</p>); para = []; } };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flushList(); flushPara(); continue; }
    if (line.startsWith("## ")) { flushList(); flushPara(); blocks.push(<h2 key={blocks.length}>{line.slice(3)}</h2>); continue; }
    if (line.startsWith("- ")) { flushPara(); list.push(line.slice(2)); continue; }
    flushList();
    para.push(line);
  }
  flushList(); flushPara();
  return <div className="lp-prose">{blocks}</div>;
}
