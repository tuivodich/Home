"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { sitemapXml } = require("../sitemap");

if (!getApps().length) initializeApp({ projectId: "demo-nhago" });
const db = getFirestore();

test("sitemap.xml: trang cố định + mỗi phòng một trang, URL đã escape", async () => {
  for (const d of (await db.collection("rooms").get()).docs) await d.ref.delete();
  await db.doc("rooms/roomA").set({ name: "A" });
  await db.doc("rooms/r&2").set({ name: "B" });
  const xml = await sitemapXml(db, new Date("2026-11-10T00:00:00Z"));
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  for (const p of ["/", "/explore", "/reviews", "/faq", "/privacy", "/sitemap"]) assert.ok(xml.includes(`<loc>https://nhago.web.app${p}</loc>`), p);
  assert.ok(xml.includes("<loc>https://nhago.web.app/phong/roomA</loc>"));
  assert.ok(xml.includes("<loc>https://nhago.web.app/phong/r%262</loc>"), "id đặc biệt được mã hóa");
  assert.ok(xml.includes("<lastmod>2026-11-10</lastmod>"));
  assert.ok(!xml.includes("&2<"), "không có ký tự & thô");
});
