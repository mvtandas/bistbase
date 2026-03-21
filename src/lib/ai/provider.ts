import type { StockAnalysisInput, StockAnalysisOutput } from "./types";
import { buildAnalysisPrompt } from "./prompts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

function sanitizeJsonString(raw: string): string {
  // Remove control characters that break JSON.parse
  // Keep \n and \t but remove other control chars
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

export async function generateStockAnalysis(
  input: StockAnalysisInput
): Promise<StockAnalysisOutput | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error("GROQ_API_KEY is not set");
    return null;
  }

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
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error(
        `Groq API error for ${input.stockCode}: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`Could not parse AI response for ${input.stockCode}`);
      return null;
    }

    // Sanitize and parse
    const sanitized = sanitizeJsonString(jsonMatch[0]);
    const parsed = JSON.parse(sanitized);

    return {
      summaryText: parsed.summaryText ?? "",
      sentimentScore: parsed.sentimentScore ?? "NEUTRAL",
    };
  } catch (error) {
    console.error(`AI generation failed for ${input.stockCode}:`, error);
    return null;
  }
}
