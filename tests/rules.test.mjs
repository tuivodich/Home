import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Chạy: npm run test:rules (Firestore Emulator do firebase emulators:exec dựng lên, địa chỉ lấy từ FIRESTORE_EMULATOR_HOST).
const [EMU_HOST, EMU_PORT] = (process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8089").split(":");
const RULES = fileURLToPath(new URL("../firestore.rules", import.meta.url));
import { addDoc, serverTimestamp, Timestamp, doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, collection, getDocs, query, where } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-test",
  firestore: { rules: readFileSync(RULES, "utf8"), host: EMU_HOST, port: Number(EMU_PORT) },
});
let pass = 0, fail = 0;
const check = async (name, p, expectOk) => {
  try { await (expectOk ? assertSucceeds(p) : assertFails(p)); pass++; console.log("ok  ", name); }
  catch (e) { fail++; console.log("FAIL", name, "-", String(e.message).split("\n")[0]); }
};

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "meta/bootstrap"), { uid: "owner1" });
  await setDoc(doc(db, "users/owner1"), { role: "owner", email: "o@x" });
  await setDoc(doc(db, "users/recep1"), { role: "reception", email: "r@x" });
  await setDoc(doc(db, "users/hk1"), { role: "housekeeping", email: "h@x" });
  await setDoc(doc(db, "users/cust1"), { role: "customer", email: "c1@x" });
  await setDoc(doc(db, "users/cust2"), { role: "customer", email: "c2@x" });
  await setDoc(doc(db, "settings/app"), { maxPending: 20 });
  await setDoc(doc(db, "rooms/r1"), { name: "P1", price: 500000, status: "active" });
  await setDoc(doc(db, "bookings/b0"), { roomId: "r1", guestName: "Secret Name", phone: "090", checkIn: "2026-11-01", checkOut: "2026-11-03", status: "confirmed", createdBy: "cust2" });
  await setDoc(doc(db, "busy/b0"), { roomId: "r1", checkIn: "2026-11-01", checkOut: "2026-11-03", status: "confirmed" });
  await setDoc(doc(db, "guests/g1"), { fullName: "Secret", docNumber: "123" });
  const ob = (status, source = "online", by = "cust2") => ({ roomId: "r1", guestName: "X", phone: "1", email: "x@x", checkIn: "2026-12-10", checkOut: "2026-12-12", guests: 2, total: 1, status, note: "", source, createdBy: by });
  for (const [id, st, src] of [["oc1", "confirmed", "online"], ["oc2", "checked_in", "online"], ["oc3", "confirmed", "staff"], ["oc5", "confirmed", "online"], ["oc6", "pending", "online"], ["oc7", "confirmed", "online"], ["oc8", "confirmed", "online"]]) {
    await setDoc(doc(db, "bookings/" + id), ob(st, src));
    await setDoc(doc(db, "busy/" + id), { roomId: "r1", checkIn: "2026-12-10", checkOut: "2026-12-12", status: st });
  }
  await setDoc(doc(db, "coupons/C20"), { percent: 20, used: false, note: "t" });
  await setDoc(doc(db, "coupons/C50"), { percent: 50, used: false });
  await setDoc(doc(db, "coupons/USED"), { percent: 10, used: true, usedBy: "cust2", bookingId: "zzz" });
  await setDoc(doc(db, "coupons/OLD"), { percent: 10, used: false, expiresAt: new Date("2020-01-01") });
  await setDoc(doc(db, "coupons/CX"), { percent: 30, used: false });
});

const anon = env.unauthenticatedContext().firestore();
const c1 = env.authenticatedContext("cust1").firestore();
const c2 = env.authenticatedContext("cust2").firestore();
const rec = env.authenticatedContext("recep1").firestore();
const hk = env.authenticatedContext("hk1").firestore();
const own = env.authenticatedContext("owner1").firestore();

// Công khai
await check("anon reads rooms", getDoc(doc(anon, "rooms/r1")), true);
await check("anon reads busy", getDoc(doc(anon, "busy/b0")), true);
await check("anon lists busy", getDocs(collection(anon, "busy")), true);
await check("anon reads settings", getDoc(doc(anon, "settings/app")), true);
await check("anon CANNOT read booking", getDoc(doc(anon, "bookings/b0")), false);
await check("anon CANNOT list bookings", getDocs(collection(anon, "bookings")), false);
await check("anon CANNOT read guests", getDoc(doc(anon, "guests/g1")), false);
await check("anon CANNOT write busy", setDoc(doc(anon, "busy/x"), { roomId: "r1", checkIn: "a", checkOut: "b", status: "pending" }), false);
await check("anon CANNOT write rooms", setDoc(doc(anon, "rooms/r9"), { name: "x" }), false);

// Khách hàng
await check("customer CANNOT read others' booking", getDoc(doc(c1, "bookings/b0")), false);
await check("customer CANNOT list all bookings", getDocs(collection(c1, "bookings")), false);
await check("customer reads own bookings query", getDocs(query(collection(c2, "bookings"), where("createdBy", "==", "cust2"))), true);
await check("customer CANNOT read guests", getDoc(doc(c1, "guests/g1")), false);
await check("customer CANNOT list users", getDocs(collection(c1, "users")), false);
await check("customer CANNOT become owner", setDoc(doc(env.authenticatedContext("new1").firestore(), "users/new1"), { role: "owner", email: "n@x" }), false);
await check("customer CANNOT become manager", setDoc(doc(env.authenticatedContext("new1").firestore(), "users/new1"), { role: "manager", email: "n@x" }), false);
await check("new user can create customer profile", setDoc(doc(env.authenticatedContext("new2").firestore(), "users/new2"), { role: "customer", email: "n@x" }), true);
await check("customer CANNOT change own role", updateDoc(doc(c1, "users/cust1"), { role: "owner" }), false);

const good = { roomId: "r1", guestName: "An", phone: "090", email: "a@x", checkIn: "2026-12-01", checkOut: "2026-12-03", guests: 2, total: 1000000, status: "pending", note: "", source: "online", createdBy: "cust1" };
const busyDoc = { roomId: "r1", checkIn: "2026-12-01", checkOut: "2026-12-03", status: "pending" };
let slotN = 0;
const withSlot = (w, db, id, uid) => { const n = ++slotN; const slotId = `${uid}_${n}`; w.set(doc(db, "pend", slotId), { uid, n, bookingId: id }); return slotId; };
const mk = async (db, id, b, bd) => { const w = writeBatch(db); const slotId = withSlot(w, db, id, b.createdBy); w.set(doc(db, "bookings", id), { ...b, slotId }); w.set(doc(db, "busy", id), bd); await w.commit(); };

await check("customer creates pending booking + busy", mk(c1, "n1", good, busyDoc), true);
await check("customer CANNOT create confirmed booking", mk(c1, "n2", { ...good, status: "confirmed" }, busyDoc), false);
await check("customer CANNOT spoof createdBy", mk(c1, "n3", { ...good, createdBy: "cust2" }, busyDoc), false);
await check("customer CANNOT add extra field", mk(c1, "n4", { ...good, admin: true }, busyDoc), false);
await check("customer CANNOT bad date format", mk(c1, "n5", { ...good, checkIn: "tomorrow" }, busyDoc), false);
await check("customer CANNOT checkOut<=checkIn", mk(c1, "n6", { ...good, checkOut: "2026-12-01" }, { ...busyDoc, checkOut: "2026-12-01" }), false);
await check("customer CANNOT unknown room", mk(c1, "n7", { ...good, roomId: "zzz" }, { ...busyDoc, roomId: "zzz" }), false);
await check("customer CANNOT busy mismatching booking dates", mk(c1, "n8", good, { ...busyDoc, checkOut: "2026-12-02" }), false);
await check("customer CANNOT busy with extra name field", mk(c1, "n9", good, { ...busyDoc, name: "An" }), false);
await check("customer CANNOT create busy alone", setDoc(doc(c1, "busy/solo"), busyDoc), false);
await check("customer CANNOT busy for other's booking", (async () => { const w = writeBatch(c2); w.set(doc(c2, "busy/n1x"), busyDoc); w.set(doc(c2, "bookings/n1x"), { ...good, createdBy: "cust1" }); await w.commit(); })(), false);
await check("customer CANNOT negative guests", mk(c1, "n10", { ...good, guests: 0 }, busyDoc), false);
await check("customer CANNOT huge note", mk(c1, "n11", { ...good, note: "x".repeat(600) }, busyDoc), false);

