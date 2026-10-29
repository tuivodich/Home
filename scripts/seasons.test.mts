// node --experimental-strip-types --test scripts/seasons.test.mts
import test from "node:test";
import assert from "node:assert/strict";
import { isHalloweenSeason, isNoelSeason, isTetSeason, seasonTheme } from "../src/lib/seasons.ts";

const d = (s: string) => new Date(`${s}T12:00:00`);

test("Halloween 20/10–01/11", () => {
  assert.equal(isHalloweenSeason(d("2026-10-19")), false);
  assert.equal(isHalloweenSeason(d("2026-10-20")), true);
  assert.equal(isHalloweenSeason(d("2026-10-31")), true);
  assert.equal(isHalloweenSeason(d("2026-11-01")), true);
  assert.equal(isHalloweenSeason(d("2026-11-02")), false);
});

test("Noel 01/12–05/01", () => {
  assert.equal(isNoelSeason(d("2026-11-30")), false);
  assert.equal(isNoelSeason(d("2026-12-01")), true);
  assert.equal(isNoelSeason(d("2027-01-05")), true);
  assert.equal(isNoelSeason(d("2027-01-06")), false);
});

test("Tết 2026: mùng 1 là 17/02; bật từ 21 ngày trước đến 10 ngày sau", () => {
  assert.equal(isTetSeason(d("2026-01-26")), false);  // 22 ngày trước
  assert.equal(isTetSeason(d("2026-01-27")), true);   // 21 ngày trước
  assert.equal(isTetSeason(d("2026-02-17")), true);
  assert.equal(isTetSeason(d("2026-02-27")), true);   // 10 ngày sau
  assert.equal(isTetSeason(d("2026-02-28")), false);
});

test("Tết rơi vào tháng 1 của năm sau (Tết 2028 là 26/01) và năm ngoài bảng thì không bật", () => {
  assert.equal(isTetSeason(d("2028-01-10")), true);
  assert.equal(isTetSeason(d("2027-12-20")), false); // 37 ngày trước
  assert.equal(isTetSeason(d("2040-02-10")), false);
});

test("seasonTheme chọn đúng giao diện theo ngày", () => {
  assert.equal(seasonTheme(d("2026-10-29")), "halloween");
  assert.equal(seasonTheme(d("2026-12-25")), "noel");
  assert.equal(seasonTheme(d("2026-02-10")), "tet");
  assert.equal(seasonTheme(d("2026-06-15")), null);
});
