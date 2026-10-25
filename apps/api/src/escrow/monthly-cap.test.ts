import assert from "node:assert/strict";
import { test } from "node:test";
import { exceedsMonthlyCap, fundedUsdInUtcMonth } from "./monthly-cap.js";

test("the UTC month ignores unfunded rows and a timestamp that is still the previous UTC day", () => {
  const now = new Date("2026-11-01T00:30:00.000Z");
  const funded = fundedUsdInUtcMonth(
    [
      { amount: 49_000, fundTxHash: "october", fundedAt: "2026-10-31T23:30:00.000Z" },
      { amount: 100, fundTxHash: "november-utc", fundedAt: "2026-10-31T22:00:00-03:00" },
      { amount: 9_999, fundTxHash: null, fundedAt: "2026-11-01T00:00:00.000Z" },
      { amount: 9_999, fundTxHash: "missing-instant", fundedAt: null },
    ],
    now,
  );

  assert.equal(funded, 100);
  assert.equal(exceedsMonthlyCap(0, 50_000, 50_000), false);
  assert.equal(exceedsMonthlyCap(0, 50_001, 50_000), true);
  assert.equal(exceedsMonthlyCap(funded, 49_900, 50_000), false);
  assert.equal(exceedsMonthlyCap(funded, 49_901, 50_000), true);
});