await check("owner of booking reads it", getDoc(doc(c1, "bookings/n1")), true);
await check("customer CANNOT confirm own booking", updateDoc(doc(c1, "bookings/n1"), { status: "confirmed" }), false);
await check("customer CANNOT edit own booking price", updateDoc(doc(c1, "bookings/n1"), { total: 1 }), false);
await check("customer CANNOT change busy status", updateDoc(doc(c1, "busy/n1"), { status: "confirmed" }), false);
await check("customer CANNOT cancel others' booking", updateDoc(doc(c2, "bookings/n1"), { status: "cancelled" }), false);
await check("customer cancels own pending (booking+busy)", (async () => { const w = writeBatch(c1); w.update(doc(c1, "bookings/n1"), { status: "cancelled" }); w.delete(doc(c1, "busy/n1")); await w.commit(); })(), true);
await check("customer CANNOT delete other's busy", deleteDoc(doc(c1, "busy/b0")), false);

// Nhân viên
await check("reception reads bookings", getDocs(collection(rec, "bookings")), true);
await check("reception reads guests", getDoc(doc(rec, "guests/g1")), true);
await check("reception confirms booking", updateDoc(doc(rec, "bookings/b0"), { status: "checked_in" }), true);
await check("reception syncs busy", updateDoc(doc(rec, "busy/b0"), { status: "checked_in" }), true);
await check("reception CANNOT delete guest", deleteDoc(doc(rec, "guests/g1")), false);
await check("reception CANNOT edit rooms", setDoc(doc(rec, "rooms/r1"), { name: "hack" }), false);
await check("housekeeping reads bookings", getDocs(collection(hk, "bookings")), true);
await check("housekeeping CANNOT read guests", getDoc(doc(hk, "guests/g1")), false);
await check("housekeeping CANNOT write busy", updateDoc(doc(hk, "busy/b0"), { status: "x" }), false);
await check("owner edits rooms", setDoc(doc(own, "rooms/r2"), { name: "P2", type: "wood", capacity: 2, price: 1, status: "active" }), true);
await check("owner grants role", updateDoc(doc(own, "users/cust1"), { role: "reception" }), true);
await check("owner deletes guest", deleteDoc(doc(own, "guests/g1")), true);


// ===== Mã giảm giá =====
// cust1 đã bị nâng thành lễ tân ở phần trên; đặt lại thành khách hàng để thử đúng vai trò.
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "users/cust1"), { role: "customer", email: "c1@x" }); });
const cpBatch = async (db, bid, code, extra = {}, couponPatch = {}, bookingPatch = {}) => {
  const w = writeBatch(db);
  const pct = extra.discountPercent ?? 20;
  const slotId = withSlot(w, db, bid, "cust1");
  w.set(doc(db, "bookings", bid), { ...good, slotId, couponCode: code, discountPercent: pct, originalTotal: 1000000, total: 800000, createdBy: "cust1", ...bookingPatch });
  w.set(doc(db, "busy", bid), busyDoc);
  w.update(doc(db, "coupons", code), { used: true, usedBy: "cust1", usedAt: new Date(), bookingId: bid, ...couponPatch });
  await w.commit();
};
await check("customer CANNOT list coupons", getDocs(collection(c1, "coupons")), false);
await check("anon CANNOT read coupon", getDoc(doc(anon, "coupons/C20")), false);
await check("customer can get one coupon by code", getDoc(doc(c1, "coupons/C20")), true);
await check("customer CANNOT create coupon", setDoc(doc(c1, "coupons/MINE"), { percent: 99, used: false }), false);
await check("customer CANNOT edit coupon percent", updateDoc(doc(c1, "coupons/C20"), { percent: 100 }), false);
await check("customer CANNOT mark coupon used alone", updateDoc(doc(c1, "coupons/C20"), { used: true, usedBy: "cust1", usedAt: new Date(), bookingId: "nope" }), false);
await check("customer redeems coupon with booking (20%)", cpBatch(c1, "k1", "C20"), true);
await check("coupon cannot be used twice", cpBatch(c1, "k2", "C20"), false);
await check("CANNOT reuse an already-used coupon", cpBatch(c1, "k3", "USED", { discountPercent: 10 }), false);
await check("CANNOT use expired coupon", cpBatch(c1, "k4", "OLD", { discountPercent: 10 }), false);
await check("CANNOT claim bigger discount than coupon (C50 as 80%)", cpBatch(c1, "k5", "C50", { discountPercent: 80 }), false);
await check("CANNOT redeem coupon for someone else (usedBy)", cpBatch(c1, "k6", "C50", { discountPercent: 50 }, { usedBy: "cust2" }), false);
await check("CANNOT discount without redeeming (no coupon write)", mk(c1, "k7", { ...good, couponCode: "C50", discountPercent: 50, originalTotal: 1 }, busyDoc), false);
await check("CANNOT discountPercent without couponCode", mk(c1, "k8", { ...good, discountPercent: 90 }, busyDoc), false);
await check("CANNOT bind coupon to a different bookingId", (async () => { const w = writeBatch(c1); w.set(doc(c1, "bookings/k9"), { ...good, couponCode: "C50", discountPercent: 50, originalTotal: 1 }); w.set(doc(c1, "busy/k9"), busyDoc); w.update(doc(c1, "coupons/C50"), { used: true, usedBy: "cust1", usedAt: new Date(), bookingId: "other" }); await w.commit(); })(), false);
await check("coupon C50 still unused after failed attempts", (async () => { const s = await getDoc(doc(own, "coupons/C50")); if (s.data().used) throw new Error("used!"); })(), true);
await check("customer CANNOT change coupon of own booking", updateDoc(doc(c1, "bookings/k1"), { discountPercent: 100 }), false);
await check("booking without email is rejected", mk(c1, "k10", (({ email, ...r }) => r)(good), busyDoc), false);
await check("owner creates coupon", setDoc(doc(own, "coupons/NEW1"), { percent: 25, used: false }), true);
await check("owner lists coupons", getDocs(collection(own, "coupons")), true);
await check("owner deletes coupon", deleteDoc(doc(own, "coupons/NEW1")), true);
await check("reception CANNOT create coupon", setDoc(doc(rec, "coupons/R1"), { percent: 5, used: false }), false);


// ===== Sửa giá: phân quyền =====
await check("reception CANNOT edit booking price", updateDoc(doc(rec, "bookings/b0"), { total: 1 }), false);
await check("reception CANNOT attach a discount to a booking", updateDoc(doc(rec, "bookings/b0"), { couponCode: "C50", discountPercent: 50 }), false);
await check("reception can still change status + cancelReason", updateDoc(doc(rec, "bookings/b0"), { status: "cancelled", cancelReason: "expired" }), true);
await check("reception CANNOT change dates", updateDoc(doc(rec, "bookings/b0"), { checkIn: "2030-01-01" }), false);
await check("owner edits booking price", updateDoc(doc(own, "bookings/b0"), { total: 123456, priceEditedBy: "owner1" }), true);
await check("owner applies coupon to confirmed booking (booking+coupon batch)", (async () => { const w = writeBatch(own); w.update(doc(own, "bookings/b0"), { total: 400000, originalTotal: 500000, couponCode: "CX", discountPercent: 30 }); w.update(doc(own, "coupons/CX"), { used: true, usedBy: "owner1", usedAt: new Date(), bookingId: "b0" }); await w.commit(); })(), true);


