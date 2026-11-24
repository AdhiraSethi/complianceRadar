import type { AppliesToCriteria } from '../types/database.types';
import { TURNOVER_BAND_RANGES, type BusinessProfile } from '../business/types';

export interface RuleEvaluation {
  rule: string;
  passed: boolean;
  excluded: boolean;
  is_ambiguous: boolean;
  reason: string;
}

/**
 * Layer 1 Hard Rule 1: State Match
 * A hard mismatch on a state-specific notification is final.
 */
export function evaluateStateRule(
  business: BusinessProfile,
  appliesTo: AppliesToCriteria
): RuleEvaluation {
  const states = appliesTo.states || [];

  if (states.length === 0 || states.includes('ALL')) {
    return {
      rule: 'StateRule',
      passed: true,
      excluded: false,
      is_ambiguous: false,
      reason: 'Notification applies nationwide (all states).',
    };
  }

  const matchesState = states.some(
    (s) => s.toUpperCase() === business.state.toUpperCase()
  );

  if (!matchesState) {
    return {
      rule: 'StateRule',
      passed: false,
      excluded: true,
      is_ambiguous: false,
      reason: `Hard Exclusion: Notification restricted to [${states.join(', ')}], business is in ${business.state}.`,
    };
  }

  return {
    rule: 'StateRule',
    passed: true,
    excluded: false,
    is_ambiguous: false,
    reason: `State matched: Notification explicitly applies to ${business.state}.`,
  };
}

/**
 * Layer 1 Hard Rule 2: GST Registration Status Match
 * A hard mismatch on registration type (e.g. Composition vs Regular) is final.
 */
export function evaluateGstStatusRule(
  business: BusinessProfile,
  appliesTo: AppliesToCriteria
): RuleEvaluation {
  const gstStatuses = appliesTo.gst_statuses || [];

  if (gstStatuses.length === 0) {
    return {
      rule: 'GstStatusRule',
      passed: true,
      excluded: false,
      is_ambiguous: false,
      reason: 'Notification applies to all GST registration types.',
    };
  }

  const matchesStatus = gstStatuses.includes(business.gst_status);

  if (!matchesStatus) {
    return {
      rule: 'GstStatusRule',
      passed: false,
      excluded: true,
      is_ambiguous: false,
      reason: `Hard Exclusion: Notification applies to [${gstStatuses.join(', ')}], business is ${business.gst_status}.`,
    };
  }

  return {
    rule: 'GstStatusRule',
    passed: true,
    excluded: false,
    is_ambiguous: false,
    reason: `GST status matched: Applies to ${business.gst_status}.`,
  };
}

/**
 * Layer 1 Hard Rule 3: Turnover Threshold Match
 * Evaluates whether business turnover falls inside notification turnover boundaries.
 */
export function evaluateTurnoverRule(
  business: BusinessProfile,
  appliesTo: AppliesToCriteria
): RuleEvaluation {
  const minInr = appliesTo.turnover_min_inr;
  const maxInr = appliesTo.turnover_max_inr;

  if (minInr == null && maxInr == null) {
    return {
      rule: 'TurnoverRule',
      passed: true,
      excluded: false,
      is_ambiguous: false,
      reason: 'No turnover boundaries specified in notification.',
    };
  }

  const bRange = TURNOVER_BAND_RANGES[business.turnover_band];

  // Hard Exclusion: Business turnover is strictly below the minimum turnover threshold
  if (minInr != null && bRange.max < minInr) {
    return {
      rule: 'TurnoverRule',
      passed: false,
      excluded: true,
      is_ambiguous: false,
      reason: `Hard Exclusion: Minimum turnover is ₹${(minInr / 100000).toFixed(0)} Lakhs; business band max is ₹${(bRange.max / 100000).toFixed(0)} Lakhs.`,
    };
  }

  // Hard Exclusion: Business turnover is strictly above the maximum turnover limit (e.g. exemption threshold)
  if (maxInr != null && bRange.min > maxInr) {
    return {
      rule: 'TurnoverRule',
      passed: false,
      excluded: true,
      is_ambiguous: false,
      reason: `Hard Exclusion: Maximum turnover threshold is ₹${(maxInr / 100000).toFixed(0)} Lakhs; business band min is ₹${(bRange.min / 100000).toFixed(0)} Lakhs.`,
    };
  }

  // Check if band overlaps partially with boundary
  const overlapsLower = minInr != null && bRange.min < minInr && bRange.max >= minInr;
  const overlapsUpper = maxInr != null && bRange.min <= maxInr && bRange.max > maxInr;

  if (overlapsLower || overlapsUpper) {
    return {
      rule: 'TurnoverRule',
      passed: true,
      excluded: false,
      is_ambiguous: true,
      reason: `Turnover band ${business.turnover_band} partially straddles notification threshold bounds.`,
    };
  }

  return {
    rule: 'TurnoverRule',
    passed: true,
    excluded: false,
    is_ambiguous: false,
    reason: `Turnover band ${business.turnover_band} fully within notification turnover criteria.`,
  };
}

/**
 * Layer 1 Hard Rule 4: Employee Count Bounds Match
 */
export function evaluateEmployeeRule(
  business: BusinessProfile,
  appliesTo: AppliesToCriteria
): RuleEvaluation {
  const minEmp = appliesTo.employee_min;
  const maxEmp = appliesTo.employee_max;

  if (minEmp == null && maxEmp == null) {
    return {
      rule: 'EmployeeCountRule',
      passed: true,
      excluded: false,
      is_ambiguous: false,
      reason: 'No employee bounds specified.',
    };
  }

  if (minEmp != null && business.employee_count < minEmp) {
    return {
      rule: 'EmployeeCountRule',
      passed: false,
      excluded: true,
      is_ambiguous: false,
      reason: `Hard Exclusion: Requires at least ${minEmp} employees, business has ${business.employee_count}.`,
    };
  }

  if (maxEmp != null && business.employee_count > maxEmp) {
    return {
      rule: 'EmployeeCountRule',
      passed: false,
      excluded: true,
      is_ambiguous: false,
      reason: `Hard Exclusion: Maximum ${maxEmp} employees allowed, business has ${business.employee_count}.`,
    };
  }

  return {
    rule: 'EmployeeCountRule',
    passed: true,
    excluded: false,
    is_ambiguous: false,
    reason: `Employee count (${business.employee_count}) within bounds.`,
  };
}

/**
 * Layer 1 Rule 5: Industry / Commodity Match
 */
export function evaluateIndustryRule(
  business: BusinessProfile,
  appliesTo: AppliesToCriteria
): RuleEvaluation {
  const industries = appliesTo.industries || [];

  if (industries.length === 0 || industries.includes('ALL')) {
    return {
      rule: 'IndustryRule',
      passed: true,
      excluded: false,
      is_ambiguous: false,
      reason: 'Notification applies across all industries.',
    };
  }

  const bIndustry = (business.industry + ' ' + (business.description || '')).toLowerCase();
  const directMatch = industries.some((ind) =>
    bIndustry.includes(ind.toLowerCase())
  );

  if (directMatch) {
    return {
      rule: 'IndustryRule',
      passed: true,
      excluded: false,
      is_ambiguous: false,
      reason: `Industry matched: Notification targets [${industries.join(', ')}].`,
    };
  }

  // Not a hard exclusion yet because industry descriptions have synonyms and nuances.
  // We mark as ambiguous so Layer 2 semantic similarity can evaluate.
  return {
    rule: 'IndustryRule',
    passed: true,
    excluded: false,
    is_ambiguous: true,
    reason: `Industry not directly matched by keyword. Deferred to semantic matching.`,
  };
}
