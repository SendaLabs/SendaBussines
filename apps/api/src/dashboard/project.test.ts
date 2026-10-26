import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarDateInBuenosAires } from "./project.js";

test("today follows the Buenos Aires calendar", () => {
  assert.equal(calendarDateInBuenosAires(new Date("2026-10-07T02:30:00.000Z")), "2026-10-06");
  assert.equal(calendarDateInBuenosAires(new Date("2026-10-07T03:00:00.000Z")), "2026-10-07");
});
