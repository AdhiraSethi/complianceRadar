import { createAdminClient } from '@/lib/supabase/admin';
import { getLLMProvider, type LLMProvider } from '@/lib/ai/llm';
import { getEmbeddingProvider, type EmbeddingProvider } from '@/lib/ai/embeddings';
import { validateExtraction, type NotificationFacts } from './schema';
import type { Database } from '@/lib/types/database.types';

export interface ExtractionServiceOptions {
  supabaseClient?: ReturnType<typeof createAdminClient>;
  llmProvider?: LLMProvider;
  embeddingProvider?: EmbeddingProvider;
}

export type ExtractionResult =
  | {
      success: true;
      notification_id: string;
      facts: NotificationFacts;
      validation_status: 'valid';
    }
  | {
      success: false;
      notification_id: string;
      errors: string[];
      validation_status: 'flagged_for_review';
    };

/**
 * Service to execute the Understand step:
 * Invokes LLM extraction, validates against strict Zod schema,
 * rejects/flags failures lacking source clauses, computes 1536-dim embeddings,
 * and writes to notification_facts, embeddings, and audit_log.
 */
export async function extractNotificationFacts(
  notificationId: string,
  options?: ExtractionServiceOptions
): Promise<ExtractionResult> {
  const supabase = options?.supabaseClient || createAdminClient();
  const llm = options?.llmProvider || getLLMProvider();
  const embeddings = options?.embeddingProvider || getEmbeddingProvider();

  // 1. Fetch notification
  const { data: notification, error: notifError } = await supabase
    .from('notifications')
    .select('id, source_id, url, title, raw_text')
    .eq('id', notificationId)
    .single();

  if (notifError || !notification) {
    throw new Error(`Notification not found: ${notificationId}`);
  }

  // 2. Call LLM for fact extraction
  let rawLlmOutput: unknown;
  try {
    rawLlmOutput = await llm.extractFacts(notification.raw_text);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'LLM extraction failed';

    await supabase.from('audit_log').insert({
      actor: 'system:extractor',
      event_type: 'extraction_failed',
      entity_ref: `notification:${notification.id}`,
      payload: {
        error: errorMsg,
        llm_provider: llm.name,
      },
    });

    return {
      success: false,
      notification_id: notification.id,
      errors: [errorMsg],
      validation_status: 'flagged_for_review',
    };
  }

  // 3. Strict schema validation & source clause check
  const validation = validateExtraction(rawLlmOutput);

  if (!validation.success) {
    // Flag for review in notification_facts
    const fallbackFacts: Database['public']['Tables']['notification_facts']['Insert'] = {
      notification_id: notification.id,
      title: notification.title || 'Extracted Notification (Flagged)',
      summary_plain: 'Automated extraction failed validation checks or lacked required source clauses.',
      applies_to: {},
      change_type: 'clarification',
      required_actions: [],
      source_clauses: [],
      validation_status: 'flagged_for_review',
    };

    await supabase
      .from('notification_facts')
      .upsert(fallbackFacts, { onConflict: 'notification_id' });

    await supabase.from('audit_log').insert({
      actor: 'system:extractor',
      event_type: 'extraction_flagged',
      entity_ref: `notification:${notification.id}`,
      payload: {
        errors: validation.errors,
        raw_output: (validation.raw_data ?? null) as unknown as Database['public']['Tables']['audit_log']['Insert']['payload'],
        reason: 'Failed strict schema validation or missing source clauses',
      },
    });

    return {
      success: false,
      notification_id: notification.id,
      errors: validation.errors,
      validation_status: 'flagged_for_review',
    };
  }

  const validFacts = validation.data;

  // 4. Save validated facts
  const factsInsert: Database['public']['Tables']['notification_facts']['Insert'] = {
    notification_id: notification.id,
    title: validFacts.title,
    notification_number: validFacts.notification_number,
    published_date: validFacts.published_date,
    summary_plain: validFacts.summary_plain,
    applies_to: validFacts.applies_to,
    change_type: validFacts.change_type,
    effective_date: validFacts.effective_date,
    deadline: validFacts.deadline,
    required_actions: validFacts.required_actions,
    source_clauses: validFacts.source_clauses,
    validation_status: 'valid',
  };

  await supabase
    .from('notification_facts')
    .upsert(factsInsert, { onConflict: 'notification_id' });

  // 5. Generate 1536-dimensional embedding
  const textToEmbed = [
    `Title: ${validFacts.title}`,
    `Summary: ${validFacts.summary_plain}`,
    `Applies to: states ${validFacts.applies_to.states.join(', ')}, GST ${validFacts.applies_to.gst_statuses.join(', ')}`,
    `Industries: ${validFacts.applies_to.industries.join(', ')}`,
    validFacts.applies_to.turnover_max_inr ? `Turnover limit: INR ${validFacts.applies_to.turnover_max_inr}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const vector = await embeddings.embedText(textToEmbed);

    await supabase.from('embeddings').upsert(
      {
        owner_type: 'notification',
        owner_id: notification.id,
        vector,
        model: embeddings.name,
      },
      { onConflict: 'owner_type,owner_id,model' }
    );
  } catch (embedErr: unknown) {
    const errText = embedErr instanceof Error ? embedErr.message : 'Embedding error';
    await supabase.from('audit_log').insert({
      actor: 'system:extractor',
      event_type: 'embedding_failed',
      entity_ref: `notification:${notification.id}`,
      payload: { error: errText },
    });
  }

  // 6. Record success in audit log
  await supabase.from('audit_log').insert({
    actor: 'system:extractor',
    event_type: 'extracted',
    entity_ref: `notification:${notification.id}`,
    payload: {
      notification_number: validFacts.notification_number,
      change_type: validFacts.change_type,
      effective_date: validFacts.effective_date,
      deadline: validFacts.deadline,
      clauses_count: validFacts.source_clauses.length,
      actions_count: validFacts.required_actions.length,
    },
  });

  return {
    success: true,
    notification_id: notification.id,
    facts: validFacts,
    validation_status: 'valid',
  };
}
