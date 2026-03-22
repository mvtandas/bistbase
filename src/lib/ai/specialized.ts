import { callLLM } from "./multi-provider";

function sanitizeJsonString(raw: string): string {
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function extractJson(text: string): string | null {
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) return codeBlockMatch[1];
  const greedy = text.match(/\{[\s\S]*\}/);
  return greedy?.[0] ?? null;
}

function parseAiJson(raw: string): Record<string, unknown> | null {
  const jsonStr = extractJson(raw);
  if (!jsonStr) return null;
  const sanitized = sanitizeJsonString(jsonStr);
  try {
    return JSON.parse(sanitized);
  } catch {
    try {
      const fixed = sanitized.replace(/\n/g, " ").replace(/\r/g, "");
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

export async function generateSpecializedInsight<T>(
  systemPrompt: string,
  userPrompt: string,
  validator: (parsed: Record<string, unknown>) => T | null,
  options?: { maxTokens?: number; temperature?: number }
): Promise<T | null> {
  const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

  const result = await callLLM(combinedPrompt, {
    maxTokens: options?.maxTokens ?? 1024,
    temperature: options?.temperature ?? 0.5,
  });

  if (!result) return null;

  const parsed = parseAiJson(result.content);
  if (!parsed) {
    console.error(`[specialized] JSON parse failed from ${result.provider}. Raw: ${result.content.substring(0, 200)}`);
    return null;
  }

  const validated = validator(parsed);
  if (!validated) {
    console.error(`[specialized] Validation failed from ${result.provider}. Keys: ${Object.keys(parsed).join(", ")}`);
    return null;
  }

  return validated;
}
