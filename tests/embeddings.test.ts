import { describe, it, expect } from 'vitest';
import { cosineSimilarity } from '../src/lib/ai/embeddings/types';
import { MockEmbeddingProvider } from '../src/lib/ai/embeddings/mock';

describe('Embedding Provider Abstraction', () => {
  const provider = new MockEmbeddingProvider();

  it('generates vectors with exactly 1536 dimensions', async () => {
    const vector = await provider.embedText('GST Notification for composite dealers');
    expect(vector.length).toBe(1536);
    expect(provider.dimension).toBe(1536);
  });

  it('produces unit-normalized vectors (Euclidean norm ~ 1.0)', async () => {
    const vector = await provider.embedText('Quarterly filing deadline extension');
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    expect(norm).toBeCloseTo(1.0, 4);
  });

  it('is deterministic for identical input text', async () => {
    const vec1 = await provider.embedText('Notification 04/2024');
    const vec2 = await provider.embedText('Notification 04/2024');
    expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1.0, 5);
  });
});

describe('Cosine Similarity Math', () => {
  it('computes 1.0 for identical vectors', () => {
    const v = [0.6, 0.8];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0, 5);
  });

  it('computes 0.0 for orthogonal vectors', () => {
    const v1 = [1, 0];
    const v2 = [0, 1];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(0.0, 5);
  });

  it('computes -1.0 for opposite vectors', () => {
    const v1 = [0.7071, 0.7071];
    const v2 = [-0.7071, -0.7071];
    expect(cosineSimilarity(v1, v2)).toBeCloseTo(-1.0, 4);
  });

  it('throws an error if vector dimensions do not match', () => {
    const v1 = [1, 2, 3];
    const v2 = [1, 2];
    expect(() => cosineSimilarity(v1, v2)).toThrow(/Vector dimension mismatch/);
  });
});