// ===== Khách tự hủy đặt phòng =====
const cancelBatch = async (db, id, patch) => { const w = writeBatch(db); w.update(doc(db, "bookings", id), patch); w.delete(doc(db, "busy", id)); await w.commit(); };
await check("customer cancels own CONFIRMED online booking (+ busy removed)", cancelBatch(c2, "oc1", { status: "cancelled", cancelReason: "customer" }), true);
await check("customer cancels confirmed booking without a reason", cancelBatch(c2, "oc7", { status: "cancelled" }), true);
await check("customer CANNOT cancel a checked-in booking", cancelBatch(c2, "oc2", { status: "cancelled", cancelReason: "customer" }), false);
await check("customer CANNOT cancel a staff-created booking", cancelBatch(c2, "oc3", { status: "cancelled" }), false);
await check("customer CANNOT cancel someone else's confirmed booking", cancelBatch(c1, "oc5", { status: "cancelled" }), false);
await check("customer CANNOT use another cancelReason", updateDoc(doc(c2, "bookings/oc6"), { status: "cancelled", cancelReason: "expired" }), false);
await check("customer CANNOT change price while cancelling", updateDoc(doc(c2, "bookings/oc8"), { status: "cancelled", total: 0 }), false);
await check("customer CANNOT move confirmed → checked_in", updateDoc(doc(c2, "bookings/oc8"), { status: "checked_in" }), false);
await check("customer CANNOT un-cancel", (async () => { await updateDoc(doc(c2, "bookings/oc6"), { status: "cancelled" }); await updateDoc(doc(c2, "bookings/oc6"), { status: "confirmed" }); })(), false);


// ===== Nội dung trang + cảm nhận =====
const rv = (by, extra = {}) => ({ name: "An", rating: 5, comment: "Rất yên tĩnh và dễ chịu.", status: "pending", createdBy: by, createdAt: new Date(), ...extra });
await env.withSecurityRulesDisabled(async (ctx) => {
  const d = ctx.firestore();
  await setDoc(doc(d, "pages/privacy"), { vi: "x", en: "y" });
  await setDoc(doc(d, "reviews/appr"), rv("someone", { status: "approved" }));
  await setDoc(doc(d, "reviews/pend"), rv("someone2"));
});
const cu = env.authenticatedContext("rv1").firestore();
const cu2 = env.authenticatedContext("rv2").firestore();
await check("anon reads page content", getDoc(doc(anon, "pages/privacy")), true);
await check("anon CANNOT write page content", setDoc(doc(anon, "pages/privacy"), { vi: "hack" }), false);
await check("customer CANNOT write page content", setDoc(doc(cu, "pages/privacy"), { vi: "hack" }), false);
await check("reception CANNOT write page content", setDoc(doc(rec, "pages/faq"), { items: [] }), false);
await check("owner writes page content", setDoc(doc(own, "pages/privacy"), { vi: "mới", en: "new" }), true);
await check("owner writes FAQ", setDoc(doc(own, "pages/faq"), { items: [{ qVi: "a", aVi: "b", qEn: "c", aEn: "d" }] }), true);

await check("anon lists APPROVED reviews", getDocs(query(collection(anon, "reviews"), where("status", "==", "approved"))), true);
await check("anon CANNOT list all reviews", getDocs(collection(anon, "reviews")), false);
await check("anon reads an approved review", getDoc(doc(anon, "reviews/appr")), true);
await check("anon CANNOT read a pending review", getDoc(doc(anon, "reviews/pend")), false);
await check("customer submits own review (id = uid)", setDoc(doc(cu, "reviews/rv1"), { name: "An", rating: 5, comment: "Một kỳ nghỉ rất đáng nhớ.", status: "pending", createdBy: "rv1", createdAt: new Date() }), true);
await check("customer CANNOT submit under another id", setDoc(doc(cu, "reviews/other"), { name: "An", rating: 5, comment: "Một kỳ nghỉ rất đáng nhớ.", status: "pending", createdBy: "rv1", createdAt: new Date() }), false);
await check("customer CANNOT self-approve on create", setDoc(doc(cu2, "reviews/rv2"), { name: "B", rating: 5, comment: "Một kỳ nghỉ rất đáng nhớ.", status: "approved", createdBy: "rv2", createdAt: new Date() }), false);
await check("customer CANNOT post rating 6", setDoc(doc(cu2, "reviews/rv2"), { name: "B", rating: 6, comment: "Một kỳ nghỉ rất đáng nhớ.", status: "pending", createdBy: "rv2", createdAt: new Date() }), false);
await check("customer CANNOT post a too-short comment", setDoc(doc(cu2, "reviews/rv2"), { name: "B", rating: 4, comment: "ok", status: "pending", createdBy: "rv2", createdAt: new Date() }), false);
await check("customer CANNOT post a 700-char comment", setDoc(doc(cu2, "reviews/rv2"), { name: "B", rating: 4, comment: "x".repeat(700), status: "pending", createdBy: "rv2", createdAt: new Date() }), false);
await check("customer CANNOT add extra fields", setDoc(doc(cu2, "reviews/rv2"), { name: "B", rating: 4, comment: "Một kỳ nghỉ rất đáng nhớ.", status: "pending", createdBy: "rv2", createdAt: new Date(), featured: true }), false);
await check("customer reads own pending review", getDoc(doc(cu, "reviews/rv1")), true);
await check("customer can get own (non-existing) review doc", getDoc(doc(cu2, "reviews/rv2")), true);
await check("customer CANNOT read someone else's pending review", getDoc(doc(cu2, "reviews/rv1")), false);
await check("customer lists own reviews", getDocs(query(collection(cu, "reviews"), where("createdBy", "==", "rv1"))), true);
await check("customer edits own review (stays pending)", updateDoc(doc(cu, "reviews/rv1"), { comment: "Đã sửa lại nội dung cảm nhận.", status: "pending" }), true);
await check("customer CANNOT approve own review", updateDoc(doc(cu, "reviews/rv1"), { status: "approved" }), false);
await check("customer CANNOT edit someone else's review", updateDoc(doc(cu2, "reviews/rv1"), { comment: "Sửa trộm cảm nhận của người khác." }), false);
await check("reception CANNOT approve reviews", updateDoc(doc(rec, "reviews/rv1"), { status: "approved" }), false);
await check("owner approves a review", updateDoc(doc(own, "reviews/rv1"), { status: "approved" }), true);
await check("approved review is now public", getDoc(doc(anon, "reviews/rv1")), true);
await check("owner CAN rewrite review text (new rule)", updateDoc(doc(own, "reviews/rv1"), { comment: "Chủ sửa nội dung của khách." }), true);
await check("editing an approved review sends it back to pending", updateDoc(doc(cu, "reviews/rv1"), { comment: "Nội dung mới cần duyệt lại.", status: "pending" }), true);
await check("customer CANNOT keep it approved while editing", (async () => { await updateDoc(doc(own, "reviews/rv1"), { status: "approved" }); await updateDoc(doc(cu, "reviews/rv1"), { comment: "Sửa mà vẫn giữ trạng thái duyệt.", status: "approved" }); })(), false);
await check("owner lists all reviews", getDocs(collection(own, "reviews")), true);
await check("customer deletes own review", deleteDoc(doc(cu, "reviews/rv1")), true);
await check("owner deletes any review", deleteDoc(doc(own, "reviews/pend")), true);


// ===== Cài đặt giao diện =====
await check("anon reads settings (theme)", getDoc(doc(anon, "settings/app")), true);
await check("owner sets a valid theme", setDoc(doc(own, "settings/app"), { theme: "noel", themeAuto: true, effects: false }, { merge: true }), true);
await check("owner CANNOT set an unknown theme", setDoc(doc(own, "settings/app"), { theme: "neon" }, { merge: true }), false);
await check("owner CANNOT set themeAuto to a string", setDoc(doc(own, "settings/app"), { themeAuto: "yes" }, { merge: true }), false);
await check("owner CANNOT set effects to a number", setDoc(doc(own, "settings/app"), { effects: 1 }, { merge: true }), false);
await check("owner can still save the USD rate alone", setDoc(doc(own, "settings/app"), { usdRate: 26000 }, { merge: true }), true);
await check("reception CANNOT change the theme", setDoc(doc(rec, "settings/app"), { theme: "mist" }, { merge: true }), false);
await check("customer CANNOT change the theme", setDoc(doc(c2, "settings/app"), { theme: "mist" }, { merge: true }), false);
await check("anon CANNOT change the theme", setDoc(doc(anon, "settings/app"), { theme: "mist" }, { merge: true }), false);

