import { z } from 'zod';

export const GstStatusSchema = z.enum([
  'registered_regular',
  'registered_composition',
  'unregistered',
]);

export const ChangeTypeSchema = z.enum([
  'new_rule',
  'amendment',
  'extension',
  'waiver',
  'clarification',
]);

export const SourceClauseSchema = z.object({
  clause_reference: z.string().min(1, 'Clause reference is required (e.g. "Section 148, Para 2")'),
  excerpt: z.string().min(10, 'Excerpt must contain the actual official clause text supporting the fact'),
  page_or_para: z.string().optional(),
});

export const RequiredActionSchema = z.object({
  action: z.string().min(5, 'Action description must be concise and actionable'),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Deadline must be in YYYY-MM-DD format').nullable().optional(),
  notes: z.string().optional(),
});

export const AppliesToSchema = z.object({
  turnover_min_inr: z.number().nonnegative().nullable().optional(),
  turnover_max_inr: z.number().nonnegative().nullable().optional(),
  states: z.array(z.string()).default([]), // e.g. ["DL", "MH"] or ["ALL"]
  gst_statuses: z.array(GstStatusSchema).default([]),
  industries: z.array(z.string()).default([]),
  employee_min: z.number().int().nonnegative().nullable().optional(),
  employee_max: z.number().int().nonnegative().nullable().optional(),
});

export const NotificationFactsSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters'),
  notification_number: z.string().min(1, 'Notification number is required'),
  published_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').nullable(),
  summary_plain: z.string().min(20, 'Plain summary must be at least 20 characters'),
  applies_to: AppliesToSchema,
  change_type: ChangeTypeSchema,
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective date must be YYYY-MM-DD').nullable(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Deadline must be YYYY-MM-DD').nullable(),
  required_actions: z.array(RequiredActionSchema).default([]),
  source_clauses: z.array(SourceClauseSchema).min(1, 'At least one supporting official source clause is strictly required'),
});

export type NotificationFacts = z.infer<typeof NotificationFactsSchema>;

export type ExtractionValidationResult =
  | {
      success: true;
      data: NotificationFacts;
      validation_status: 'valid';
    }
  | {
      success: false;
      errors: string[];
      raw_data: unknown;
      validation_status: 'flagged_for_review';
    };

/**
 * Validates raw LLM extraction against strict Zod schema.
 * Rejects and flags for review any output that fails validation or lacks a supporting source clause.
 */
export function validateExtraction(rawOutput: unknown): ExtractionValidationResult {
  const parsed = NotificationFactsSchema.safeParse(rawOutput);

  if (!parsed.success) {
    const errors = parsed.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    );
    return {
      success: false,
      errors,
      raw_data: rawOutput,
      validation_status: 'flagged_for_review',
    };
  }

  // Extra verification: Ensure source clauses are not dummy placeholders
  const hasValidClause = parsed.data.source_clauses.some(
    (clause) => clause.clause_reference.trim().length > 0 && clause.excerpt.trim().length >= 10
  );

  if (!hasValidClause) {
    return {
      success: false,
      errors: ['Output lacks a supporting source clause with substantive excerpt'],
      raw_data: rawOutput,
      validation_status: 'flagged_for_review',
    };
  }

  return {
    success: true,
    data: parsed.data,
    validation_status: 'valid',
  };
}
