import type { StockAnalysisInputV2, StockAnalysisOutputV2 } from "./types";
import { buildAnalysisPrompt } from "./prompts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

function sanitizeJsonString(raw: string): string {
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

function extractJson(text: string): string | null {
  // 1. Try ```json ... ``` block first
  const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) return codeBlockMatch[1];

  // 2. Fallback: greedy match from first { to last }
  const greedy = text.match(/\{[\s\S]*\}/);
  return greedy?.[0] ?? null;
}

function parseAiJson(raw: string): Record<string, unknown> | null {
  const jsonStr = extractJson(raw);
  if (!jsonStr) return null;

  const sanitized = sanitizeJsonString(jsonStr);

  // First attempt: direct parse
  try {
    return JSON.parse(sanitized);
  } catch {
    // Second attempt: replace unescaped newlines inside string values with spaces
    try {
      const fixed = sanitized.replace(/\n/g, " ").replace(/\r/g, "");
      return JSON.parse(fixed);
    } catch {
      return null;
    }
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function generateStockAnalysis(
  input: StockAnalysisInputV2
): Promise<StockAnalysisOutputV2 | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY is not set");
    return null;
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL ?? "llama-3.3-70b-versatile",
          messages: [
            {
              role: "user",
              content: buildAnalysisPrompt(input),
            },
          ],
          max_tokens: 2048,
          temperature: 0.6,
        }),
      });

      if (!response.ok) {
        const status = response.status;
        console.error(
          `Groq API error for ${input.stockCode}: ${status} ${response.statusText} (attempt ${attempt + 1}/${MAX_RETRIES})`
        );

        // Retry on 5xx (server error) only; 429 rate limit → fail fast
        if (status >= 500 && attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
        return null;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content ?? "";

      const parsed = parseAiJson(text);
      if (!parsed) {
        console.error(`Could not parse AI response for ${input.stockCode} (attempt ${attempt + 1}/${MAX_RETRIES})`);
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_DELAYS[attempt]);
          continue;
        }
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
    } catch (error) {
      console.error(`AI generation failed for ${input.stockCode} (attempt ${attempt + 1}/${MAX_RETRIES}):`, error);
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      return null;
    }
  }

  return null;
}
