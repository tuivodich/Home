"use strict";
const crypto = require("node:crypto");

/** Đọc cấu hình hạng (settings/loyalty): bản chạy ở máy chủ, giống src/lib/loyalty.ts. */
function parseLoyalty(d) {
  const tiers = (Array.isArray(d?.tiers) ? d.tiers : []).flatMap((t) =>
    t && typeof t.id === "string" && typeof t.name === "string" && t.id && t.name
      ? [{ id: t.id, name: t.name, minBookings: Math.max(0, Math.floor(Number(t.minBookings) || 0)), couponPercent: Math.min(50, Math.max(0, Number(t.couponPercent) || 0)) }]
      : []).sort((a, b) => a.minBookings - b.minBookings);
  return { enabled: d?.enabled === true, tiers };
}
const tierFor = (count, cfg, manualId) => {
  const manual = manualId ? cfg.tiers.find((t) => t.id === manualId) : undefined;
  return manual ?? [...cfg.tiers].reverse().find((t) => count >= t.minBookings) ?? cfg.tiers[0] ?? null;
};

/** Nhận mã giảm giá riêng của hạng hiện tại: hạng và số lần ở được tính ở máy chủ (khách không tự khai được). */
function createLoyalty({ db, now = () => new Date(), randomCode }) {
  const { Timestamp, FieldValue } = require("firebase-admin/firestore");
  const rand = randomCode ?? (() => crypto.randomBytes(5).toString("base64url").replace(/[-_]/g, "X").slice(0, 6).toUpperCase());
  async function claim(uid) {
    const cfg = parseLoyalty((await db.doc("settings/loyalty").get()).data());
    if (!cfg.enabled || !cfg.tiers.length) throw Object.assign(new Error("Chương trình thành viên chưa bật."), { code: "failed-precondition" });
    const snap = await db.collection("bookings").where("createdBy", "==", uid).get();
    const count = snap.docs.filter((d) => d.data().source === "online" && d.data().status === "checked_out").length;
    const memberRef = db.doc(`members/${uid}`);
    return db.runTransaction(async (tx) => {
      const m = (await tx.get(memberRef)).data() ?? {};
      const tier = tierFor(count, cfg, m.tier);
      if (!tier || tier.couponPercent <= 0) throw Object.assign(new Error("Hạng này chưa có mã giảm giá."), { code: "failed-precondition" });
      const have = m.claimed?.[tier.id];
      if (have) {
        const c = (await tx.get(db.doc(`coupons/${have}`))).data();
        return { code: have, percent: c?.percent ?? tier.couponPercent, expiresAt: c?.expiresAt?.toMillis?.() ?? 0, existing: true };
      }
      const code = `MB-${tier.id.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() || "TIER"}-${rand()}`;
      const expiresAt = now().getTime() + 90 * 86400000;
      tx.create(db.doc(`coupons/${code}`), { percent: tier.couponPercent, used: false, note: `Thành viên hạng ${tier.name}`, ownerUid: uid, source: "loyalty", expiresAt: Timestamp.fromMillis(expiresAt), createdAt: FieldValue.serverTimestamp() });
      tx.set(memberRef, { claimed: { ...(m.claimed ?? {}), [tier.id]: code } }, { merge: true });
      return { code, percent: tier.couponPercent, expiresAt, existing: false };
    });
  }
  return { claim };
}
module.exports = { createLoyalty, parseLoyalty, tierFor };
