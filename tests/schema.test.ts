import { describe, it, expect } from 'vitest';
import type {
  AppliesToCriteria,
  SourceClause,
  RequiredAction,
  MatchEvidence,
} from '../src/lib/types/database.types';

describe('Data Model Types & Contracts', () => {
  it('correctly models AppliesToCriteria', () => {
    const criteria: AppliesToCriteria = {
      turnover_min_inr: 5000000,
      turnover_max_inr: 20000000,
      states: ['DL', 'MH'],
      gst_statuses: ['registered_regular'],
      industries: ['Retail', 'Wholesale'],
      employee_min: 1,
      employee_max: 50,
    };
    expect(criteria.states).toContain('DL');
    expect(criteria.turnover_min_inr).toBe(5000000);
  });

  it('correctly models SourceClause references', () => {
    const clause: SourceClause = {
      clause_reference: 'Notification No. 04/2024 - Central Tax, Para 2(iii)',
      excerpt: 'Provided that registered persons having aggregate turnover up to two crore rupees...',
      page_or_para: 'Para 2(iii)',
    };
    expect(clause.clause_reference).toContain('04/2024');
    expect(clause.excerpt.length).toBeGreaterThan(0);
  });

  it('correctly models RequiredAction', () => {
    const action: RequiredAction = {
      action: 'File Form GSTR-3B before the 20th of the following month',
      deadline: '2026-12-20',
      notes: 'Late fee applicable after due date',
    };
    expect(action.action).toBeDefined();
    expect(action.deadline).toBe('2026-12-20');
  });

  it('correctly models MatchEvidence with rule breakdown and semantic score', () => {
    const evidence: MatchEvidence = {
      rule_matches: [
        {
          rule: 'StateMatch',
          passed: true,
          reason: 'Notification applies to DL and business is in DL',
        },
        {
          rule: 'TurnoverThreshold',
          passed: true,
          reason: 'Turnover 1.5 Cr is below 2 Cr exemption threshold',
        },
      ],
      semantic_score: 0.892,
      summary_reason: 'Exempt from filing requirement based on turnover threshold',
    };
    expect(evidence.rule_matches.length).toBe(2);
    expect(evidence.semantic_score).toBeCloseTo(0.892);
  });
});
