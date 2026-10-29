import { useMemo, useState, type FormEvent } from "react";
import { Timestamp, addDoc, collection, deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../lib/auth";
import { useCollection } from "../lib/useCollection";
import { useI18n } from "../i18n";
import { useMoney } from "../lib/useRate";
import DateInput from "../components/DateInput";
import { fmtDate, todayStr } from "../lib/format";
import { downloadCsv, lastMonths, monthRange } from "../lib/hr";
import { bookingCode } from "../lib/banks";
import type { Booking } from "../lib/types";
import NumInput from "../components/NumInput";

export const EXPENSE_CATS = ["electric", "water", "salary", "maintenance", "supplies", "food", "marketing", "tax", "other"] as const;
type Cat = (typeof EXPENSE_CATS)[number];
interface Expense { id: string; date: string; category: Cat; amount: number; vendor: string; note: string; paid: boolean; dueDate?: string; paidAt?: string; createdBy?: string }
const CAT: Record<Cat, [string, string]> = {
  electric: ["Điện", "Electricity"], water: ["Nước", "Water"], salary: ["Lương nhân viên", "Staff salaries"], maintenance: ["Sửa chữa, bảo trì", "Repairs & maintenance"],
  supplies: ["Vật tư, đồ dùng", "Supplies"], food: ["Ăn uống, nguyên liệu", "Food & ingredients"], marketing: ["Quảng cáo", "Marketing"], tax: ["Thuế, phí", "Taxes & fees"], other: ["Khác", "Other"],
};
const blank = () => ({ date: todayStr(), category: "electric" as Cat, amount: 0, vendor: "", note: "", paid: true, dueDate: "" });

/** Chi phí và công nợ (chủ/quản lý): ghi chi phí, khoản phải trả chưa thanh toán, và khoản còn phải thu từ khách. */
export default function ExpensesPage() {
  const { lang } = useI18n();
  const T = (vi: string, en: string) => (lang === "vi" ? vi : en);
  const { money, moneyText } = useMoney();
  const { user } = useAuth();
  const { data: expenses } = useCollection<Expense>("expenses");
  const { data: bookings } = useCollection<Booking>("bookings");
  const months = useMemo(() => lastMonths(24), []);
  const [month, setMonth] = useState(months[0]);
  const [tab, setTab] = useState<"expenses" | "debts">("expenses");
  const [f, setF] = useState(blank());
  const [err, setErr] = useState("");
  const [from, to] = monthRange(month);

  const list = useMemo(() => expenses.filter((e) => e.date >= from && e.date < to).sort((a, b) => b.date.localeCompare(a.date)), [expenses, from, to]);
  const total = list.reduce((s, e) => s + e.amount, 0);
  const byCat = EXPENSE_CATS.map((c) => ({ c, v: list.filter((e) => e.category === c).reduce((s, e) => s + e.amount, 0) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const payable = expenses.filter((e) => !e.paid).sort((a, b) => (a.dueDate || a.date).localeCompare(b.dueDate || b.date));
  const receivable = bookings.filter((b) => ["confirmed", "checked_in", "checked_out"].includes(b.status) && b.total - (b.paid ?? 0) > 0)
    .sort((a, b) => a.checkOut.localeCompare(b.checkOut));
  const today = todayStr();

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!(f.amount > 0)) return setErr(T("Số tiền phải lớn hơn 0.", "Amount must be greater than 0."));
    try {
      await addDoc(collection(db, "expenses"), { date: f.date, category: f.category, amount: f.amount, vendor: f.vendor.trim(), note: f.note.trim(), paid: f.paid, ...(!f.paid && f.dueDate ? { dueDate: f.dueDate } : {}), createdBy: user?.uid ?? "" });
      setF(blank());
    } catch (ex) { console.error("add expense", ex); setErr(T("Không lưu được.", "Could not save.")); }
  };
  // Thu nợ của khách ngay tại đây (ghi vào `paid` và nhật ký thanh toán của đặt phòng).
  const collect = (b: Booking) => {
    const due = b.total - (b.paid ?? 0);
    const v = prompt(T("Số tiền thu (VNĐ):", "Amount received (VND):"), String(due));
    const n = v === null ? 0 : Number(v.replace(/[^\d]/g, ""));
    if (n > 0) updateDoc(doc(db, "bookings", b.id), { paid: (b.paid ?? 0) + n, payLog: [...(b.payLog ?? []), { amount: n, at: Timestamp.now(), by: user?.uid ?? "", note: T("Thu công nợ", "Debt payment") }] }).catch((ex) => console.error("collect", ex));
  };
  const markPaid = (e: Expense) => setDoc(doc(db, "expenses", e.id), { date: e.date, category: e.category, amount: e.amount, vendor: e.vendor, note: e.note, paid: true, paidAt: today, ...(e.dueDate ? { dueDate: e.dueDate } : {}), createdBy: e.createdBy ?? "" });

  return (
    <section>
      <h2>{T("Chi phí & công nợ", "Expenses & debts")}</h2>
      <div className="card">
        <div className="row">
          <button type="button" className={`seg ${tab === "expenses" ? "on" : ""}`} aria-pressed={tab === "expenses"} onClick={() => setTab("expenses")}>{T("Chi phí", "Expenses")}</button>
          <button type="button" className={`seg ${tab === "debts" ? "on" : ""}`} aria-pressed={tab === "debts"} onClick={() => setTab("debts")}>{T("Công nợ", "Debts")} ({payable.length + receivable.length})</button>
        </div>
      </div>

      {tab === "expenses" && (
        <>
          <form className="card" onSubmit={add} id="expense-form">
            <h3>{T("Ghi chi phí", "Add an expense")}</h3>
            <div className="row shiftform">
              <label>{T("Ngày", "Date")}<DateInput required value={f.date} onChange={(v) => setF({ ...f, date: v })} /></label>
              <label>{T("Loại", "Category")}<select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as Cat })}>{EXPENSE_CATS.map((c) => <option key={c} value={c}>{CAT[c][lang === "vi" ? 0 : 1]}</option>)}</select></label>
              <label>{T("Số tiền (VNĐ)", "Amount (VND)")}<NumInput allowEmpty min={0} step={1000} value={f.amount || ""} onChange={(e) => setF({ ...f, amount: Math.max(0, +e.target.value || 0) })} /></label>
            </div>
            <div className="row shiftform">
              <label>{T("Nơi chi / nhà cung cấp", "Vendor")}<input maxLength={100} value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></label>
              <label>{T("Ghi chú", "Note")}<input maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
            </div>
            <label className="check"><input type="checkbox" checked={!f.paid} onChange={(e) => setF({ ...f, paid: !e.target.checked })} /><span>{T("Chưa thanh toán (ghi vào công nợ phải trả)", "Not paid yet (add to payables)")}</span></label>
            {!f.paid && <label>{T("Hạn thanh toán", "Due date")}<DateInput value={f.dueDate} onChange={(v) => setF({ ...f, dueDate: v })} /></label>}
            {err && <p className="error">{err}</p>}
            <div><button type="submit">{T("Thêm", "Add")}</button></div>
          </form>

          <div className="card">
            <div className="row between">
              <h3>{T("Chi phí tháng", "Expenses in")} {month.slice(5)}/{month.slice(0, 4)}: {money(total)}</h3>
              <div className="row">
                <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label={T("Tháng", "Month")}>{months.map((m) => <option key={m} value={m}>{m.slice(5)}/{m.slice(0, 4)}</option>)}</select>
                <button className="ghost" onClick={() => downloadCsv(`chi-phi-${month}.csv`, [[T("Ngày", "Date"), T("Loại", "Category"), T("Số tiền", "Amount"), T("Nơi chi", "Vendor"), T("Ghi chú", "Note"), T("Đã thanh toán", "Paid")], ...list.map((e) => [fmtDate(e.date), CAT[e.category][lang === "vi" ? 0 : 1], e.amount, e.vendor, e.note, e.paid ? "x" : ""])])}>⬇ CSV</button>
              </div>
            </div>
            {byCat.length > 0 && <small>{byCat.map((x) => `${CAT[x.c][lang === "vi" ? 0 : 1]}: ${moneyText(x.v)}`).join(" · ")}</small>}
            {list.length === 0 && <p>{T("Chưa có chi phí trong tháng này.", "No expenses this month.")}</p>}
            {list.map((e) => (
              <div className="row between" key={e.id}>
                <span>{fmtDate(e.date)} · <b>{CAT[e.category][lang === "vi" ? 0 : 1]}</b>{e.vendor && ` · ${e.vendor}`}{e.note && ` · ${e.note}`}{!e.paid && <b className="overdue"> · {T("chưa thanh toán", "unpaid")}</b>}</span>
                <span className="row"><b>{money(e.amount)}</b><button className="ghost danger" onClick={() => confirm(T("Xóa khoản chi này?", "Delete this expense?")) && deleteDoc(doc(db, "expenses", e.id))}>{T("Xóa", "Delete")}</button></span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "debts" && (
        <>
          <div className="card" id="payables">
            <h3>{T("Phải trả (chi phí chưa thanh toán)", "Payables (unpaid expenses)")}: {money(payable.reduce((s, e) => s + e.amount, 0))}</h3>
            {payable.length === 0 && <p>{T("Không có khoản phải trả.", "Nothing to pay.")}</p>}
            {payable.map((e) => (
              <div className="row between" key={e.id}>
                <span>{fmtDate(e.date)} · <b>{CAT[e.category][lang === "vi" ? 0 : 1]}</b>{e.vendor && ` · ${e.vendor}`}{e.dueDate && <span className={e.dueDate < today ? "overdue" : ""}> · {T("hạn", "due")} {fmtDate(e.dueDate)}{e.dueDate < today ? ` (${T("quá hạn", "overdue")})` : ""}</span>}</span>
                <span className="row"><b>{money(e.amount)}</b><button onClick={() => markPaid(e)}>{T("Đã thanh toán", "Mark paid")}</button></span>
              </div>
            ))}
          </div>
          <div className="card" id="receivables">
            <h3>{T("Phải thu (khách còn nợ)", "Receivables (guests owe)")}: {money(receivable.reduce((s, b) => s + b.total - (b.paid ?? 0), 0))}</h3>
            <small>{T("Đặt phòng đã xác nhận / đang ở / đã trả phòng mà chưa thu đủ. Bấm “Thu tiền” để ghi nhận khoản khách vừa trả.", "Confirmed, in-house or checked-out bookings not fully paid. Press “Collect” to record a payment.")}</small>
            {receivable.length === 0 && <p>{T("Không có khoản phải thu.", "Nothing outstanding.")}</p>}
            {receivable.map((b) => (
              <div className="row between" key={b.id}>
                <span><b>{b.guestName}</b> · {bookingCode(b.id)} · {fmtDate(b.checkIn)} → {fmtDate(b.checkOut)} · <small>{T(`${b.status === "checked_out" ? "đã trả phòng" : b.status === "checked_in" ? "đang ở" : "đã xác nhận"}`, b.status)}</small></span>
                <span className="row"><b className={b.status === "checked_out" ? "overdue" : ""}>{money(b.total - (b.paid ?? 0))}</b><button onClick={() => collect(b)}>{T("Thu tiền", "Collect")}</button></span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