// Chỉ chủ được hoàn tác trả phòng / khôi phục đặt phòng đã hủy
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "users/mgr1"), { role: "manager", email: "m@x" });
  for (const [id, st] of [["rs1", "checked_out"], ["rs2", "cancelled"], ["rs3", "checked_out"], ["rs4", "cancelled"], ["rs5", "confirmed"]])
    await setDoc(doc(db, "bookings/" + id), { roomId: "r1", guestName: "X", phone: "1", checkIn: "2026-12-20", checkOut: "2026-12-22", status: st, createdBy: "cust2", total: 1 });
});
const mgr = env.authenticatedContext("mgr1").firestore();
await check("manager CANNOT undo check-out", updateDoc(doc(mgr, "bookings/rs1"), { status: "checked_in" }), false);
await check("manager CANNOT restore a cancelled booking", updateDoc(doc(mgr, "bookings/rs2"), { status: "confirmed" }), false);
await check("reception CANNOT undo check-out", updateDoc(doc(rec, "bookings/rs3"), { status: "checked_in" }), false);
await check("reception CANNOT restore a cancelled booking", updateDoc(doc(rec, "bookings/rs4"), { status: "confirmed" }), false);
await check("owner CAN undo check-out", updateDoc(doc(own, "bookings/rs1"), { status: "checked_in" }), true);
await check("owner CAN restore a cancelled booking", updateDoc(doc(own, "bookings/rs2"), { status: "confirmed" }), true);
await check("manager can still check out a live booking", updateDoc(doc(mgr, "bookings/rs5"), { status: "checked_out" }), true);

// ===== Giới hạn số yêu cầu đang chờ mỗi tài khoản (khe pend/{uid}_{n}) =====
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "settings/app"), { maxPending: 2 }, { merge: true }); await setDoc(doc(ctx.firestore(), "users/lim1"), { role: "customer", email: "l@x" }); });
const lim = env.authenticatedContext("lim1").firestore();
const lb = { ...good, createdBy: "lim1" };
const mkSlot = async (id, n, patch = {}, slotPatch = {}, uid = "lim1", db = lim) => { const w = writeBatch(db); w.set(doc(db, "pend", `${uid}_${n}`), { uid, n, bookingId: id, ...slotPatch }); w.set(doc(db, "bookings", id), { ...lb, slotId: `${uid}_${n}`, ...patch }); w.set(doc(db, "busy", id), busyDoc); await w.commit(); };
await check("limit: 1st pending request ok", mkSlot("l1", 1), true);
await check("limit: 2nd pending request ok", mkSlot("l2", 2), true);
await check("limit: 3rd request (slot 3 > max 2) denied", mkSlot("l3", 3), false);
await check("limit: reusing taken slot 1 denied", mkSlot("l4", 1), false);
await check("limit: booking without a slot denied", (async () => { const w = writeBatch(lim); w.set(doc(lim, "bookings/l5"), lb); w.set(doc(lim, "busy/l5"), busyDoc); await w.commit(); })(), false);
await check("limit: customer CANNOT free a slot of a still-pending booking", deleteDoc(doc(lim, "pend/lim1_1")), false);
await check("limit: customer lists own slots", getDocs(query(collection(lim, "pend"), where("uid", "==", "lim1"))), true);
await check("limit: customer CANNOT read others' slots", getDocs(query(collection(c2, "pend"), where("uid", "==", "lim1"))), false);
await check("limit: customer cancels own pending + frees slot", (async () => { const w = writeBatch(lim); w.update(doc(lim, "bookings/l1"), { status: "cancelled", cancelReason: "customer" }); w.delete(doc(lim, "busy/l1")); w.delete(doc(lim, "pend/lim1_1")); await w.commit(); })(), true);
await check("limit: after cancel the freed slot can be reused", mkSlot("l6", 1), true);
await check("limit: staff can release a slot", deleteDoc(doc(rec, "pend/lim1_2")), true);
await check("limit: slot id must match uid_n", mkSlot("l7", 2, {}, { n: 1 }), false);
await check("limit: cannot take a slot under another uid", mkSlot("l8", 1, {}, { uid: "cust2" }, "cust2"), false);
await check("limit: owner raises the limit to 5", setDoc(doc(own, "settings/app"), { maxPending: 5 }, { merge: true }), true);
await check("limit: invalid maxPending 0 rejected", setDoc(doc(own, "settings/app"), { maxPending: 0 }, { merge: true }), false);
await check("limit: customer CANNOT change maxPending", setDoc(doc(lim, "settings/app"), { maxPending: 99 }, { merge: true }), false);

// ===== Phân quyền: quản lý không cấp "Chủ"/"Quản lý" =====
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "users/mgr2"), { role: "manager", email: "m2@x" });
  await setDoc(doc(db, "users/stf1"), { role: "customer", email: "s1@x" });
  await setDoc(doc(db, "users/stf2"), { role: "customer", email: "s2@x" });
  await setDoc(doc(db, "users/stf3"), { role: "reception", email: "s3@x" });
});
await check("manager CAN make a customer reception", updateDoc(doc(mgr, "users/stf1"), { role: "reception" }), true);
await check("manager CAN change reception to housekeeping", updateDoc(doc(mgr, "users/stf1"), { role: "housekeeping" }), true);
await check("manager CANNOT grant manager", updateDoc(doc(mgr, "users/stf2"), { role: "manager" }), false);
await check("manager CANNOT grant owner", updateDoc(doc(mgr, "users/stf2"), { role: "owner" }), false);
await check("manager CANNOT demote another manager", updateDoc(doc(mgr, "users/mgr2"), { role: "reception" }), false);
await check("manager CANNOT touch the owner", updateDoc(doc(mgr, "users/owner1"), { role: "customer" }), false);
await check("owner CAN grant manager", updateDoc(doc(own, "users/stf2"), { role: "manager" }), true);
await check("owner CAN demote a manager", updateDoc(doc(own, "users/mgr2"), { role: "reception" }), true);

// ===== Chủ sửa nội dung cảm nhận =====
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "reviews/edr"), { name: "An", rating: 5, comment: "Một kỳ nghỉ rất đáng nhớ.", status: "approved", createdBy: "cust2", createdAt: new Date() }); });
await check("owner CAN edit an approved review's content", updateDoc(doc(own, "reviews/edr"), { name: "An B", rating: 4, comment: "Nội dung đã được chủ chỉnh sửa lại." }), true);
await check("owner edit keeps status approved", (async () => { const s = await getDoc(doc(own, "reviews/edr")); if (s.data().status !== "approved") throw new Error("status changed"); })(), true);
await check("owner CANNOT save a too-short comment", updateDoc(doc(own, "reviews/edr"), { comment: "ngắn" }), false);
await check("owner CANNOT edit content and status together", updateDoc(doc(own, "reviews/edr"), { comment: "Nội dung hợp lệ dài đủ rồi.", status: "rejected" }), false);
await check("manager CANNOT edit review content", updateDoc(doc(mgr, "reviews/edr"), { comment: "Quản lý sửa nội dung cảm nhận." }), false);
await check("manager can still change review status", updateDoc(doc(mgr, "reviews/edr"), { status: "pending" }), true);

// ===== Bot Telegram: tgChats =====
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "tgChats/111"), { uid: "owner1", role: "owner" }); await setDoc(doc(ctx.firestore(), "tgLinks/ABC"), { uid: "owner1", exp: 1 }); await setDoc(doc(ctx.firestore(), "tgSent/x"), { at: 1 }); });
await check("owner reads tgChats", getDocs(collection(own, "tgChats")), true);
await check("manager reads tgChats", getDocs(collection(mgr, "tgChats")), true);
await check("reception CANNOT read tgChats", getDocs(collection(rec, "tgChats")), false);
await check("customer CANNOT read tgChats", getDocs(collection(c1, "tgChats")), false);
await check("owner CAN remove a linked chat", deleteDoc(doc(own, "tgChats/111")), true);
await check("owner CANNOT create tgChats from the client", setDoc(doc(own, "tgChats/999"), { uid: "owner1", role: "owner" }), false);
await check("owner CANNOT read tgLinks (codes)", getDoc(doc(own, "tgLinks/ABC")), false);
await check("owner CANNOT write tgSent", setDoc(doc(own, "tgSent/y"), { at: 1 }), false);

