import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { isMockMode } from "@/lib/mock-mode";
import { logError } from "@/lib/error-logger";
import { getSafeErrorMessage } from "@/lib/api-error-handler";

/** Thrown when the Gemini embedding API fails (e.g. quota exhausted). */
export class EmbeddingError extends Error {
  override name = "EmbeddingError";
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

const BATCH_SIZE = 20;
const EMBEDDING_MODEL = "gemini-embedding-001";
// CRITICAL: must match schema's Unsupported("vector(768)")
const OUTPUT_DIMENSIONS = 768;

const model = google.textEmbeddingModel(EMBEDDING_MODEL);

/**
 * Embed an array of text chunks using Gemini embedding API.
 * Returns a flat Float32Array per chunk (768 dimensions).
 *
 * If GOOGLE_GENERATIVE_AI_API_KEY is not set, returns zero vectors (mock mode).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (isMockMode()) {
    console.warn("[embedding] Mock mode: returning zero vectors");
    return texts.map(() => new Array(OUTPUT_DIMENSIONS).fill(0) as number[]);
  }

  const results: number[][] = [];

  try {
    // Process in batches of BATCH_SIZE
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const { embeddings } = await embedMany({
        model,
        values: batch,
        providerOptions: {
          google: { outputDimensionality: OUTPUT_DIMENSIONS },
        },
      });
      results.push(...embeddings);
    }
  } catch (error) {
    logError("[embedTexts]", error);
    throw new EmbeddingError(getSafeErrorMessage(error), { cause: error });
  }

  return results;
}
