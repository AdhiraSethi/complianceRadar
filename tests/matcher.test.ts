import { describe, it, expect, vi } from 'vitest';
import type { AppliesToCriteria } from '../src/lib/types/database.types';
import type { BusinessProfile } from '../src/lib/business/types';
import {
  evaluateStateRule,
  evaluateGstStatusRule,
  evaluateTurnoverRule,
  evaluateEmployeeRule,
  evaluateIndustryRule,
} from '../src/lib/matcher/rules';
import { evaluateHybridMatch } from '../src/lib/matcher/engine';
import { matchBusinessToNotification } from '../src/lib/matcher/service';
import type { createAdminClient } from '../src/lib/supabase/admin';

const BASE_BUSINESS: BusinessProfile = {
  id: 'b-001',
  owner_id: 'u-001',
  name: 'Delhi Retail Mart',
  state: 'DL',
  gst_status: 'registered_regular',
  turnover_band: '40l_to_1.5cr', // Range: 40L to 1.5 Cr
  employee_count: 8,
  industry: 'Retail - Groceries and Daily Essentials',
  description: 'Convenience grocery store selling packaged foods and household items in Rohini, Delhi.',
  telegram_chat_id: '12345678',
};

describe('Layer 1 Deterministic Hard Rules', () => {
  describe('StateRule', () => {
    it('passes nationwide notifications (empty states or ALL)', () => {
      expect(evaluateStateRule(BASE_BUSINESS, { states: [] }).passed).toBe(true);
      expect(evaluateStateRule(BASE_BUSINESS, { states: ['ALL'] }).passed).toBe(true);
    });

    it('passes when business state is explicitly included', () => {
      const result = evaluateStateRule(BASE_BUSINESS, { states: ['DL', 'HR'] });
      expect(result.passed).toBe(true);
      expect(result.excluded).toBe(false);
    });

    it('triggers a hard exclusion when business state is not included', () => {
      const result = evaluateStateRule(BASE_BUSINESS, { states: ['MH', 'GJ'] });
      expect(result.passed).toBe(false);
      expect(result.excluded).toBe(true);
      expect(result.reason).toContain('Hard Exclusion');
      expect(result.reason).toContain('business is in DL');
    });
  });

  describe('GstStatusRule', () => {
    it('passes when no GST registration type is specified', () => {
      expect(evaluateGstStatusRule(BASE_BUSINESS, { gst_statuses: [] }).passed).toBe(true);
    });

    it('passes when business GST status matches', () => {
      const result = evaluateGstStatusRule(BASE_BUSINESS, {
        gst_statuses: ['registered_regular'],
      });
      expect(result.passed).toBe(true);
      expect(result.excluded).toBe(false);
    });

    it('triggers a hard exclusion when GST status mismatches (e.g. Composition-only rule)', () => {
      const result = evaluateGstStatusRule(BASE_BUSINESS, {
        gst_statuses: ['registered_composition'],
      });
      expect(result.passed).toBe(false);
      expect(result.excluded).toBe(true);
      expect(result.reason).toContain('Hard Exclusion');
      expect(result.reason).toContain('registered_regular');
    });
  });

  describe('TurnoverRule', () => {
    it('passes when no turnover limits are set', () => {
      expect(evaluateTurnoverRule(BASE_BUSINESS, {}).passed).toBe(true);
    });

    it('passes when business turnover is fully within bounds (e.g. up to 2 Cr)', () => {
      // Business is 40L - 1.5Cr (max 1.5Cr), threshold is max 2 Cr (20,000,000)
      const result = evaluateTurnoverRule(BASE_BUSINESS, {
        turnover_max_inr: 20000000,
      });
      expect(result.passed).toBe(true);
      expect(result.excluded).toBe(false);
      expect(result.is_ambiguous).toBe(false);
    });

    it('triggers a hard exclusion when business turnover is strictly above maximum threshold', () => {
      // Notification max is 20 Lakhs, business is 40L - 1.5Cr
      const result = evaluateTurnoverRule(BASE_BUSINESS, {
        turnover_max_inr: 2000000,
      });
      expect(result.passed).toBe(false);
      expect(result.excluded).toBe(true);
      expect(result.reason).toContain('Hard Exclusion');
    });

    it('triggers a hard exclusion when business turnover is strictly below minimum threshold', () => {
      // E.g. E-Invoicing mandate for turnover > 5 Crore (50,000,000)
      const result = evaluateTurnoverRule(BASE_BUSINESS, {
        turnover_min_inr: 50000000,
      });
      expect(result.passed).toBe(false);
      expect(result.excluded).toBe(true);
      expect(result.reason).toContain('Hard Exclusion');
    });

    it('flags ambiguity when business turnover band straddles a threshold boundary', () => {
      // Business band is 40L (4,000,000) to 1.5Cr (15,000,000)
      // Notification threshold is 1 Crore (10,000,000)
      const result = evaluateTurnoverRule(BASE_BUSINESS, {
        turnover_max_inr: 10000000,
      });
      expect(result.passed).toBe(true);
      expect(result.excluded).toBe(false);
      expect(result.is_ambiguous).toBe(true);
    });
  });

  describe('EmployeeCountRule', () => {
    it('passes when within employee bounds', () => {
      const result = evaluateEmployeeRule(BASE_BUSINESS, {
        employee_min: 5,
        employee_max: 20,
      });
      expect(result.passed).toBe(true);
      expect(result.excluded).toBe(false);
    });

    it('triggers a hard exclusion when business has too few employees', () => {
      const result = evaluateEmployeeRule(BASE_BUSINESS, { employee_min: 10 }); // Business has 8
      expect(result.passed).toBe(false);
      expect(result.excluded).toBe(true);
    });

    it('triggers a hard exclusion when business exceeds maximum employees', () => {
      const result = evaluateEmployeeRule(BASE_BUSINESS, { employee_max: 5 }); // Business has 8
      expect(result.passed).toBe(false);
      expect(result.excluded).toBe(true);
    });
  });

  describe('IndustryRule', () => {
    it('passes when notification targets all industries', () => {
      expect(evaluateIndustryRule(BASE_BUSINESS, { industries: [] }).passed).toBe(true);
      expect(evaluateIndustryRule(BASE_BUSINESS, { industries: ['ALL'] }).passed).toBe(true);
    });

    it('matches when industry keyword matches business description or trade', () => {
      const result = evaluateIndustryRule(BASE_BUSINESS, { industries: ['Groceries'] });
      expect(result.passed).toBe(true);
      expect(result.is_ambiguous).toBe(false);
    });

    it('defers unmatched industry descriptions to semantic search rather than hard dropping', () => {
      const result = evaluateIndustryRule(BASE_BUSINESS, {
        industries: ['FMCG Distribution'],
      });
      expect(result.passed).toBe(true);
      expect(result.is_ambiguous).toBe(true);
    });
  });
});

