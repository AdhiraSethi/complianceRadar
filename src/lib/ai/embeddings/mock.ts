import { createHash } from 'crypto';
import type { EmbeddingProvider } from './types';

/**
 * Deterministic Mock Embedding Provider producing 1536-dimensional unit vectors.
 * Used for fast, zero-network unit tests, evaluation runs, and CI.
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  name = 'mock';
  readonly dimension = 1536 as const;

  async embedText(text: string): Promise<number[]> {
    const vector = new Array<number>(1536);
    const hash = createHash('sha256').update(text.toLowerCase().trim()).digest();

    // Generate pseudo-random deterministic vector based on words and hash seed
    let seed = 0;
    for (let i = 0; i < hash.length; i++) {
      seed = (seed * 31 + hash[i]) >>> 0;
    }

    let normSquared = 0;
    for (let i = 0; i < 1536; i++) {
      // Linear congruential generator with text-seeded values
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const val = (seed / 4294967296) * 2 - 1; // Range: [-1, 1]
      vector[i] = val;
      normSquared += val * val;
    }

    // Normalize vector to unit length
    const norm = Math.sqrt(normSquared);
    for (let i = 0; i < 1536; i++) {
      vector[i] = vector[i] / norm;
    }

    return vector;
  }
}
