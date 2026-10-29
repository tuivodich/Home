"use strict";
const site = require("./site");

const STATIC = [
  ["/", "weekly", "1.0"], ["/explore", "monthly", "0.8"], ["/reviews", "weekly", "0.7"],
  ["/faq", "monthly", "0.6"], ["/rules", "yearly", "0.4"], ["/privacy", "yearly", "0.3"], ["/sitemap", "monthly", "0.3"],
];
const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** sitemap.xml động: các trang cố định + mỗi phòng một trang /phong/:id (phòng mới tự có, không cần sửa tay). */
async function sitemapXml(db, now = new Date()) {
  const lastmod = now.toISOString().slice(0, 10);
  const rooms = (await db.collection("rooms").get()).docs.map((d) => d.id).sort();
  const url = (path, freq, pri) => `  <url><loc>${x(site.url + path)}</loc><lastmod>${lastmod}</lastmod><changefreq>${freq}</changefreq><priority>${pri}</priority></url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
    ...STATIC.map(([p, f, pr]) => url(p, f, pr)), ...rooms.map((id) => url(`/phong/${encodeURIComponent(id)}`, "weekly", "0.9")),
  ].join("\n")}\n</urlset>\n`;
}

module.exports = { sitemapXml };