describe('Hybrid Engine & Recall-Biased Decision Logic', () => {
  it('enforces that a hard exclusion is final even if semantic similarity is high', () => {
    // Notification for Maharashtra only, business is in Delhi
    const criteria: AppliesToCriteria = {
      states: ['MH'],
      industries: ['Retail'],
    };

    const result = evaluateHybridMatch(BASE_BUSINESS, criteria, {
      semanticScore: 0.95, // High similarity
    });

    expect(result.decision).toBe('does_not_affect');
    expect(result.evidence.summary_reason).toContain('Hard Exclusion');
  });

  it('decides "affects" when all structured rules match clearly', () => {
    const criteria: AppliesToCriteria = {
      states: ['DL'],
      gst_statuses: ['registered_regular'],
      turnover_max_inr: 20000000,
      industries: ['ALL'],
    };

    const result = evaluateHybridMatch(BASE_BUSINESS, criteria, {
      semanticScore: 0.88,
    });

    expect(result.decision).toBe('affects');
    expect(result.score).toBe(0.88);
  });

  it('decides "affects" for ambiguous cases when semantic similarity is high (>= 0.70)', () => {
    const criteria: AppliesToCriteria = {
      states: ['DL'],
      gst_statuses: ['registered_regular'],
      industries: ['Consumer Staples'], // Not directly 'Groceries', ambiguous
    };

    const result = evaluateHybridMatch(BASE_BUSINESS, criteria, {
      semanticScore: 0.78,
    });

    expect(result.decision).toBe('affects');
    expect(result.evidence.summary_reason).toContain('strong semantic relevance');
  });

  it('decides "uncertain" (Recall Bias) for ambiguous cases with moderate similarity (0.45 - 0.70)', () => {
    const criteria: AppliesToCriteria = {
      states: ['DL'],
      gst_statuses: ['registered_regular'],
      industries: ['Packaged Goods'], // Ambiguous
    };

    const result = evaluateHybridMatch(BASE_BUSINESS, criteria, {
      semanticScore: 0.58,
    });

    expect(result.decision).toBe('uncertain');
    expect(result.evidence.summary_reason).toContain('Review recommended');
  });

  it('decides "does_not_affect" for ambiguous cases with very low similarity (< 0.45)', () => {
    const criteria: AppliesToCriteria = {
      states: ['DL'],
      gst_statuses: ['registered_regular'],
      industries: ['Iron and Steel Manufacturing'], // Ambiguous
    };

    const result = evaluateHybridMatch(BASE_BUSINESS, criteria, {
      semanticScore: 0.22,
    });

    expect(result.decision).toBe('does_not_affect');
    expect(result.evidence.summary_reason).toContain('Low semantic relevance');
  });
});

describe('Match Service Integration', () => {
  it('correctly retrieves entities, evaluates hybrid match, and stores evidence in matches table', async () => {
    const upsertedMatches: Array<{ decision: string; score: number | null }> = [];
    const auditLogs: Array<{ event_type: string }> = [];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'businesses') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: BASE_BUSINESS, error: null }),
          };
        }
        if (table === 'notification_facts') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                notification_id: 'n-001',
                applies_to: {
                  states: ['DL'],
                  gst_statuses: ['registered_regular'],
                  turnover_max_inr: 50000000,
                  industries: ['ALL'],
                },
              },
              error: null,
            }),
          };
        }
        if (table === 'embeddings') {
          return {
            select: vi.fn().mockReturnThis(),
            or: vi.fn().mockResolvedValue({
              data: [
                { owner_type: 'business', vector: new Array(1536).fill(0.1) },
                { owner_type: 'notification', vector: new Array(1536).fill(0.1) },
              ],
            }),
          };
        }
        if (table === 'matches') {
          return {
            upsert: vi.fn().mockImplementation((payload: { decision: string; score: number | null }) => {
              upsertedMatches.push(payload);
              return {
                select: vi.fn().mockReturnThis(),
                single: vi.fn().mockResolvedValue({ data: { id: 'match-101' }, error: null }),
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

    const matchResult = await matchBusinessToNotification('b-001', 'n-001', {
      supabaseClient: mockSupabase as unknown as ReturnType<typeof createAdminClient>,
    });

    expect(matchResult.decision).toBe('affects');
    expect(upsertedMatches.length).toBe(1);
    expect(upsertedMatches[0].decision).toBe('affects');
    expect(auditLogs.some((l) => l.event_type === 'matched')).toBe(true);
  });
});
