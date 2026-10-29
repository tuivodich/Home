import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, setDoc, Timestamp, where, writeBatch } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useQueryDocs } from "../lib/hr";
import { useI18n } from "../i18n";
import { fmtDate, toDateStr, todayStr, addDays } from "../lib/format";
import { useAuth } from "../lib/auth";
import DateInput from "../components/DateInput";
import { useAudit, type AuditEntry } from "../lib/audit";

/** Nhân sự → Nhật ký hoạt động (chủ/quản lý): 300 thao tác gần nhất, lọc theo loại và tìm theo người/nội dung. */
const GROUPS: [string, string, string][] = [
  ["booking", "Đặt phòng (kể cả khách không đến, hết hạn)", "Bookings (incl. no-shows, expiries)"], ["payment", "Thanh toán", "Payments"], ["price", "Sửa giá", "Price edits"], ["tier", "Hạng khách hàng", "Customer tiers"], ["audit", "Quản lý nhật ký", "Log management"],
  ["account", "Tài khoản & vai trò", "Accounts & roles"], ["room,block", "Phòng & khóa phòng", "Rooms & blocks"], ["settings", "Giá & chính sách", "Prices & policy"], ["expense", "Chi phí", "Expenses"],
];
const LABELS: Record<string, [string, string]> = {
  "account.role": ["Đổi vai trò", "Role change"], "block.create": ["Khóa phòng", "Room blocked"], "block.delete": ["Mở khóa phòng", "Block removed"],
  "booking.create": ["Tạo đặt phòng", "Booking created"], "booking.noshow": ["Khách không đến", "No-show"], "booking.expire": ["Đặt phòng hết hạn", "Booking expired"],
  "booking.status": ["Đổi trạng thái đặt phòng", "Booking status"], "expense.add": ["Thêm chi phí", "Expense added"], "price.coupon": ["Mã giảm giá", "Coupon"],
  "price.edit": ["Sửa giá", "Price edit"], "room.delete": ["Xóa phòng", "Room deleted"], "settings.pricing": ["Giá & chính sách", "Prices & policy"],
  "tier.config": ["Cấu hình hạng", "Tier settings"], "payment.in": ["Thu tiền", "Payment in"], "payment.refund": ["Hoàn tiền", "Refund"], "settings.ical": ["Đồng bộ iCal", "iCal sync"], "settings.bankhook": ["Webhook ngân hàng", "Bank webhook"], "audit.toggle": ["Bật/tắt nhật ký", "Logging switch"], "audit.purge": ["Xóa nhật ký", "Log purge"], "tier.set": ["Đặt hạng khách", "Tier set"],
};
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d");

