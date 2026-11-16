import { describe, it, expect, vi } from 'vitest';
import type { createAdminClient } from '../src/lib/supabase/admin';
import { computeContentHash, normalizeContent } from '../src/lib/crawler/hasher';
import { cbicGstParser, parseOfficialDate } from '../src/lib/crawler/parsers/cbic-gst';
import { crawlSource, type SourceRecord } from '../src/lib/crawler/service';

const SAMPLE_CBIC_HTML = `
<!DOCTYPE html>
<html>
<body>
  <table class="table">
    <thead>
      <tr>
        <th>Notification No.</th>
        <th>Date</th>
        <th>Subject</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>04/2024-Central Tax</td>
        <td>05-01-2024</td>
        <td><a href="/resources/htdocs-cbec/gst/notfctn-04-central-tax-2024.pdf">Seeks to provide special procedure for manufacturers of certain goods under section 148</a></td>
      </tr>
      <tr>
        <td>12/2024 - Central Tax</td>
        <td>10 July 2024</td>
        <td><a href="/resources/htdocs-cbec/gst/notfctn-12-central-tax-2024.pdf">Seeks to extend due date for filing FORM GSTR-3B for registered persons in specified districts</a></td>
      </tr>
    </tbody>
  </table>
</body>
</html>
`;

describe('Content Hasher & Normalizer', () => {
  it('normalizes variable whitespace, newlines, and trailing spaces deterministically', () => {
    const raw1 = '  Notification No: 04/2024   \r\nSubject: GST waiver  ';
    const raw2 = 'Notification No: 04/2024\nSubject: GST waiver';
    expect(normalizeContent(raw1)).toBe(normalizeContent(raw2));
    expect(computeContentHash(raw1)).toBe(computeContentHash(raw2));
  });

  it('produces a 64-character SHA-256 hex string', () => {
    const hash = computeContentHash('Sample GST text');
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('CBIC GST Parser', () => {
  it('parses Indian official dates in various formats', () => {
    expect(parseOfficialDate('05-01-2024')).toBe('2024-01-05');
    expect(parseOfficialDate('05/01/2024')).toBe('2024-01-05');
    expect(parseOfficialDate('2024-07-10')).toBe('2024-07-10');
    expect(parseOfficialDate('10 July 2024')).toBe('2024-07-10');
  });

  it('extracts structured documents from HTML table rows', async () => {
    const baseUrl = 'https://taxinformation.cbic.gov.in';
    const docs = await cbicGstParser.parse(SAMPLE_CBIC_HTML, baseUrl);

    expect(docs.length).toBe(2);

    expect(docs[0].notification_number).toBe('04/2024-Central Tax');
    expect(docs[0].published_date).toBe('2024-01-05');
    expect(docs[0].title).toContain('special procedure for manufacturers');
    expect(docs[0].pdf_url).toBe('https://taxinformation.cbic.gov.in/resources/htdocs-cbec/gst/notfctn-04-central-tax-2024.pdf');
    expect(docs[0].content_hash).toHaveLength(64);

    expect(docs[1].notification_number).toBe('12/2024 - Central Tax');
    expect(docs[1].published_date).toBe('2024-07-10');
    expect(docs[1].title).toContain('extend due date for filing FORM GSTR-3B');
  });
});

describe('Crawl Service & Change Detection', () => {
  const dummySource: SourceRecord = {
    id: 'a0000000-0000-0000-0000-000000000001',
    name: 'CBIC Central Tax Notifications',
    url: 'https://taxinformation.cbic.gov.in/content-page/gst-notifications',
    parser_type: 'cbic_gst',
    is_active: true,
  };

  it('raises an operational health alert when a crawl yields zero results', async () => {
    const auditInsertions: Array<{ actor: string; event_type: string; entity_ref: string }> = [];

    // Mock Supabase admin client
    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'audit_log') {
          return {
            insert: vi.fn().mockImplementation((entry: { actor: string; event_type: string; entity_ref: string }) => {
              auditInsertions.push(entry);
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [] }),
        };
      }),
    } as unknown as Parameters<typeof crawlSource>[1] extends { supabaseClient?: infer S } ? S : never;

    // Fetch returning empty HTML
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><body><p>No records found</p></body></html>'),
    });

    const result = await crawlSource(dummySource, {
      supabaseClient: mockSupabase as unknown as ReturnType<typeof createAdminClient>,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.is_healthy).toBe(false);
    expect(result.total_documents_found).toBe(0);
    expect(auditInsertions.some((a) => a.event_type === 'operational_health_alert')).toBe(true);
  });

  it('detects new documents and stores them idempotently', async () => {
    const insertedNotifications: Array<{ title: string; content_hash: string; version: number }> = [];
    const auditLogs: Array<{ event_type: string }> = [];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'notifications') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: [] }), // No existing notifications
            insert: vi.fn().mockImplementation((payload: { title: string; content_hash: string; version: number }) => {
              insertedNotifications.push(payload);
              return {
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { id: 'notif-1' }, error: null }),
              };
            }),
          };
        }
        if (table === 'audit_log') {
          return {
            insert: vi.fn().mockImplementation((entry: { event_type: string }) => {
              auditLogs.push(entry);
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {};
      }),
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_CBIC_HTML),
    });

    const result = await crawlSource(dummySource, {
      supabaseClient: mockSupabase as unknown as ReturnType<typeof createAdminClient>,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.is_healthy).toBe(true);
    expect(result.total_documents_found).toBe(2);
    expect(result.new_documents.length).toBe(2);
    expect(insertedNotifications.length).toBe(2);
    expect(auditLogs.some((l) => l.event_type === 'notification_created')).toBe(true);
    expect(auditLogs.some((l) => l.event_type === 'crawled')).toBe(true);
  });

  it('skips unchanged documents idempotently when content hashes match', async () => {
    const parsed = await cbicGstParser.parse(SAMPLE_CBIC_HTML, dummySource.url);
    const existingHash = parsed[0].content_hash;

    const insertedNotifications: unknown[] = [];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'notifications') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'existing-id-1',
                  url: parsed[0].url,
                  content_hash: existingHash,
                  version: 1,
                },
              ],
            }),
            insert: vi.fn().mockImplementation((p: unknown) => {
              insertedNotifications.push(p);
              return { select: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'x' } }) };
            }),
          };
        }
        if (table === 'audit_log') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) };
        }
        return {};
      }),
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_CBIC_HTML),
    });

    const result = await crawlSource(dummySource, {
      supabaseClient: mockSupabase as unknown as ReturnType<typeof createAdminClient>,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result.unchanged_count).toBe(1);
    expect(result.new_documents.length).toBe(1);
    expect(insertedNotifications.length).toBe(1); // Only the second one is inserted
  });
});
