import { EFFORT_ORDER, TIER_ORDER, type Effort, type ModelPrice, type Tier } from '../config/config-schema';
import { usageCostUsd } from '../budget/usage-cost';

export interface CheckTaskTarget {
  baseUrl: string;
  apiKey: string;
  model: string;
  price: ModelPrice;
}

export interface CheckTaskResult {
  tier: Tier;
  effort: Effort;
  costUsd: number;
}

const MAX_REPLY_TOKENS = 64;
const CLASSIFY_PROMPT =
  'Classify the task below for routing. Reply with only JSON on one line: {"tier": one of "flash-low", "flash-high", "pro-high", "claude", "effort": one of "low", "medium", "high", "xhigh", "max"}. No other text.';

interface AnthropicMessage {
  content?: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
}

function parseClassification(text: string): { tier: Tier; effort: Effort } | null {
  let parsed: { tier?: unknown; effort?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const tierValues: readonly string[] = TIER_ORDER;
  const effortValues: readonly string[] = EFFORT_ORDER;
  if (typeof parsed.tier !== 'string' || !tierValues.includes(parsed.tier)) return null;
  if (typeof parsed.effort !== 'string' || !effortValues.includes(parsed.effort)) return null;
  return { tier: parsed.tier as Tier, effort: parsed.effort as Effort };
}

// Asks the cheapest DeepSeek model to classify an unclear task; never logs the target's
// apiKey or the task text, and fails closed to null on any error, timeout or invalid reply.
export async function checkTask(
  task: string,
  target: CheckTaskTarget,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<CheckTaskResult | null> {
  try {
    const response = await fetchImpl(`${target.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': target.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: target.model,
        max_tokens: MAX_REPLY_TOKENS,
        system: CLASSIFY_PROMPT,
        messages: [{ role: 'user', content: task }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as AnthropicMessage;
    const text = body.content?.find((block) => block.type === 'text')?.text;
    if (!text) return null;
    const classification = parseClassification(text);
    if (!classification) return null;
    const usage = body.usage;
    const costUsd = usage
      ? usageCostUsd(target.price, {
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          cacheReadTokens: usage.cache_read_input_tokens ?? 0,
          cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
        })
      : 0;
    return { ...classification, costUsd };
  } catch {
    return null;
  }
}
