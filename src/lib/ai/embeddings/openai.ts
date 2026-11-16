import { env } from '@/lib/env';
import type { EmbeddingProvider } from './types';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  name = 'openai';
  readonly dimension = 1536 as const;
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(
    apiKey?: string,
    model = 'text-embedding-3-small',
    baseUrl = 'https://api.openai.com/v1'
  ) {
    this.apiKey = apiKey || env.OPENAI_API_KEY || '';
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text.slice(0, 8000),
        dimensions: 1536,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI Embedding API error [${res.status}]: ${err}`);
    }

    const data = (await res.json()) as {
      data?: Array<{
        embedding?: number[];
      }>;
    };

    const embedding = data.data?.[0]?.embedding;
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('No embedding returned by OpenAI');
    }

    if (embedding.length !== 1536) {
      throw new Error(`OpenAI returned ${embedding.length} dimensions instead of 1536`);
    }

    return embedding;
  }
}
