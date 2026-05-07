// src/lib/ai-pricing.ts
//
// Anthropic Sonnet 4.x token pricing as of 2026-05. Update these constants
// whenever Anthropic changes their rate card. Prices are USD per million
// tokens; we convert to cents for storage in usage_events.metadata so the
// DB-side cost cap can do exact integer comparisons.

const SONNET_INPUT_CENTS_PER_MILLION  = 300;   // $3.00 / 1M input tokens
const SONNET_OUTPUT_CENTS_PER_MILLION = 1500;  // $15.00 / 1M output tokens

/**
 * Compute the cost of a single Anthropic call in cents.
 *
 * Returns a fractional cent value (e.g. 5.25 cents). Persisted as numeric
 * in `usage_events.metadata.cost_cents` so we don't lose precision on
 * very small calls (a 100-token reply costs about 0.15 cent).
 */
export function computeAiCostCents(inputTokens: number, outputTokens: number): number {
  const input = (inputTokens / 1_000_000) * SONNET_INPUT_CENTS_PER_MILLION;
  const output = (outputTokens / 1_000_000) * SONNET_OUTPUT_CENTS_PER_MILLION;
  return Math.round((input + output) * 10000) / 10000; // 4 decimal cents
}