// ===== Thông tin liên hệ (settings/contact) =====
const okc = { phone: "0901234567", zalo: "0901234567", email: "a@x.vn", address: "12 Đường Thông", facebook: "https://facebook.com/nhago", mapUrl: "https://maps.app.goo.gl/abc" };
await check("anon reads contact", getDoc(doc(anon, "settings/contact")), true);
await check("owner saves contact", setDoc(doc(own, "settings/contact"), okc), true);
await check("manager saves contact", setDoc(doc(mgr, "settings/contact"), okc), true);
await check("reception CANNOT save contact", setDoc(doc(rec, "settings/contact"), okc), false);
await check("customer CANNOT save contact", setDoc(doc(c1, "settings/contact"), okc), false);
await check("contact CANNOT have extra fields", setDoc(doc(own, "settings/contact"), { ...okc, evil: "x" }), false);
await check("contact rejects javascript: link", setDoc(doc(own, "settings/contact"), { ...okc, facebook: "javascript:alert(1)" }), false);
await check("contact rejects non-http map link", setDoc(doc(own, "settings/contact"), { ...okc, mapUrl: "ftp://x.y" }), false);
await check("contact allows empty links", setDoc(doc(own, "settings/contact"), { ...okc, facebook: "", mapUrl: "" }), true);
await check("contact rejects 301-char text", setDoc(doc(own, "settings/contact"), { ...okc, address: "x".repeat(301) }), false);
await check("contact rejects non-string phone", setDoc(doc(own, "settings/contact"), { ...okc, phone: 123 }), false);
await check("settings/app still works for owner", setDoc(doc(own, "settings/app"), { usdRate: 25000 }, { merge: true }), true);

// ===== Ca làm & chấm công =====
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "users/hk1"), { role: "housekeeping", email: "h@x" }); await setDoc(doc(ctx.firestore(), "users/hk2"), { role: "housekeeping", email: "h2@x" }); });
const hk1 = env.authenticatedContext("hk1").firestore();
const hk2 = env.authenticatedContext("hk2").firestore();
const sh = { name: "Ca sáng", start: "06:00", end: "14:00", active: true };
await check("owner creates a shift", setDoc(doc(own, "shifts/s1"), sh), true);
await check("manager creates a shift", setDoc(doc(mgr, "shifts/s2"), { ...sh, name: "Ca chiều", start: "14:00", end: "22:00" }), true);
await check("housekeeping CANNOT create a shift", setDoc(doc(hk1, "shifts/s3"), sh), false);
await check("customer CANNOT read shifts", getDoc(doc(c1, "shifts/s1")), false);
await check("housekeeping reads shifts", getDoc(doc(hk1, "shifts/s1")), true);
await check("shift rejects bad time 25:00", setDoc(doc(own, "shifts/s4"), { ...sh, start: "25:00" }), false);
await check("shift rejects extra field", setDoc(doc(own, "shifts/s4"), { ...sh, pay: 1 }), false);
const sc = (date, uid) => ({ date, uid, name: "Hà", shiftId: "s1" });
await check("owner schedules a staff member", setDoc(doc(own, "schedule/2026-12-01_hk1"), sc("2026-12-01", "hk1")), true);
await check("schedule id must match date_uid", setDoc(doc(own, "schedule/wrong"), sc("2026-12-01", "hk1")), false);
await check("housekeeping CANNOT edit schedule", setDoc(doc(hk1, "schedule/2026-12-02_hk1"), sc("2026-12-02", "hk1")), false);
await check("housekeeping reads schedule", getDoc(doc(hk2, "schedule/2026-12-01_hk1")), true);
await check("customer CANNOT read schedule", getDoc(doc(c1, "schedule/2026-12-01_hk1")), false);
await check("owner deletes a schedule entry", deleteDoc(doc(own, "schedule/2026-12-01_hk1")), true);
const att = (uid, extra = {}) => ({ uid, name: "Hà", date: "2026-12-01", in: serverTimestamp(), source: "self", ...extra });
await check("staff clocks in for self", setDoc(doc(hk1, "attendance/a1"), att("hk1")), true);
await check("staff CANNOT clock in for someone else", setDoc(doc(hk1, "attendance/a2"), att("hk2")), false);
await check("staff CANNOT backdate clock-in", setDoc(doc(hk1, "attendance/a3"), att("hk1", { in: Timestamp.fromDate(new Date("2020-01-01")) })), false);
await check("staff CANNOT add extra fields on clock-in", setDoc(doc(hk1, "attendance/a4"), att("hk1", { out: serverTimestamp() })), false);
await check("customer CANNOT clock in", setDoc(doc(c1, "attendance/a5"), att("cust1")), false);
await check("staff reads own attendance", getDoc(doc(hk1, "attendance/a1")), true);
await check("staff CANNOT read others' attendance", getDoc(doc(hk2, "attendance/a1")), false);
await check("staff lists own attendance query", getDocs(query(collection(hk1, "attendance"), where("uid", "==", "hk1"))), true);
await check("staff CANNOT list all attendance", getDocs(collection(hk1, "attendance")), false);
await check("staff CANNOT clock out with a fake time", updateDoc(doc(hk1, "attendance/a1"), { out: Timestamp.fromDate(new Date("2030-01-01")) }), false);
await check("other staff CANNOT clock out for me", updateDoc(doc(hk2, "attendance/a1"), { out: serverTimestamp() }), false);
await check("staff clocks out (server time)", updateDoc(doc(hk1, "attendance/a1"), { out: serverTimestamp() }), true);
await check("staff CANNOT clock out twice / change out", updateDoc(doc(hk1, "attendance/a1"), { out: serverTimestamp() }), false);
await check("staff CANNOT change the clock-in time", updateDoc(doc(hk1, "attendance/a1"), { in: serverTimestamp() }), false);
await check("staff CANNOT delete attendance", deleteDoc(doc(hk1, "attendance/a1")), false);
await check("manager reads all attendance", getDocs(collection(mgr, "attendance")), true);
await check("manager adds a manual entry", setDoc(doc(mgr, "attendance/a6"), { uid: "hk2", name: "Lan", date: "2026-12-02", in: Timestamp.fromDate(new Date("2026-12-02T01:00:00Z")), out: Timestamp.fromDate(new Date("2026-12-02T09:00:00Z")), source: "admin", editedBy: "mgr1" }), true);
await check("manager edits an entry", updateDoc(doc(mgr, "attendance/a1"), { out: Timestamp.fromDate(new Date("2026-12-01T09:00:00Z")), editedBy: "mgr1" }), true);
await check("manager deletes an entry", deleteDoc(doc(mgr, "attendance/a6")), true);
await check("reception CANNOT read all attendance", getDocs(collection(rec, "attendance")), false);

