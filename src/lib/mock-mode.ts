/**
 * Detect if the app should run in mock mode (no valid API keys).
 * Mock mode enables demo without real Gemini credentials.
 */
export function isMockMode(): boolean {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
  return !key || key.startsWith("placeholder") || key.length < 20;
}
