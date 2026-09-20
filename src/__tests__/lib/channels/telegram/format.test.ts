import { describe, it, expect } from "vitest";
import { toTelegramHtml } from "@/lib/channels/telegram/format";

describe("toTelegramHtml", () => {
  it("converts bold and italic", () => {
    expect(toTelegramHtml("**bold** and *italic*")).toBe("<b>bold</b> and <i>italic</i>");
  });

  it("converts underscore emphasis", () => {
    expect(toTelegramHtml("__bold__ and _italic_")).toBe("<b>bold</b> and <i>italic</i>");
  });

  it("does not mistake bold for two italics", () => {
    // The ordering bug this guards against: **x** consumed as *(*x*)*.
    expect(toTelegramHtml("**x**")).not.toContain("<i>");
  });

  it("leaves mid-word underscores alone", () => {
    // Order numbers and identifiers routinely contain them.
    expect(toTelegramHtml("ORD_001_A")).toBe("ORD_001_A");
  });

  it("escapes the three characters Telegram cares about", () => {
    expect(toTelegramHtml("a < b & c > d")).toBe("a &lt; b &amp; c &gt; d");
  });

  it("escapes before formatting, so injected markup cannot become a tag", () => {
    const result = toTelegramHtml("**<script>alert(1)</script>**");
    expect(result).toBe("<b>&lt;script&gt;alert(1)&lt;/script&gt;</b>");
    expect(result).not.toContain("<script>");
  });

  it("converts inline code and escapes inside it", () => {
    expect(toTelegramHtml("run `a < b` now")).toBe("run <code>a &lt; b</code> now");
  });

  it("does not format inside inline code", () => {
    // Formatting characters inside a code span must survive verbatim.
    expect(toTelegramHtml("`**not bold**`")).toBe("<code>**not bold**</code>");
  });

  it("converts a fenced code block and drops the language tag", () => {
    expect(toTelegramHtml("```js\nconst a = 1;\n```")).toBe("<pre>const a = 1;</pre>");
  });

  it("does not format inside a code block", () => {
    expect(toTelegramHtml("```\n**x** and <b>y</b>\n```")).toBe(
      "<pre>**x** and &lt;b&gt;y&lt;/b&gt;</pre>"
    );
  });

  it("turns headings into bold, since Telegram has no heading", () => {
    expect(toTelegramHtml("## Order details")).toBe("<b>Order details</b>");
  });

  it("turns list markers into bullets", () => {
    expect(toTelegramHtml("- one\n- two")).toBe("• one\n• two");
  });

  it("keeps list indentation", () => {
    expect(toTelegramHtml("  - nested")).toBe("  • nested");
  });

  it("formats inside a list item", () => {
    expect(toTelegramHtml("- **Status:** delivered")).toBe("• <b>Status:</b> delivered");
  });

  it("converts links", () => {
    expect(toTelegramHtml("[the order](https://example.com/x)")).toBe(
      '<a href="https://example.com/x">the order</a>'
    );
  });

  it("refuses a non-http scheme in a link", () => {
    // Left as literal text rather than turned into an anchor.
    const result = toTelegramHtml("[click](javascript:alert(1))");
    expect(result).not.toContain("<a ");
  });

  it("handles a realistic agent reply", () => {
    const reply = [
      "Your order **ORD-001** has been **delivered**.",
      "",
      "- **Product:** Wireless Headphones",
      "- **Price:** $299.99",
      "",
      "Tracking: `1Z999AA10123456784`",
    ].join("\n");

    expect(toTelegramHtml(reply)).toBe(
      [
        "Your order <b>ORD-001</b> has been <b>delivered</b>.",
        "",
        "• <b>Product:</b> Wireless Headphones",
        "• <b>Price:</b> $299.99",
        "",
        "Tracking: <code>1Z999AA10123456784</code>",
      ].join("\n")
    );
  });

  it("passes plain text through untouched", () => {
    expect(toTelegramHtml("Just a sentence.")).toBe("Just a sentence.");
  });

  it("handles an empty string", () => {
    expect(toTelegramHtml("")).toBe("");
  });
});
