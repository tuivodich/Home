import { useMemo, useState } from "react";
import { collection, limit, orderBy, query } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useQueryDocs } from "../lib/hr";
import { useI18n } from "../i18n";
import { fmtDate, toDateStr } from "../lib/format";
import type { AuditEntry } from "../lib/audit";

/** Nhân sự → Nhật ký hoạt động (chủ/quản lý): 300 thao tác gần nhất, lọc theo loại và tìm theo người/nội dung. */
const GROUPS: [string, string, string][] = [
  ["booking", "Đặt phòng (kể cả khách không đến, hết hạn)", "Bookings (incl. no-shows, expiries)"], ["payment", "Thanh toán", "Payments"], ["price", "Sửa giá", "Price edits"], ["tier", "Hạng khách hàng", "Customer tiers"],
  ["account", "Tài khoản & vai trò", "Accounts & roles"], ["room,block", "Phòng & khóa phòng", "Rooms & blocks"], ["settings", "Giá & chính sách", "Prices & policy"], ["expense", "Chi phí", "Expenses"],
];
const LABELS: Record<string, [string, string]> = {
  "account.role": ["Đổi vai trò", "Role change"], "block.create": ["Khóa phòng", "Room blocked"], "block.delete": ["Mở khóa phòng", "Block removed"],
  "booking.create": ["Tạo đặt phòng", "Booking created"], "booking.noshow": ["Khách không đến", "No-show"], "booking.expire": ["Đặt phòng hết hạn", "Booking expired"],
  "booking.status": ["Đổi trạng thái đặt phòng", "Booking status"], "expense.add": ["Thêm chi phí", "Expense added"], "price.coupon": ["Mã giảm giá", "Coupon"],
  "price.edit": ["Sửa giá", "Price edit"], "room.delete": ["Xóa phòng", "Room deleted"], "settings.pricing": ["Giá & chính sách", "Prices & policy"],
  "tier.config": ["Cấu hình hạng", "Tier settings"], "tier.set": ["Đặt hạng khách", "Tier set"],
};
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

export default function AuditPage() {
  const { lang } = useI18n();
  const T = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const { data, loading } = useQueryDocs<AuditEntry>(query(collection(db, "auditLog"), orderBy("at", "desc"), limit(300)), "audit");
  const [group, setGroup] = useState("");
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const k = norm(q.trim());
    return data.filter((e) => (!group || group.split(",").some((g) => e.action.startsWith(g + "."))) && (!k || norm(`${e.byName} ${e.summary} ${e.action} ${LABELS[e.action]?.join(" ") ?? ""}`).includes(k)));
  }, [data, group, q]);
  const when = (e: AuditEntry) => { const d = e.at?.toDate(); return d ? `${fmtDate(toDateStr(d))} ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "…"; };

  return (
    <section id="audit-log">
      <h2>{T("Nhật ký hoạt động", "Activity log")}</h2>
      <p><small>{T("Ghi lại ai đã làm gì và lúc nào trong trang quản trị (đổi trạng thái đặt phòng, sửa giá, thu/hoàn tiền, đổi hạng, đổi vai trò, khóa phòng, sửa giá & chính sách…). Bản ghi chỉ thêm, không sửa hay xóa được. Hiện 300 thao tác gần nhất.", "Who did what and when in the admin area. Entries are append-only. Showing the latest 300.")}</small></p>
      <div className="card">
        <div className="row">
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={T("Tìm theo người hoặc nội dung…", "Search by person or text…")} aria-label={T("Tìm trong nhật ký", "Search log")} />
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label={T("Loại thao tác", "Type")}>
            <option value="">{T("Tất cả thao tác", "All actions")}</option>
            {GROUPS.map(([k, vi, en]) => <option key={k} value={k}>{lang === "vi" ? vi : en}</option>)}
          </select>
        </div>
        {loading && <small>…</small>}
        {!loading && list.length === 0 && <small>{T("Chưa có bản ghi nào.", "No entries.")}</small>}
        <div className="auditlist">
          {list.map((e) => (
            <div className="row between audit-row" key={e.id}>
              <span><b>{e.byName || "?"}</b> <small className="dd-role">({e.role || "—"})</small> · {e.summary}</span>
              <small>{when(e)} · <code title={e.action}>{LABELS[e.action] ? LABELS[e.action][lang === "vi" ? 0 : 1] : e.action}</code></small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
