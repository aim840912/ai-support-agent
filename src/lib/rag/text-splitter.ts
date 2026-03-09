/**
 * Simple recursive character text splitter.
 * Splits text into chunks of ~chunkSize characters with overlap.
 * No external dependencies needed.
 */

interface SplitOptions {
  chunkSize: number;
  chunkOverlap: number;
  separators?: string[];
}

const DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

export function splitText(
  text: string,
  options: SplitOptions = { chunkSize: 1000, chunkOverlap: 200 }
): string[] {
  const { chunkSize, chunkOverlap } = options;
  const separators = options.separators ?? DEFAULT_SEPARATORS;

  if (text.length <= chunkSize) {
    return [text.trim()].filter(Boolean);
  }

  const chunks: string[] = [];
  const rawChunks = recursiveSplit(text, separators, chunkSize);

  // Merge small chunks and apply overlap
  let currentChunk = "";

  for (const raw of rawChunks) {
    if (currentChunk.length + raw.length <= chunkSize) {
      currentChunk += raw;
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      // Apply overlap: keep the tail of the previous chunk
      const overlap = currentChunk.slice(-chunkOverlap);
      currentChunk = overlap + raw;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

function recursiveSplit(text: string, separators: string[], chunkSize: number): string[] {
  if (text.length <= chunkSize || separators.length === 0) {
    return [text];
  }

  const separator = separators[0];
  const remainingSeparators = separators.slice(1);

  if (separator === "") {
    // Last resort: split by character count
    const parts: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      parts.push(text.slice(i, i + chunkSize));
    }
    return parts;
  }

  const parts = text.split(separator);
  const result: string[] = [];

  for (const part of parts) {
    const withSep = part + separator;
    if (withSep.length <= chunkSize) {
      result.push(withSep);
    } else {
      // Recursively split with next separator
      result.push(...recursiveSplit(withSep, remainingSeparators, chunkSize));
    }
  }

  return result;
}