// ===== Hồ sơ cá nhân (profiles) & check-in online (precheckins) =====
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "bookings/pc1"), { roomId: "r1", guestName: "An", phone: "1", checkIn: "2026-12-20", checkOut: "2026-12-22", guests: 1, total: 1, status: "pending", source: "online", createdBy: "cust2" });
  await setDoc(doc(db, "bookings/pc2"), { roomId: "r1", guestName: "B", phone: "1", checkIn: "2026-12-20", checkOut: "2026-12-22", guests: 1, total: 1, status: "checked_in", source: "online", createdBy: "cust2" });
  await setDoc(doc(db, "users/cust2"), { role: "customer", email: "c2@x" });
});
const pf = { fullName: "An", docType: "cccd", docNumber: "079123456789", nationality: "Việt Nam", dob: "1990-01-01", phone: "090", email: "a@x" };
await check("user saves own profile", setDoc(doc(c2, "profiles/cust2"), pf), true);
await check("user reads own profile", getDoc(doc(c2, "profiles/cust2")), true);
await check("user CANNOT read another's profile", getDoc(doc(c1, "profiles/cust2")), false);
await check("user CANNOT edit another's profile", setDoc(doc(c1, "profiles/cust2"), pf), false);
await check("manager CANNOT edit another's profile", setDoc(doc(mgr, "profiles/cust2"), pf), false);
await check("reception CAN read profiles", getDoc(doc(rec, "profiles/cust2")), true);
await check("owner CAN edit anyone's profile", setDoc(doc(own, "profiles/cust2"), { ...pf, fullName: "An (chủ sửa)" }), true);
await check("profile rejects extra field", setDoc(doc(c2, "profiles/cust2"), { ...pf, role: "owner" }), false);
await check("profile rejects bad docType", setDoc(doc(c2, "profiles/cust2"), { ...pf, docType: "x" }), false);
await check("profile rejects 101-char name", setDoc(doc(c2, "profiles/cust2"), { ...pf, fullName: "x".repeat(101) }), false);
await check("anon CANNOT read profiles", getDoc(doc(anon, "profiles/cust2")), false);
await check("owner deletes a profile", deleteDoc(doc(own, "profiles/cust2")), true);
const pre = (extra = {}) => ({ uid: "cust2", bookingId: "pc1", fullName: "An", docType: "cccd", docNumber: "079123456789", nationality: "Việt Nam", dob: "1990-01-01", phone: "090", email: "a@x", eta: "15:30", note: "", status: "submitted", ...extra });
await check("customer submits online check-in for own booking", setDoc(doc(c2, "precheckins/pc1"), pre()), true);
await check("customer CANNOT check in for someone else's booking", setDoc(doc(c1, "precheckins/pc1x"), pre({ uid: "cust1", bookingId: "pc1x" })), false);
await check("check-in id must equal bookingId", setDoc(doc(c2, "precheckins/zzz"), pre()), false);
await check("check-in rejects bad ETA", setDoc(doc(c2, "precheckins/pc1"), pre({ eta: "25:99" })), false);
await check("customer edits own check-in while pending", setDoc(doc(c2, "precheckins/pc1"), pre({ eta: "16:00" })), true);
await check("customer CANNOT mark own check-in imported", updateDoc(doc(c2, "precheckins/pc1"), { status: "imported" }), false);
await check("customer reads own check-in", getDoc(doc(c2, "precheckins/pc1")), true);
await check("other customer CANNOT read it", getDoc(doc(c1, "precheckins/pc1")), false);
await check("reception reads check-ins", getDoc(doc(rec, "precheckins/pc1")), true);
await check("reception marks check-in imported", updateDoc(doc(rec, "precheckins/pc1"), { status: "imported" }), true);
await check("customer CANNOT edit after imported", setDoc(doc(c2, "precheckins/pc1"), pre({ eta: "17:00" })), false);
await check("reception CANNOT change other check-in fields", updateDoc(doc(rec, "precheckins/pc1"), { docNumber: "X" }), false);
await check("customer CANNOT check in once the guest has checked in", setDoc(doc(c2, "precheckins/pc2"), pre({ bookingId: "pc2" })), true);
await check("customer CANNOT edit check-in after booking is checked_in", setDoc(doc(c2, "precheckins/pc2"), pre({ bookingId: "pc2", eta: "18:00" })), false);

// ===== Bảng giá, cọc, tài khoản ngân hàng, thanh toán =====
const pr = { weekendDays: [5, 6], weekendPercent: 20, seasons: [], holidays: [], longStay: [{ minNights: 3, percent: -5 }] };
const bc = { depositPercent: 30, checkInTime: "14:00", checkOutTime: "12:00", cancelTiers: [{ daysBefore: 7, refundPercent: 100 }], cancelNote: "", extraGuestFee: 100000, earlyCheckInFee: 0, lateCheckOutFee: 0, services: [] };
const bank = { bankBin: "970436", bankName: "Vietcombank", accountNo: "0123456789", accountName: "NGUYEN VAN A" };
await check("anon reads pricing", getDoc(doc(anon, "settings/pricing")), true);
await check("anon reads booking policy", getDoc(doc(anon, "settings/booking")), true);
await check("manager saves pricing", setDoc(doc(mgr, "settings/pricing"), pr), true);
await check("manager saves booking policy", setDoc(doc(mgr, "settings/booking"), bc), true);
await check("reception CANNOT save pricing", setDoc(doc(rec, "settings/pricing"), pr), false);
await check("pricing rejects extra field", setDoc(doc(own, "settings/pricing"), { ...pr, secret: 1 }), false);
await check("pricing rejects weekend +500%", setDoc(doc(own, "settings/pricing"), { ...pr, weekendPercent: 500 }), false);
await check("booking policy rejects deposit 120%", setDoc(doc(own, "settings/booking"), { ...bc, depositPercent: 120 }), false);
await check("booking policy rejects bad time", setDoc(doc(own, "settings/booking"), { ...bc, checkInTime: "25:00" }), false);
await check("booking policy rejects negative fee", setDoc(doc(own, "settings/booking"), { ...bc, extraGuestFee: -1 }), false);
await check("anon CANNOT read bank account", getDoc(doc(anon, "settings/bank")), false);
await check("owner saves bank account", setDoc(doc(own, "settings/bank"), bank), true);
await check("manager CANNOT save bank account", setDoc(doc(mgr, "settings/bank"), bank), false);
await check("signed-in user reads bank account (to pay deposit)", getDoc(doc(c1, "settings/bank")), true);
await check("bank rejects bad BIN", setDoc(doc(own, "settings/bank"), { ...bank, bankBin: "12" }), false);
await check("bank rejects extra field", setDoc(doc(own, "settings/bank"), { ...bank, x: 1 }), false);
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "bookings/pay1"), { roomId: "r1", guestName: "P", phone: "1", checkIn: "2026-12-25", checkOut: "2026-12-27", guests: 1, total: 1000000, status: "checked_out", source: "online", createdBy: "cust2", deposit: 300000 }); await setDoc(doc(ctx.firestore(), "bookings/pay2"), { roomId: "r1", guestName: "P", phone: "1", checkIn: "2026-12-25", checkOut: "2026-12-27", guests: 1, total: 1000000, status: "confirmed", source: "online", createdBy: "cust2", deposit: 300000 }); });
await check("reception records a payment on a confirmed booking", updateDoc(doc(rec, "bookings/pay2"), { paid: 300000, payLog: [{ amount: 300000, at: Timestamp.now(), by: "recep1", note: "cọc" }] }), true);
await check("reception records a payment even after check-out", updateDoc(doc(rec, "bookings/pay1"), { paid: 1000000, payLog: [] }), true);
await check("reception CANNOT change total with payment", updateDoc(doc(rec, "bookings/pay2"), { paid: 1, total: 1 }), false);
await check("customer CANNOT record own payment", updateDoc(doc(c2, "bookings/pay2"), { paid: 1000000 }), false);
await check("customer cancels own booking with cancelledAt = server time", updateDoc(doc(c2, "bookings/pay2"), { status: "cancelled", cancelReason: "customer", cancelledAt: serverTimestamp() }), true);
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "bookings/pay3"), { roomId: "r1", guestName: "P", phone: "1", checkIn: "2026-12-25", checkOut: "2026-12-27", guests: 1, total: 1000000, status: "confirmed", source: "online", createdBy: "cust2" }); });
await check("customer CANNOT backdate cancelledAt", updateDoc(doc(c2, "bookings/pay3"), { status: "cancelled", cancelReason: "customer", cancelledAt: Timestamp.fromDate(new Date("2020-01-01")) }), false);
await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "users/lnu"), { role: "customer", email: "ln@x" }); await setDoc(doc(ctx.firestore(), "settings/app"), { maxPending: 5 }, { merge: true }); });
const lnu = env.authenticatedContext("lnu").firestore();
const mkL = (id, n, patch) => { const w = writeBatch(lnu); w.set(doc(lnu, "pend", `lnu_${n}`), { uid: "lnu", n, bookingId: id }); w.set(doc(lnu, "bookings", id), { ...good, createdBy: "lnu", slotId: `lnu_${n}`, ...patch }); w.set(doc(lnu, "busy", id), busyDoc); return w.commit(); };
await check("online booking create accepts lines + deposit", mkL("ln1", 1, { lines: [{ label: "Phòng × 2 đêm", amount: 1000000 }], deposit: 300000 }), true);
await check("online booking create rejects deposit above total", mkL("ln2", 2, { deposit: 2000000 }), false);
await check("online booking create rejects 31 lines", mkL("ln3", 2, { lines: Array.from({ length: 31 }, () => ({ label: "x", amount: 1 })) }), false);

