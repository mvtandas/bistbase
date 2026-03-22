import { callLLM } from "./multi-provider";
import type { z, ZodType } from "zod";

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

/**
 * Zod schema ile validasyon yapan versiyon.
 * .safeParse() kullanır — .catch() fallback'leri sayesinde kısmi veri bile geçerli.
 */
export async function generateSpecializedInsightWithSchema<T extends ZodType>(
  systemPrompt: string,
  userPrompt: string,
  schema: T,
  options?: { maxTokens?: number; temperature?: number }
): Promise<z.infer<T> | null> {
  const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const maxAttempts = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await callLLM(combinedPrompt, {
      maxTokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.5,
    });

    if (!result) {
      if (attempt === 0) continue;
      return null;
    }

    const parsed = parseAiJson(result.content);
    if (!parsed) {
      console.error(`[specialized] JSON parse failed (attempt ${attempt + 1}) from ${result.provider}. Raw: ${result.content.substring(0, 200)}`);
      if (attempt === 0) continue;
      return null;
    }

    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      const errors = validated.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      console.error(`[specialized] Zod validation failed (attempt ${attempt + 1}) from ${result.provider}. Errors: ${errors}`);
      if (attempt === 0) continue;
      return null;
    }

    return validated.data;
  }

  return null;
}

/**
 * Eski validator callback API'si — geriye uyumluluk için korunuyor.
 * Yeni route'lar generateSpecializedInsightWithSchema kullanmalı.
 */
export async function generateSpecializedInsight<T>(
  systemPrompt: string,
  userPrompt: string,
  validator: (parsed: Record<string, unknown>) => T | null,
  options?: { maxTokens?: number; temperature?: number }
): Promise<T | null> {
  const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const maxAttempts = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await callLLM(combinedPrompt, {
      maxTokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.5,
    });

    if (!result) {
      if (attempt === 0) continue;
      return null;
    }

    const parsed = parseAiJson(result.content);
    if (!parsed) {
      console.error(`[specialized] JSON parse failed (attempt ${attempt + 1}) from ${result.provider}. Raw: ${result.content.substring(0, 200)}`);
      if (attempt === 0) continue;
      return null;
    }

    const validated = validator(parsed);
    if (!validated) {
      console.error(`[specialized] Validation failed (attempt ${attempt + 1}) from ${result.provider}. Keys: ${Object.keys(parsed).join(", ")}`);
      if (attempt === 0) continue;
      return null;
    }

    return validated;
  }

  return null;
}
