import { z } from 'zod';

const envSchema = z.object({
  // Next.js & App URL
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Supabase Public
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default('https://example.supabase.co'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default('dummy-anon-key-for-test-and-build'),

  // Supabase Server-Only
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).default('dummy-service-role-key-for-test'),

  // Inngest
  INNGEST_EVENT_KEY: z.string().default('dummy-event-key'),
  INNGEST_SIGNING_KEY: z.string().default('dummy-signing-key'),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().default('123456:dummy-token'),
  TELEGRAM_WEBHOOK_SECRET: z.string().default('dummy-webhook-secret'),

  // LLM & Embeddings
  LLM_PROVIDER: z.enum(['gemini', 'openai']).default('gemini'),
  EMBEDDING_PROVIDER: z.enum(['gemini', 'openai']).default('gemini'),
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  // Node Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment configuration');
  }
  return result.data;
}

export const env = parseEnv();