/** Chủ: bật/tắt ghi nhật ký và xóa bớt dữ liệu cũ (toàn bộ hoặc theo khoảng ngày) cho nhẹ cơ sở dữ liệu. */
function OwnerTools({ T }: { T: (vi: string, en: string) => string }) {
  const audit = useAudit();
  const [on, setOn] = useState<boolean | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(todayStr());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => onSnapshot(doc(db, "settings", "audit"), (s) => setOn(s.data()?.enabled !== false), () => setOn(null)), []);

  const toggle = async () => {
    const next = !on;
    if (!confirm(next ? T("Bật lại ghi nhật ký hoạt động?", "Turn activity logging back on?") : T("TẮT ghi nhật ký? Từ giờ các thao tác (kể cả của bot Telegram và hệ thống tự động) sẽ không được ghi lại cho đến khi bật lại.", "Turn logging OFF? From now on actions (including the Telegram bot and automatic jobs) will not be recorded until you turn it back on."))) return;
    // Ghi một dòng cuối cùng trước khi tắt để còn dấu vết ai đã tắt.
    if (!next) audit("audit.toggle", "Chủ TẮT ghi nhật ký hoạt động");
    await setDoc(doc(db, "settings", "audit"), { enabled: next }).catch((e) => { console.error("audit toggle", e); setMsg(T("Không đổi được.", "Could not change.")); });
    if (next) setTimeout(() => audit("audit.toggle", "Chủ BẬT lại ghi nhật ký hoạt động"), 800);
  };

  // Xóa theo lô 400 (giới hạn 500 thao tác/lần ghi); khoảng ngày tính theo giờ địa phương.
  const purge = async (all: boolean) => {
    setMsg("");
    if (!all && (!from || !to || from > to)) { setMsg(T("Chọn khoảng ngày hợp lệ (từ ≤ đến).", "Pick a valid date range (from ≤ to).")); return; }
    const label = all ? T("TOÀN BỘ nhật ký", "ALL log entries") : T(`nhật ký từ ${fmtDate(from)} đến ${fmtDate(to)}`, `log entries from ${fmtDate(from)} to ${fmtDate(to)}`);
    if (!confirm(T(`Xóa vĩnh viễn ${label}? Không khôi phục được.`, `Permanently delete ${label}? This cannot be undone.`))) return;
    setBusy(true);
    try {
      const base = collection(db, "auditLog");
      const q0 = all ? query(base, orderBy("at"), limit(400))
        : query(base, where("at", ">=", Timestamp.fromDate(new Date(`${from}T00:00:00`))), where("at", "<", Timestamp.fromDate(new Date(`${addDays(to, 1)}T00:00:00`))), orderBy("at"), limit(400));
      let n = 0;
      for (;;) {
        const snap = await getDocs(q0);
        if (snap.empty) break;
        const w = writeBatch(db);
        snap.docs.forEach((d) => w.delete(d.ref));
        await w.commit();
        n += snap.size;
        setMsg(T(`Đã xóa ${n}…`, `Deleted ${n}…`));
      }
      setMsg(T(`Đã xóa ${n} bản ghi.`, `Deleted ${n} entries.`));
      audit("audit.purge", all ? `Chủ xóa toàn bộ nhật ký (${n} bản ghi)` : `Chủ xóa nhật ký ${fmtDate(from)} → ${fmtDate(to)} (${n} bản ghi)`);
    } catch (e) { console.error("audit purge", e); setMsg(T("Xóa không thành công. Thử lại.", "Delete failed. Try again.")); }
    finally { setBusy(false); }
  };

  return (
    <div className="card" id="audit-owner">
      <h3>{T("Quản lý nhật ký (chỉ chủ)", "Log management (owner only)")}</h3>
      <div className="row between">
        <span>{T("Ghi nhật ký hoạt động", "Activity logging")}: <b>{on === null ? "…" : on ? T("ĐANG BẬT", "ON") : T("ĐANG TẮT", "OFF")}</b></span>
        <button type="button" className={on ? "ghost danger" : ""} onClick={toggle} disabled={on === null}>{on ? T("Tắt ghi nhật ký", "Turn off") : T("Bật ghi nhật ký", "Turn on")}</button>
      </div>
      <div className="row">
        <label>{T("Từ ngày", "From")} <DateInput value={from} onChange={setFrom} max={to || undefined} /></label>
        <label>{T("Đến ngày", "To")} <DateInput value={to} onChange={setTo} min={from || undefined} /></label>
        <button type="button" className="ghost danger" disabled={busy} onClick={() => purge(false)}>{T("Xóa trong khoảng ngày", "Delete range")}</button>
        <button type="button" className="ghost danger" disabled={busy} onClick={() => purge(true)}>{T("Xóa toàn bộ", "Delete all")}</button>
      </div>
      {msg && <small role="status">{msg}</small>}
    </div>
  );
}

export default function AuditPage() {
  const { profile } = useAuth();
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
      <p><small>{T("Ghi lại ai đã làm gì và lúc nào trong trang quản trị (đổi trạng thái đặt phòng, sửa giá, thu/hoàn tiền, đổi hạng, đổi vai trò, khóa phòng, sửa giá & chính sách…). Bản ghi không sửa được; chỉ chủ mới tắt/bật ghi nhật ký và xóa bớt dữ liệu cũ. Hiện 300 thao tác gần nhất.", "Who did what and when in the admin area. Entries cannot be edited; only the owner can switch logging off/on or delete old entries. Showing the latest 300.")}</small></p>
      {profile?.role === "owner" && <OwnerTools T={T} />}
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