// ===== Thành viên thân thiết, buồng phòng, chi phí, sao lưu =====
await env.withSecurityRulesDisabled(async (ctx) => { const db = ctx.firestore(); await setDoc(doc(db, "users/hk1"), { role: "housekeeping", email: "h@x" }); await setDoc(doc(db, "coupons/MB-PERS"), { percent: 10, used: false, ownerUid: "cust2", note: "Hạng Bạc" }); await setDoc(doc(db, "members/cust2"), { tier: "gold", claimed: { silver: "MB-PERS" } }); });
const tiersCfg = { enabled: true, tiers: [{ id: "bronze", name: "Đồng", color: "#cd7f32", minBookings: 0, couponPercent: 0 }] };
await check("anon reads loyalty config", getDoc(doc(anon, "settings/loyalty")), true);
await check("manager saves loyalty config", setDoc(doc(mgr, "settings/loyalty"), tiersCfg), true);
await check("reception CANNOT save loyalty config", setDoc(doc(rec, "settings/loyalty"), tiersCfg), false);
await check("loyalty config rejects extra field", setDoc(doc(own, "settings/loyalty"), { ...tiersCfg, x: 1 }), false);
await check("member reads own tier doc", getDoc(doc(c2, "members/cust2")), true);
await check("another customer CANNOT read it", getDoc(doc(c1, "members/cust2")), false);
await check("reception reads member tiers", getDoc(doc(rec, "members/cust2")), true);
await check("manager CANNOT set a member tier (owner only)", setDoc(doc(mgr, "members/cust2"), { tier: "silver", updatedAt: Timestamp.now(), updatedBy: "mgr1" }, { merge: true }), false);
await check("owner sets a member tier manually", setDoc(doc(own, "members/cust2"), { tier: "silver", updatedAt: Timestamp.now(), updatedBy: "o" }, { merge: true }), true);
await check("customer CANNOT set own tier", setDoc(doc(c2, "members/cust2"), { tier: "diamond" }), false);
await check("reception CANNOT set tiers", setDoc(doc(rec, "members/cust2"), { tier: "diamond" }), false);
await check("personal coupon: other customer CANNOT redeem it", (async () => { const w = writeBatch(c1); w.set(doc(c1, "bookings/pc9"), { ...good, createdBy: "cust1", couponCode: "MB-PERS", discountPercent: 10, originalTotal: 1000000, slotId: "cust1_77" }); w.set(doc(c1, "pend/cust1_77"), { uid: "cust1", n: 1, bookingId: "pc9" }); w.set(doc(c1, "busy/pc9"), busyDoc); w.update(doc(c1, "coupons/MB-PERS"), { used: true, usedBy: "cust1", usedAt: new Date(), bookingId: "pc9" }); await w.commit(); })(), false);
await check("housekeeping sets a room dirty", setDoc(doc(hk1, "roomStatus/r1"), { status: "dirty", updatedAt: Timestamp.now(), updatedBy: "hk1", updatedByName: "Hà" }), true);
await check("housekeeping marks it ready", setDoc(doc(hk1, "roomStatus/r1"), { status: "ready", updatedAt: Timestamp.now(), updatedBy: "hk1", updatedByName: "Hà" }), true);
await check("room status rejects unknown status", setDoc(doc(hk1, "roomStatus/r1"), { status: "wow" }), false);
await check("room status rejects extra field", setDoc(doc(hk1, "roomStatus/r1"), { status: "ready", secret: 1 }), false);
await check("customer CANNOT read room status", getDoc(doc(c1, "roomStatus/r1")), false);
await check("customer CANNOT write room status", setDoc(doc(c1, "roomStatus/r1"), { status: "ready" }), false);
await check("housekeeping CANNOT delete room status", deleteDoc(doc(hk1, "roomStatus/r1")), false);
const ex = { date: "2026-11-03", category: "electric", amount: 1200000, vendor: "EVN", note: "", paid: false, dueDate: "2026-11-20", createdBy: "owner1" };
await check("manager saves an expense", setDoc(doc(mgr, "expenses/e1"), ex), true);
await check("reception CANNOT read expenses", getDocs(collection(rec, "expenses")), false);
await check("reception CANNOT write expenses", setDoc(doc(rec, "expenses/e2"), ex), false);
await check("expense rejects bad category", setDoc(doc(own, "expenses/e3"), { ...ex, category: "yacht" }), false);
await check("expense rejects negative amount", setDoc(doc(own, "expenses/e3"), { ...ex, amount: -5 }), false);
await check("expense rejects bad date", setDoc(doc(own, "expenses/e3"), { ...ex, date: "hôm nay" }), false);
await check("manager marks expense paid", setDoc(doc(mgr, "expenses/e1"), { ...ex, paid: true, paidAt: "2026-11-05" }), true);
await check("owner saves backup settings", setDoc(doc(own, "settings/backup"), { enabled: true, frequency: "daily", keep: 14 }), true);
await check("manager CANNOT change backup settings", setDoc(doc(mgr, "settings/backup"), { enabled: false, frequency: "daily", keep: 14 }), false);
await check("manager reads backup settings", getDoc(doc(mgr, "settings/backup")), true);
await check("backup settings reject keep=0", setDoc(doc(own, "settings/backup"), { enabled: true, frequency: "daily", keep: 0 }), false);
await check("nobody writes backup status from the client", setDoc(doc(own, "settings/backupStatus"), { ok: true }), false);
await check("booking create accepts a code", (async () => { const w = writeBatch(lnu); w.set(doc(lnu, "pend", "lnu_3"), { uid: "lnu", n: 3, bookingId: "cd1" }); w.set(doc(lnu, "bookings", "cd1"), { ...good, createdBy: "lnu", slotId: "lnu_3", code: "ABCD1234" }); w.set(doc(lnu, "busy", "cd1"), busyDoc); await w.commit(); })(), true);
await check("booking create rejects a lowercase code", (async () => { const w = writeBatch(lnu); w.set(doc(lnu, "pend", "lnu_4"), { uid: "lnu", n: 4, bookingId: "cd2" }); w.set(doc(lnu, "bookings", "cd2"), { ...good, createdBy: "lnu", slotId: "lnu_4", code: "abcd1234" }); w.set(doc(lnu, "busy", "cd2"), busyDoc); await w.commit(); })(), false);

// ----- Phòng: ảnh và giới thiệu -----
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "rooms/rp1"), { name: "Phòng ảnh", type: "wood", capacity: 2, price: 500000, status: "active" }); });
const roomBase = { name: "Phòng ảnh", type: "wood", capacity: 2, price: 500000, status: "active" };
await check("manager adds photos + description to a room", updateDoc(doc(mgr, "rooms/rp1"), { photos: ["https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg"], desc: "Phòng yên tĩnh", features: "Wifi\nBếp" }), true);
await check("anyone reads the room", getDoc(doc(anon, "rooms/rp1")), true);
await check("reception CANNOT edit rooms", updateDoc(doc(rec, "rooms/rp1"), { desc: "x" }), false);
await check("room rejects more than 8 photos", setDoc(doc(mgr, "rooms/rp1"), { ...roomBase, photos: Array(9).fill("https://x.y/a.jpg") }), false);
await check("room rejects an unknown field", setDoc(doc(mgr, "rooms/rp1"), { ...roomBase, hacked: true }), false);
await check("room rejects an over-long description", setDoc(doc(mgr, "rooms/rp1"), { ...roomBase, desc: "x".repeat(3001) }), false);

// ----- Email khách, Telegram khách -----
await check("owner turns guest email on", setDoc(doc(own, "settings/mail"), { enabled: true, fromName: "Nhà Gỗ", replyTo: "a@x.vn" }), true);
await check("manager reads the mail setting", getDoc(doc(mgr, "settings/mail")), true);
await check("manager CANNOT change the mail setting", setDoc(doc(mgr, "settings/mail"), { enabled: false }), false);
await check("mail setting rejects unknown fields", setDoc(doc(own, "settings/mail"), { enabled: true, smtpPass: "x" }), false);
await check("customer CANNOT read the mail setting", getDoc(doc(c1, "settings/mail")), false);
await check("nobody reads mailState from the client", getDoc(doc(own, "settings/mailState")), false);
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "tgGuests/555"), { uid: "cust1" }); });
await check("customer reads own Telegram link (query by uid)", getDocs(query(collection(c1, "tgGuests"), where("uid", "==", "cust1"))), true);
await check("customer CANNOT read someone else's Telegram link", getDocs(query(collection(c1, "tgGuests"), where("uid", "==", "cust2"))), false);
await check("customer CANNOT write a Telegram link", setDoc(doc(c1, "tgGuests/666"), { uid: "cust1" }), false);

