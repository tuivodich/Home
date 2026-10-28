"use strict";
const FRONT = ["owner", "manager", "reception"];

/**
 * Thông báo đẩy (Firebase Cloud Messaging) tới các thiết bị nhân viên đã bật ở Cài đặt.
 * Token lưu ở fcmTokens/{token} (nhân viên tự ghi); khi gửi tra lại vai trò hiện tại và xóa token đã hết hiệu lực.
 */
function createPush({ db, messaging }) {
  return {
    async send({ title, body, url = "/app" }) {
      const snap = await db.collection("fcmTokens").get();
      if (snap.empty) return { sent: 0, removed: 0 };
      const docs = snap.docs.map((d) => ({ token: d.id, uid: d.data().uid }));
      const roles = new Map();
      for (const uid of new Set(docs.map((d) => d.uid))) roles.set(uid, (await db.doc(`users/${uid}`).get()).data()?.role);
      const targets = docs.filter((d) => FRONT.includes(roles.get(d.uid)));
      // Người đã bị hạ quyền: bỏ token.
      await Promise.all(docs.filter((d) => !FRONT.includes(roles.get(d.uid))).map((d) => db.doc(`fcmTokens/${d.token}`).delete()));
      if (!targets.length) return { sent: 0, removed: docs.length };
      const res = await messaging.sendEachForMulticast({
        tokens: targets.map((t) => t.token),
        data: { title: String(title).slice(0, 80), body: String(body).slice(0, 200), url: String(url) },
        webpush: { headers: { Urgency: "high", TTL: "3600" } },
      });
      let removed = docs.length - targets.length;
      await Promise.all(res.responses.map(async (r, i) => {
        const code = r.error?.code ?? "";
        if (!r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code)) { removed++; await db.doc(`fcmTokens/${targets[i].token}`).delete(); }
      }));
      return { sent: res.successCount, removed };
    },
  };
}

module.exports = { createPush };
