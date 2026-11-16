import { env } from '@/lib/env';
import type { EmbeddingProvider } from './types';

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  name = 'gemini';
  readonly dimension = 1536 as const;
  private apiKey: string;
  private model: string;

  constructor(apiKey?: string, model = 'text-embedding-004') {
    this.apiKey = apiKey || env.GEMINI_API_KEY || '';
    this.model = model;
  }

  async embedText(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${this.model}`,
        content: {
          parts: [{ text: text.slice(0, 8000) }],
        },
        outputDimensionality: 1536,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini Embedding API error [${res.status}]: ${err}`);
    }

    const data = (await res.json()) as {
      embedding?: {
        values?: number[];
      };
    };

    let values = data.embedding?.values;
    if (!values || !Array.isArray(values) || values.length === 0) {
      throw new Error('No embedding values returned by Gemini');
    }

    // Ensure exact 1536 dimensions
    if (values.length < 1536) {
      const padded = new Array<number>(1536).fill(0);
      for (let i = 0; i < values.length; i++) {
        padded[i] = values[i];
      }
      values = padded;
    } else if (values.length > 1536) {
      values = values.slice(0, 1536);
    }

    // Normalize to unit vector
    let normSq = 0;
    for (let i = 0; i < 1536; i++) {
      normSq += values[i] * values[i];
    }
    const norm = Math.sqrt(normSq) || 1;
    return values.map((v) => v / norm);
  }
}
