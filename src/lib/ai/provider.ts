import type { StockAnalysisInputV2, StockAnalysisOutputV2 } from "./types";
import { buildAnalysisPrompt } from "./prompts";
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

export async function generateStockAnalysis(
  input: StockAnalysisInputV2
): Promise<StockAnalysisOutputV2 | null> {
  const prompt = buildAnalysisPrompt(input);
  const maxAttempts = 2;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await callLLM(prompt, {
      maxTokens: 2048,
      temperature: 0.6,
    });

    if (!result) {
      if (attempt === 0) continue;
      return null;
    }

    const parsed = parseAiJson(result.content);
    if (!parsed) {
      console.error(`[analysis] Parse failed (attempt ${attempt + 1}) for ${input.stockCode} from ${result.provider}`);
      if (attempt === 0) continue;
      return null;
    }

    return {
      summaryText: typeof parsed.summaryText === "string" ? parsed.summaryText : "",
      bullCase: typeof parsed.bullCase === "string" ? parsed.bullCase : "",
      bearCase: typeof parsed.bearCase === "string" ? parsed.bearCase : "",
      sentimentValue: typeof parsed.sentimentValue === "number"
        ? Math.max(-100, Math.min(100, parsed.sentimentValue))
        : 0,
      confidence: ["HIGH", "MEDIUM", "LOW"].includes(parsed.confidence as string)
        ? (parsed.confidence as string)
        : "MEDIUM",
      verdictReason: typeof parsed.verdictReason === "string" ? parsed.verdictReason : undefined,
    };
  }

  return null;
}
