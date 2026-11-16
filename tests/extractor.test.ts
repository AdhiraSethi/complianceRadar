import { describe, it, expect, vi } from 'vitest';
import { validateExtraction, type NotificationFacts } from '../src/lib/extractor/schema';
import { extractNotificationFacts } from '../src/lib/extractor/service';
import { MockLLMProvider } from '../src/lib/ai/llm/mock';
import { MockEmbeddingProvider } from '../src/lib/ai/embeddings/mock';
import type { createAdminClient } from '../src/lib/supabase/admin';

const VALID_EXTRACTION_PAYLOAD: NotificationFacts = {
  title: 'Waiver of late fee for delayed filing of FORM GSTR-3B',
  notification_number: '07/2024-Central Tax',
  published_date: '2024-04-08',
  summary_plain:
    'Small traders registered under GST with aggregate turnover up to 1.5 Crore in Delhi have their late fees waived for delayed returns filed before the revised deadline.',
  applies_to: {
    turnover_min_inr: 0,
    turnover_max_inr: 15000000,
    states: ['DL'],
    gst_statuses: ['registered_regular'],
    industries: ['Retail', 'Wholesale'],
    employee_min: null,
    employee_max: null,
  },
  change_type: 'waiver',
  effective_date: '2024-04-08',
  deadline: '2024-05-31',
  required_actions: [
    {
      action: 'File pending GSTR-3B on or before May 31, 2024 to claim fee waiver',
      deadline: '2024-05-31',
      notes: 'Fee waiver auto-applies on the portal',
    },
  ],
  source_clauses: [
    {
      clause_reference: 'Section 128 of CGST Act, Notification 07/2024 Para 1',
      excerpt:
        'The Government, on the recommendations of the Council, hereby waives the amount of late fee payable under section 47 of the said Act...',
      page_or_para: 'Para 1',
    },
  ],
};

describe('Extraction Schema & Validation', () => {
  it('accepts a fully compliant legal fact extraction', () => {
    const result = validateExtraction(VALID_EXTRACTION_PAYLOAD);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.validation_status).toBe('valid');
      expect(result.data.notification_number).toBe('07/2024-Central Tax');
      expect(result.data.applies_to.turnover_max_inr).toBe(15000000);
      expect(result.data.source_clauses.length).toBe(1);
    }
  });

  it('rejects and flags for review output that lacks a supporting source clause', () => {
    const payloadWithoutClauses = {
      ...VALID_EXTRACTION_PAYLOAD,
      source_clauses: [], // Empty source clauses
    };

    const result = validateExtraction(payloadWithoutClauses);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.validation_status).toBe('flagged_for_review');
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('source clause'))).toBe(true);
    }
  });

  it('rejects and flags for review output with dummy/empty clause excerpts', () => {
    const payloadWithEmptyExcerpt = {
      ...VALID_EXTRACTION_PAYLOAD,
      source_clauses: [
        {
          clause_reference: 'Para 1',
          excerpt: 'Too short', // Under 10 chars
        },
      ],
    };

    const result = validateExtraction(payloadWithEmptyExcerpt);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.validation_status).toBe('flagged_for_review');
    }
  });

  it('rejects invalid change types and bad date formats', () => {
    const invalidPayload = {
      ...VALID_EXTRACTION_PAYLOAD,
      change_type: 'invalid_change_type',
      deadline: '31-05-2024', // Not YYYY-MM-DD
    };

    const result = validateExtraction(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.validation_status).toBe('flagged_for_review');
    }
  });
});

describe('Extraction Service End-to-End', () => {
  const dummyNotifId = 'n0000000-0000-0000-0000-000000000001';

  it('successfully extracts, validates, embeds, and logs valid notifications', async () => {
    const auditLogs: Array<{ event_type: string }> = [];
    const factUpserts: unknown[] = [];
    const embeddingUpserts: Array<{ vector: number[] }> = [];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'notifications') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: dummyNotifId,
                source_id: 's-1',
                url: 'https://example.com/notif-1',
                title: 'Sample notification',
                raw_text: 'Official notification text for GSTR-3B late fee waiver...',
              },
              error: null,
            }),
          };
        }
        if (table === 'notification_facts') {
          return {
            upsert: vi.fn().mockImplementation((facts: unknown) => {
              factUpserts.push(facts);
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === 'embeddings') {
          return {
            upsert: vi.fn().mockImplementation((emb: { vector: number[] }) => {
              embeddingUpserts.push(emb);
              return Promise.resolve({ error: null });
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

    const mockLLM = new MockLLMProvider(VALID_EXTRACTION_PAYLOAD);
    const mockEmbeddings = new MockEmbeddingProvider();

    const result = await extractNotificationFacts(dummyNotifId, {
      supabaseClient: mockSupabase as unknown as ReturnType<typeof createAdminClient>,
      llmProvider: mockLLM,
      embeddingProvider: mockEmbeddings,
    });

    expect(result.success).toBe(true);
    expect(result.validation_status).toBe('valid');
    expect(factUpserts.length).toBe(1);
    expect(embeddingUpserts.length).toBe(1);
    expect(embeddingUpserts[0].vector.length).toBe(1536);
    expect(auditLogs.some((l) => l.event_type === 'extracted')).toBe(true);
  });

  it('flags for review and logs extraction_flagged when LLM output violates schema', async () => {
    const auditLogs: Array<{ event_type: string }> = [];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'notifications') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: dummyNotifId,
                source_id: 's-1',
                url: 'https://example.com/notif-1',
                title: 'Corrupted text',
                raw_text: 'Unstructured gibberish',
              },
              error: null,
            }),
          };
        }
        if (table === 'notification_facts') {
          return { upsert: vi.fn().mockResolvedValue({ error: null }) };
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

    // LLM returning output missing required source clauses
    const invalidLLM = new MockLLMProvider({
      title: 'Missing clauses',
      notification_number: '01/2024',
      source_clauses: [],
    } as unknown as Partial<typeof VALID_EXTRACTION_PAYLOAD>);

    const result = await extractNotificationFacts(dummyNotifId, {
      supabaseClient: mockSupabase as unknown as ReturnType<typeof createAdminClient>,
      llmProvider: invalidLLM,
      embeddingProvider: new MockEmbeddingProvider(),
    });

    expect(result.success).toBe(false);
    expect(result.validation_status).toBe('flagged_for_review');
    expect(auditLogs.some((l) => l.event_type === 'extraction_flagged')).toBe(true);
  });
});
