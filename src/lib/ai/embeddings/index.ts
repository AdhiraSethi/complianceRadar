import { env } from '@/lib/env';
import { GeminiEmbeddingProvider } from './gemini';
import { OpenAIEmbeddingProvider } from './openai';
import { MockEmbeddingProvider } from './mock';
import type { EmbeddingProvider } from './types';

export * from './types';
export * from './gemini';
export * from './openai';
export * from './mock';

export function getEmbeddingProvider(overrideProvider?: string): EmbeddingProvider {
  const provider = overrideProvider || env.EMBEDDING_PROVIDER;

  if (process.env.NODE_ENV === 'test' && !process.env.LIVE_AI_TESTS) {
    return new MockEmbeddingProvider();
  }

  switch (provider) {
    case 'gemini':
      return new GeminiEmbeddingProvider();
    case 'openai':
      return new OpenAIEmbeddingProvider();
    case 'mock':
      return new MockEmbeddingProvider();
    default:
      throw new Error(`Unsupported Embedding provider: ${provider}`);
  }
}
