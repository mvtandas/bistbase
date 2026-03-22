/**
 * Multi-provider LLM caller with automatic failover.
 * When one provider hits rate limits (429), automatically tries the next.
 * All providers use OpenAI-compatible chat completions API.
 */

interface LLMProvider {
  name: string;
  url: string;
  apiKeyEnv: string;
  model: string;
  /** Whether this provider is usable (key exists) */
  available: boolean;
}

function getProviders(): LLMProvider[] {
  const providers: LLMProvider[] = [];

  // 1. Groq - primary (fast, llama 3.3 70b, 100K tokens/day free)
  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKeyEnv: "GROQ_API_KEY",
      model: process.env.AI_MODEL ?? "llama-3.3-70b-versatile",
      available: true,
    });
  }

  // 2. Google Gemini - secondary (1500 req/day free, very capable)
  if (process.env.GEMINI_API_KEY) {
    providers.push({
      name: "gemini",
      url: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`,
      apiKeyEnv: "GEMINI_API_KEY",
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
      available: true,
    });
  }

  // 3. Cerebras - tertiary (fast inference, free tier)
  if (process.env.CEREBRAS_API_KEY) {
    providers.push({
      name: "cerebras",
      url: "https://api.cerebras.ai/v1/chat/completions",
      apiKeyEnv: "CEREBRAS_API_KEY",
      model: process.env.CEREBRAS_MODEL ?? "llama-3.3-70b",
      available: true,
    });
  }

  return providers;
}

// Track which providers are rate-limited (reset after cooldown)
const rateLimitedUntil = new Map<string, number>();

// Short cooldown (60s) for per-minute limits, long (1h) for daily limits
function isRateLimited(providerName: string): boolean {
  const until = rateLimitedUntil.get(providerName);
  if (!until) return false;
  if (Date.now() > until) {
    rateLimitedUntil.delete(providerName);
    return false;
  }
  return true;
}

function markRateLimited(providerName: string, errorBody: string): void {
  // Check if it's a daily limit (long cooldown) or per-minute (short cooldown)
  const isDailyLimit = errorBody.includes("per day") || errorBody.includes("TPD") || errorBody.includes("PerDay");
  const cooldown = isDailyLimit ? 60 * 60 * 1000 : 60 * 1000; // 1h for daily, 60s for per-minute
  rateLimitedUntil.set(providerName, Date.now() + cooldown);
  console.log(`[multi-provider] ${providerName} rate-limited for ${isDailyLimit ? "1h (daily)" : "60s (per-minute)"}`);
}

export interface LLMCallOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface LLMCallResult {
  content: string;
  provider: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Call LLM with automatic provider failover.
 * Tries each available provider in order. If 429 rate limit hit, marks that
 * provider as rate-limited for 1 hour and tries the next one.
 */
export async function callLLM(
  prompt: string,
  options?: LLMCallOptions
): Promise<LLMCallResult | null> {
  const providers = getProviders();
  const maxTokens = options?.maxTokens ?? 1024;
  const temperature = options?.temperature ?? 0.5;

  if (providers.length === 0) {
    console.error("[multi-provider] No AI providers configured. Set GROQ_API_KEY, GEMINI_API_KEY, or CEREBRAS_API_KEY.");
    return null;
  }

  for (const provider of providers) {
    if (isRateLimited(provider.name)) {
      console.log(`[multi-provider] ${provider.name} rate-limited, skipping`);
      continue;
    }

    const apiKey = process.env[provider.apiKeyEnv];
    if (!apiKey) continue;

    // Try up to 2 attempts per provider
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(provider.url, {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: provider.model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: maxTokens,
            temperature,
          }),
        });

        if (response.status === 429) {
          const body = await response.text().catch(() => "");
          console.warn(`[multi-provider] ${provider.name} rate limited (429)`);
          markRateLimited(provider.name, body);
          break; // Try next provider
        }

        if (response.status === 403) {
          console.warn(`[multi-provider] ${provider.name} access denied (403)`);
          markRateLimited(provider.name, "per day");
          break;
        }

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          console.error(`[multi-provider] ${provider.name} error ${response.status}: ${errorBody.substring(0, 150)}`);
          if (response.status >= 500 && attempt === 0) {
            await sleep(2000);
            continue; // Retry same provider on 5xx
          }
          break; // Try next provider
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content ?? "";

        if (!content) {
          console.warn(`[multi-provider] ${provider.name} returned empty content`);
          break; // Try next provider
        }

        return { content, provider: provider.name };
      } catch (error) {
        console.error(`[multi-provider] ${provider.name} exception:`, error instanceof Error ? error.message : error);
        if (attempt === 0) {
          await sleep(1000);
          continue;
        }
        break;
      }
    }
  }

  console.error("[multi-provider] All providers exhausted");
  return null;
}

/** Get status of all providers for debugging */
export function getProviderStatus(): { name: string; available: boolean; rateLimited: boolean }[] {
  return getProviders().map(p => ({
    name: p.name,
    available: p.available,
    rateLimited: isRateLimited(p.name),
  }));
}
