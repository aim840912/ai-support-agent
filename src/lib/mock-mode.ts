/**
 * Detect if the app should run in mock mode (no valid Gemini API key).
 * Controls embedding and document processing.
 */
export function isMockMode(): boolean {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
  return !key || key.startsWith("placeholder") || key.length < 20;
}

/**
 * Detect if the LLM chat should run in mock mode (no valid OpenRouter key).
 * Controls the ToolLoopAgent model — mock mode uses MockLanguageModelV3.
 *
 * model-routing branch: OpenRouter is the primary chat provider
 * (GLM for simple requests, Claude for complex — see lib/ai/model-router.ts).
 */
export function isLlmMockMode(): boolean {
  const key = process.env.OPENROUTER_API_KEY ?? "";
  return !key || key.startsWith("placeholder") || key.length < 20;
}

/**
 * Detect if the Resend email service is configured.
 * When false, email functions log links to the console instead of sending.
 */
export function isResendConfigured(): boolean {
  const key = process.env.RESEND_API_KEY ?? "";
  return (
    !!key && !key.startsWith("placeholder") && !key.startsWith("re_placeholder") && key.length >= 10
  );
}
