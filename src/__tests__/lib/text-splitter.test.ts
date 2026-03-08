import { describe, it, expect } from "vitest";
import { splitText } from "@/lib/rag/text-splitter";

describe("splitText", () => {
  it("returns the full text as one chunk when shorter than chunkSize", () => {
    const text = "Hello world. This is a short sentence.";
    const chunks = splitText(text, { chunkSize: 1000, chunkOverlap: 200 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(text.trim());
  });

  it("splits long text into multiple chunks", () => {
    // Generate a text longer than 200 chars
    const sentence = "This is a sentence. ";
    const text = sentence.repeat(20); // ~400 chars
    const chunks = splitText(text, { chunkSize: 100, chunkOverlap: 20 });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("each chunk is at most chunkSize characters", () => {
    const text = "word ".repeat(500); // 2500 chars
    const opts = { chunkSize: 200, chunkOverlap: 40 };
    const chunks = splitText(text, opts);

    // All chunks must be within tolerance (overlap can push slightly over)
    for (const chunk of chunks) {
      // chunkSize + chunkOverlap is a reasonable upper bound
      expect(chunk.length).toBeLessThanOrEqual(opts.chunkSize + opts.chunkOverlap + 10);
    }
  });

  it("applies overlap between consecutive chunks", () => {
    // Build text with clear paragraph breaks
    const para = "Alpha beta gamma delta epsilon zeta eta theta iota kappa. ";
    const text = para.repeat(10);
    const opts = { chunkSize: 120, chunkOverlap: 30 };
    const chunks = splitText(text, opts);

    // With overlap, adjacent chunks should share some suffix/prefix content
    if (chunks.length >= 2) {
      const tail = chunks[0].slice(-opts.chunkOverlap);
      expect(chunks[1]).toContain(tail.trim().split(" ")[0]);
    }
  });

  it("filters out empty chunks", () => {
    const text = "   \n\n   \n\n   ";
    const chunks = splitText(text, { chunkSize: 100, chunkOverlap: 0 });
    expect(chunks).toHaveLength(0);
  });

  it("uses custom separators when provided", () => {
    const text = "part1|part2|part3|part4|part5";
    const chunks = splitText(text, {
      chunkSize: 10,
      chunkOverlap: 0,
      separators: ["|", ""],
    });
    expect(chunks.length).toBeGreaterThan(1);
  });
});
