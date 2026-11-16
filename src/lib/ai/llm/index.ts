import { env } from '@/lib/env';
import { GeminiLLMProvider } from './gemini';
import { OpenAILLMProvider } from './openai';
import { MockLLMProvider } from './mock';
import type { LLMProvider } from './types';

export * from './types';
export * from './gemini';
export * from './openai';
export * from './mock';
export * from './prompt';

export function getLLMProvider(overrideProvider?: string): LLMProvider {
  const provider = overrideProvider || env.LLM_PROVIDER;

  if (process.env.NODE_ENV === 'test' && !process.env.LIVE_AI_TESTS) {
    return new MockLLMProvider();
  }

  switch (provider) {
    case 'gemini':
      return new GeminiLLMProvider();
    case 'openai':
      return new OpenAILLMProvider();
    case 'mock':
      return new MockLLMProvider();
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
