import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getStartOfMonth, formatTimeAgo } from "@/lib/utils";

describe("getStartOfMonth", () => {
  it("returns a Date set to the 1st of the current month", () => {
    const result = getStartOfMonth();
    expect(result.getUTCDate()).toBe(1);
  });

  it("returns midnight UTC", () => {
    const result = getStartOfMonth();
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
    expect(result.getUTCMilliseconds()).toBe(0);
  });

  it("always returns a date in the current month and year", () => {
    const result = getStartOfMonth();
    const now = new Date();
    expect(result.getUTCMonth()).toBe(now.getUTCMonth());
    expect(result.getUTCFullYear()).toBe(now.getUTCFullYear());
  });
});

describe("formatTimeAgo", () => {
  beforeEach(() => {
    // Fix "now" to a known timestamp
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-08T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns seconds-level relative time for recent dates", () => {
    const date = new Date("2026-03-08T11:59:30Z"); // 30s ago
    const result = formatTimeAgo(date);
    expect(result).toMatch(/30 seconds ago/i);
  });

  it("returns minutes-level relative time", () => {
    const date = new Date("2026-03-08T11:55:00Z"); // 5 min ago
    const result = formatTimeAgo(date);
    expect(result).toMatch(/5 minutes ago/i);
  });

  it("returns hours-level relative time", () => {
    const date = new Date("2026-03-08T10:00:00Z"); // 2h ago
    const result = formatTimeAgo(date);
    expect(result).toMatch(/2 hours ago/i);
  });

  it("returns days-level relative time", () => {
    const date = new Date("2026-03-05T12:00:00Z"); // 3 days ago
    const result = formatTimeAgo(date);
    expect(result).toMatch(/3 days ago/i);
  });
});
