import { describe, it, expect } from "vitest";
import { passwordSchema } from "@/lib/validation";

describe("passwordSchema", () => {
  it("accepts a valid password", () => {
    const result = passwordSchema.safeParse("SecurePass1");
    expect(result.success).toBe(true);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = passwordSchema.safeParse("Abc1");
    expect(result.success).toBe(false);
  });

  it("rejects passwords longer than 128 characters", () => {
    const result = passwordSchema.safeParse("A1a" + "x".repeat(130));
    expect(result.success).toBe(false);
  });

  it("rejects passwords without an uppercase letter", () => {
    const result = passwordSchema.safeParse("lowercase1");
    expect(result.success).toBe(false);
  });

  it("rejects passwords without a lowercase letter", () => {
    const result = passwordSchema.safeParse("UPPERCASE1");
    expect(result.success).toBe(false);
  });

  it("rejects passwords without a digit", () => {
    const result = passwordSchema.safeParse("NoDigitsHere");
    expect(result.success).toBe(false);
  });

  it("accepts passwords at exactly 8 characters meeting all criteria", () => {
    const result = passwordSchema.safeParse("Secure1!");
    expect(result.success).toBe(true);
  });

  it("includes helpful error messages on failure", () => {
    const result = passwordSchema.safeParse("short");
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message).join(" ");
      expect(messages).toMatch(/8 characters/i);
    }
  });
});
