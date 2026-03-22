import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_SECRET: z.string().min(16, "NEXTAUTH_SECRET must be at least 16 chars"),
  GROQ_API_KEY: z.string().min(1, "GROQ_API_KEY is required"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 chars"),
  EMAIL_SERVER_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default("onboarding@resend.dev"),
  AI_MODEL: z.string().default("llama-3.3-70b-versatile"),
  RISK_FREE_RATE: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (_env) return _env;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:");
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    throw new Error("Missing or invalid environment variables");
  }

  _env = parsed.data;
  return _env;
}
