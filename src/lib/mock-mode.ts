/**
 * Detect if the app should run in mock mode (no valid Gemini API key).
 * Controls embedding and document processing.
 */
export function isMockMode(): boolean {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
  return !key || key.startsWith("placeholder") || key.length < 20;
}

/**
 * Detect if the LLM chat should run in mock mode (no valid Groq/OpenAI key).
 * Controls the ToolLoopAgent model — mock mode uses MockLanguageModelV3.
 */
export function isLlmMockMode(): boolean {
  const key = process.env.GROQ_API_KEY ?? "";
  return !key || key.startsWith("placeholder") || key.length < 20;
}

/**
 * Detect if the Resend email service is configured.
 * When false, email functions log links to the console instead of sending.
 */
export function isResendConfigured(): boolean {
  const key = process.env.RESEND_API_KEY ?? "";
  return !!key && !key.startsWith("placeholder") && !key.startsWith("re_placeholder") && key.length >= 10;
}
