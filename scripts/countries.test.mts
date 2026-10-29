import test from "node:test";
import assert from "node:assert/strict";
import { COUNTRIES, matchCountry } from "../src/lib/countries.ts";

test("danh sách quốc gia: đủ, không trùng, tên tiếng Anh ngắn gọn, có Vietnam", () => {
  assert.ok(COUNTRIES.length >= 195 && COUNTRIES.length <= 205, `có ${COUNTRIES.length} mục`);
  assert.equal(new Set(COUNTRIES.map((c) => c.toLowerCase())).size, COUNTRIES.length);
  for (const c of COUNTRIES) assert.ok(c.trim() === c && c.length > 1 && c.length <= 60 && !/[^\x20-\x7e]/.test(c), `tên hợp lệ: ${c}`);
  for (const must of ["Vietnam", "United States", "United Kingdom", "Japan", "South Korea", "China", "Taiwan", "Hong Kong", "Thailand", "France", "Germany", "Australia"]) assert.ok(COUNTRIES.includes(must), must);
});

test("matchCountry nhận ra giá trị nhập tay trước đây", () => {
  assert.equal(matchCountry("Việt Nam"), "Vietnam");
  assert.equal(matchCountry("  viet nam "), "Vietnam");
  assert.equal(matchCountry("VIETNAM"), "Vietnam");
  assert.equal(matchCountry("USA"), "United States");
  assert.equal(matchCountry("United States of America"), "United States");
  assert.equal(matchCountry("uk"), "United Kingdom");
  assert.equal(matchCountry("Korea"), "South Korea");
  assert.equal(matchCountry("Côte d'Ivoire"), "Cote d'Ivoire");
  assert.equal(matchCountry("japan"), "Japan");
  assert.equal(matchCountry("Atlantis"), null);
  assert.equal(matchCountry(""), null);
});
