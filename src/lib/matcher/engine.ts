import type { AppliesToCriteria, MatchDecision, MatchEvidence } from '../types/database.types';
import type { BusinessProfile } from '../business/types';
import {
  evaluateStateRule,
  evaluateGstStatusRule,
  evaluateTurnoverRule,
  evaluateEmployeeRule,
  evaluateIndustryRule,
  type RuleEvaluation,
} from './rules';

export interface HybridMatchResult {
  decision: MatchDecision;
  score: number | null;
  evidence: MatchEvidence;
}

export interface MatchEngineOptions {
  semanticScore?: number | null;
}

/**
 * ComplianceRadar Hybrid Relevance Engine
 * Layer 1: Deterministic Hard Rules
 * Layer 2: Cosine Vector Similarity for Ambiguous Cases
 *
 * Guarantees:
 * - A hard exclusion in Layer 1 is final.
 * - The LLM NEVER decides applicability on its own.
 * - Bias toward recall: ambiguous cases produce 'uncertain' rather than being dropped.
 */
export function evaluateHybridMatch(
  business: BusinessProfile,
  appliesTo: AppliesToCriteria,
  options?: MatchEngineOptions
): HybridMatchResult {
  const ruleEvaluations: RuleEvaluation[] = [
    evaluateStateRule(business, appliesTo),
    evaluateGstStatusRule(business, appliesTo),
    evaluateTurnoverRule(business, appliesTo),
    evaluateEmployeeRule(business, appliesTo),
    evaluateIndustryRule(business, appliesTo),
  ];

  const evidenceRules = ruleEvaluations.map((r) => ({
    rule: r.rule,
    passed: r.passed,
    reason: r.reason,
  }));

  // Layer 1: Check for Hard Exclusion
  const hardExclusion = ruleEvaluations.find((r) => r.excluded);
  if (hardExclusion) {
    return {
      decision: 'does_not_affect',
      score: options?.semanticScore ?? 0.0,
      evidence: {
        rule_matches: evidenceRules,
        semantic_score: options?.semanticScore ?? null,
        summary_reason: hardExclusion.reason,
      },
    };
  }

  // Check if any rule was ambiguous
  const hasAmbiguity = ruleEvaluations.some((r) => r.is_ambiguous);
  const semanticScore = options?.semanticScore ?? null;

  // Clear positive match (all rules strictly passed with no ambiguity)
  if (!hasAmbiguity) {
    return {
      decision: 'affects',
      score: semanticScore ?? 1.0,
      evidence: {
        rule_matches: evidenceRules,
        semantic_score: semanticScore,
        summary_reason: 'All deterministic applicability rules matched the registered business profile.',
      },
    };
  }

  // Layer 2: Semantic Similarity for Ambiguous Cases (Recall-Biased)
  if (semanticScore != null) {
    if (semanticScore >= 0.70) {
      return {
        decision: 'affects',
        score: semanticScore,
        evidence: {
          rule_matches: evidenceRules,
          semantic_score: semanticScore,
          summary_reason: `Passed structured criteria with strong semantic relevance (${(semanticScore * 100).toFixed(1)}%).`,
        },
      };
    }

    if (semanticScore >= 0.45) {
      // Recall Bias: Ambiguous cases surfaced as 'uncertain', NOT dropped
      return {
        decision: 'uncertain',
        score: semanticScore,
        evidence: {
          rule_matches: evidenceRules,
          semantic_score: semanticScore,
          summary_reason: `Partially matches business profile with moderate semantic similarity (${(semanticScore * 100).toFixed(1)}%). Review recommended.`,
        },
      };
    }

    return {
      decision: 'does_not_affect',
      score: semanticScore,
      evidence: {
        rule_matches: evidenceRules,
        semantic_score: semanticScore,
        summary_reason: `Low semantic relevance (${(semanticScore * 100).toFixed(1)}%) despite permissive structured filters.`,
      },
    };
  }

  // If semantic score is unavailable for an ambiguous case, bias toward recall
  return {
    decision: 'uncertain',
    score: null,
    evidence: {
      rule_matches: evidenceRules,
      semantic_score: null,
      summary_reason: 'Passed hard exclusion filters, but industry/turnover criteria require verification.',
    },
  };
}
