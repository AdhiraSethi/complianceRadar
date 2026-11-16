import { z } from 'zod';

export const CrawledDocumentSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  notification_number: z.string().min(1),
  published_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  raw_text: z.string().min(1),
  content_hash: z.string().length(64), // SHA-256 hex string
  pdf_url: z.string().url().optional(),
});

export type CrawledDocument = z.infer<typeof CrawledDocumentSchema>;

export const CrawlResultSchema = z.object({
  source_id: z.string().uuid(),
  source_name: z.string(),
  source_url: z.string().url(),
  fetched_at: z.string(),
  total_documents_found: z.number().int().nonnegative(),
  new_documents: z.array(CrawledDocumentSchema),
  changed_documents: z.array(CrawledDocumentSchema),
  unchanged_count: z.number().int().nonnegative(),
  is_healthy: z.boolean(),
  error_message: z.string().optional(),
});

export type CrawlResult = z.infer<typeof CrawlResultSchema>;

export interface SourceParser {
  parser_type: string;
  parse(html: string, baseUrl: string): Promise<CrawledDocument[]>;
}
