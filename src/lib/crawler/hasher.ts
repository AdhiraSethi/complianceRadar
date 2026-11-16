import { createHash } from 'crypto';

/**
 * Normalizes raw text content before hashing.
 * Collapses variable whitespace, removes extraneous non-printable characters,
 * trims individual lines, and performs Unicode NFC normalization to avoid superficial hash mismatches.
 */
export function normalizeContent(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim().replace(/[\t\f\v ]+/g, ' '))
    .join('\n')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

/**
 * Computes a deterministic SHA-256 hash for document content.
 */
export function computeContentHash(content: string): string {
  const normalized = normalizeContent(content);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