// ----- Thông báo đẩy -----
const pushDoc = { uid: "recep1", ua: "Chrome", at: serverTimestamp() };
await check("reception registers a push token for themselves", setDoc(doc(rec, "fcmTokens/tokA"), pushDoc), true);
await check("reception reads back their own token", getDoc(doc(rec, "fcmTokens/tokA")), true);
await check("another staff CANNOT read it", getDoc(doc(mgr, "fcmTokens/tokA")), false);
await check("cannot register a token for another user", setDoc(doc(rec, "fcmTokens/tokB"), { ...pushDoc, uid: "mgr1" }), false);
await check("customer CANNOT register a push token", setDoc(doc(c1, "fcmTokens/tokC"), { ...pushDoc, uid: "cust1" }), false);
await check("token rejects extra fields", setDoc(doc(rec, "fcmTokens/tokD"), { ...pushDoc, role: "owner" }), false);
await check("nobody lists tokens", getDocs(collection(own, "fcmTokens")), false);
await check("owner of the token deletes it", deleteDoc(doc(rec, "fcmTokens/tokA")), true);

// ----- Gửi email hàng loạt -----
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "mailCampaigns/c1"), { subject: "x", sent: 1 }); });
await check("manager reads the campaign history", getDoc(doc(mgr, "mailCampaigns/c1")), true);
await check("reception CANNOT read the campaign history", getDoc(doc(rec, "mailCampaigns/c1")), false);
await check("nobody writes campaign history from the client", setDoc(doc(own, "mailCampaigns/c2"), { subject: "x" }), false);

// ----- Khách không đến -----
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "bookings/ns1"), { roomId: "r1", guestName: "X", phone: "1", checkIn: "2026-01-01", checkOut: "2026-01-02", guests: 1, total: 1, status: "confirmed", note: "", source: "online", createdBy: "cust1" }); });
await check("reception marks a confirmed booking as no-show", updateDoc(doc(rec, "bookings/ns1"), { status: "cancelled", cancelReason: "noshow" }), true);
await check("nobody reopens a cancelled/no-show booking except the owner (reception blocked)", updateDoc(doc(rec, "bookings/ns1"), { status: "confirmed" }), false);
await check("customer CANNOT label their cancellation as no-show", (async () => { await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "bookings/ns2"), { roomId: "r1", guestName: "X", phone: "1", checkIn: "2026-01-01", checkOut: "2026-01-02", guests: 1, total: 1, status: "confirmed", note: "", source: "online", createdBy: "cust1" }); }); await updateDoc(doc(c1, "bookings/ns2"), { status: "cancelled", cancelReason: "noshow" }); })(), false);

// ----- Ngôn ngữ mặc định -----
await check("manager sets the default website language", setDoc(doc(mgr, "settings/app"), { defaultLang: "en" }, { merge: true }), true);
await check("default language only accepts vi or en", setDoc(doc(mgr, "settings/app"), { defaultLang: "fr" }, { merge: true }), false);
await check("reception CANNOT change the default language", setDoc(doc(rec, "settings/app"), { defaultLang: "vi" }, { merge: true }), false);
await check("anyone reads the app settings (default language)", getDoc(doc(anon, "settings/app")), true);

// ----- Trả phòng sớm -----
const stay = { roomId: "r1", guestName: "X", phone: "1", checkIn: "2026-06-01", checkOut: "2026-06-05", guests: 1, total: 1, note: "", source: "staff", createdBy: "mgr1" };
const seedStay = async (id, extra = {}) => env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "bookings", id), { ...stay, status: "checked_in", ...extra }); });
await seedStay("ec1"); await seedStay("ec2"); await seedStay("ec3"); await seedStay("ec4");
await check("reception checks out early: shortens check-out and keeps the planned date", updateDoc(doc(rec, "bookings/ec1"), { status: "checked_out", checkOut: "2026-06-03", plannedCheckOut: "2026-06-05", earlyCheckout: true }), true);
await check("early check-out cannot extend the stay", updateDoc(doc(rec, "bookings/ec2"), { status: "checked_out", checkOut: "2026-06-09", plannedCheckOut: "2026-06-05", earlyCheckout: true }), false);
await check("early check-out cannot end before check-in", updateDoc(doc(rec, "bookings/ec3"), { status: "checked_out", checkOut: "2026-05-30", plannedCheckOut: "2026-06-05", earlyCheckout: true }), false);
await check("early check-out must record the true planned date", updateDoc(doc(rec, "bookings/ec4"), { status: "checked_out", checkOut: "2026-06-03", plannedCheckOut: "2026-06-04", earlyCheckout: true }), false);
await check("reception CANNOT change dates without checking out", updateDoc(doc(rec, "bookings/ec4"), { checkOut: "2026-06-03", plannedCheckOut: "2026-06-05", earlyCheckout: true }), false);
await check("reception CANNOT slip other fields into an early check-out", updateDoc(doc(rec, "bookings/ec4"), { status: "checked_out", checkOut: "2026-06-03", plannedCheckOut: "2026-06-05", earlyCheckout: true, total: 0 }), false);

// ----- Nhật ký hoạt động, khóa phòng, email xin đánh giá -----
const logDoc = (o = {}) => ({ at: serverTimestamp(), by: "recep1", byName: "LT", role: "reception", action: "booking.status", summary: "x", targetType: "booking", targetId: "b", ...o });
await check("staff appends an audit entry under their own uid", addDoc(collection(rec, "auditLog"), logDoc()), true);
await check("audit entry cannot be forged for another user", addDoc(collection(rec, "auditLog"), logDoc({ by: "mgr1" })), false);
await check("audit entry timestamp must be the server time", addDoc(collection(rec, "auditLog"), logDoc({ at: Timestamp.fromDate(new Date("2020-01-01")) })), false);
await check("audit entry rejects extra fields", addDoc(collection(rec, "auditLog"), logDoc({ extra: 1 })), false);
await check("customer CANNOT write audit entries", addDoc(collection(c1, "auditLog"), logDoc({ by: "cust1" })), false);
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "auditLog/a1"), logDoc({ at: Timestamp.now() })); });
await check("manager reads the audit log", getDoc(doc(mgr, "auditLog/a1")), true);
await check("reception CANNOT read the audit log", getDoc(doc(rec, "auditLog/a1")), false);
await check("audit entries cannot be edited", updateDoc(doc(own, "auditLog/a1"), { summary: "đã sửa" }), false);
await check("audit entries cannot be deleted (even by the owner)", deleteDoc(doc(own, "auditLog/a1")), false);
const blk = { roomId: "r1", from: "2026-12-01", to: "2026-12-05", reason: "Sửa mái", createdBy: "mgr1", createdByName: "QL", createdAt: serverTimestamp() };
await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), "rooms/r1"), { name: "P1", type: "wood", capacity: 2, price: 1, status: "active" }); });
await check("manager blocks a room for a date range", setDoc(doc(mgr, "roomBlocks/k1"), blk), true);
await check("reception reads blocks but CANNOT create them", setDoc(doc(rec, "roomBlocks/k2"), blk), false);
await check("reception reads room blocks", getDoc(doc(rec, "roomBlocks/k1")), true);
await check("block needs from < to", setDoc(doc(mgr, "roomBlocks/k3"), { ...blk, from: "2026-12-05" }), false);
await check("block needs an existing room", setDoc(doc(mgr, "roomBlocks/k4"), { ...blk, roomId: "nope" }), false);
await check("customer CANNOT read room blocks", getDoc(doc(c1, "roomBlocks/k1")), false);
await check("blocks cannot be edited, only deleted", updateDoc(doc(mgr, "roomBlocks/k1"), { reason: "x" }), false);
await check("manager unblocks the room", deleteDoc(doc(mgr, "roomBlocks/k1")), true);
await check("owner toggles the review-request email", setDoc(doc(own, "settings/mail"), { enabled: true, reviewRequest: false }), true);
await check("review-request flag must be boolean", setDoc(doc(own, "settings/mail"), { enabled: true, reviewRequest: "no" }), false);

console.log(`\n${pass} passed, ${fail} failed`);
await env.cleanup();
process.exit(fail ? 1 : 0);
