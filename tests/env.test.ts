import { describe, it, expect } from 'vitest';
import { env } from '../src/lib/env';

describe('Environment Variables', () => {
  it('loads valid environment variables with sensible defaults', () => {
    expect(env.NEXT_PUBLIC_APP_URL).toBeDefined();
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
    expect(env.LLM_PROVIDER).toMatch(/^(gemini|openai)$/);
    expect(env.EMBEDDING_PROVIDER).toMatch(/^(gemini|openai)$/);
  });
});
