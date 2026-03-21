import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import type { StockAnalysisInput, StockAnalysisOutput } from "./types";
import { buildAnalysisPrompt } from "./prompts";

type ProviderName = "openai" | "anthropic";

function getModel() {
  const provider = (process.env.AI_PROVIDER ?? "openai") as ProviderName;
  const modelId = process.env.AI_MODEL ?? "gpt-4o";

  switch (provider) {
    case "openai":
      return openai(modelId);
    case "anthropic":
      return anthropic(modelId);
    default:
      throw new Error(`Unknown AI provider: ${provider}`);
  }
}

export async function generateStockAnalysis(
  input: StockAnalysisInput
): Promise<StockAnalysisOutput | null> {
  try {
    const { text } = await generateText({
      model: getModel(),
      prompt: buildAnalysisPrompt(input),
      maxOutputTokens: 1024,
      temperature: 0.7,
    });

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error(`Could not parse AI response for ${input.stockCode}`);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      summaryText: parsed.summaryText,
      sentimentScore: parsed.sentimentScore,
    };
  } catch (error) {
    console.error(`AI generation failed for ${input.stockCode}:`, error);
    return null;
  }
}
