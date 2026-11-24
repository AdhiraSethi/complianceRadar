import { createAdminClient } from '@/lib/supabase/admin';
import { cosineSimilarity } from '@/lib/ai/embeddings/types';
import { evaluateHybridMatch, type HybridMatchResult } from './engine';
import type { BusinessProfile } from '../business/types';
import type { AppliesToCriteria, Database } from '../types/database.types';

export interface MatchServiceOptions {
  supabaseClient?: ReturnType<typeof createAdminClient>;
}

export interface MatchNotificationSummary {
  notification_id: string;
  total_businesses_evaluated: number;
  affects_count: number;
  uncertain_count: number;
  does_not_affect_count: number;
}

/**
 * Matches a specific business against a notification using the hybrid engine.
 */
export async function matchBusinessToNotification(
  businessId: string,
  notificationId: string,
  options?: MatchServiceOptions
): Promise<HybridMatchResult & { match_id?: string }> {
  const supabase = options?.supabaseClient || createAdminClient();

  // 1. Fetch business profile
  const { data: businessRow, error: bError } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();

  if (bError || !businessRow) {
    throw new Error(`Business not found: ${businessId}`);
  }

  // 2. Fetch notification facts
  const { data: factsRow, error: fError } = await supabase
    .from('notification_facts')
    .select('*')
    .eq('notification_id', notificationId)
    .single();

  if (fError || !factsRow) {
    throw new Error(`Notification facts not found: ${notificationId}`);
  }

  // 3. Fetch embeddings for business and notification to compute semantic score
  const { data: embeddings } = await supabase
    .from('embeddings')
    .select('owner_type, vector')
    .or(
      `and(owner_type.eq.business,owner_id.eq.${businessId}),and(owner_type.eq.notification,owner_id.eq.${notificationId})`
    );

  let semanticScore: number | null = null;
  const bEmbedding = embeddings?.find((e) => e.owner_type === 'business');
  const nEmbedding = embeddings?.find((e) => e.owner_type === 'notification');

  if (bEmbedding?.vector && nEmbedding?.vector) {
    try {
      semanticScore = cosineSimilarity(bEmbedding.vector, nEmbedding.vector);
    } catch {
      semanticScore = null;
    }
  }

  // 4. Run Hybrid Relevance Engine
  const businessProfile: BusinessProfile = {
    id: businessRow.id,
    owner_id: businessRow.owner_id,
    name: businessRow.name,
    state: businessRow.state,
    gst_status: businessRow.gst_status,
    turnover_band: businessRow.turnover_band as BusinessProfile['turnover_band'],
    employee_count: businessRow.employee_count,
    industry: businessRow.industry,
    description: businessRow.description || '',
    telegram_chat_id: businessRow.telegram_chat_id,
  };

  const appliesTo = factsRow.applies_to as AppliesToCriteria;
  const result = evaluateHybridMatch(businessProfile, appliesTo, { semanticScore });

  // 5. Store match decision idempotently
  const matchPayload: Database['public']['Tables']['matches']['Insert'] = {
    business_id: businessId,
    notification_id: notificationId,
    decision: result.decision,
    evidence: result.evidence,
    score: result.score,
  };

  const { data: matchRecord } = await supabase
    .from('matches')
    .upsert(matchPayload, { onConflict: 'business_id,notification_id' })
    .select('id')
    .single();

  // 6. Write decision to audit log
  await supabase.from('audit_log').insert({
    actor: 'system:matcher',
    event_type: 'matched',
    entity_ref: `match:${matchRecord?.id || businessId}`,
    payload: {
      business_id: businessId,
      notification_id: notificationId,
      decision: result.decision,
      score: result.score,
      summary_reason: result.evidence.summary_reason,
    },
  });

  return {
    ...result,
    match_id: matchRecord?.id,
  };
}

/**
 * Fans out matching of a notification across all registered businesses.
 */
export async function matchNotificationToAllBusinesses(
  notificationId: string,
  options?: MatchServiceOptions
): Promise<MatchNotificationSummary> {
  const supabase = options?.supabaseClient || createAdminClient();

  const { data: businesses, error } = await supabase
    .from('businesses')
    .select('id');

  if (error) {
    throw new Error(`Failed to list businesses for matching: ${error.message}`);
  }

  const allBusinesses = businesses || [];
  let affectsCount = 0;
  let uncertainCount = 0;
  let doesNotAffectCount = 0;

  for (const b of allBusinesses) {
    const res = await matchBusinessToNotification(b.id, notificationId, options);
    if (res.decision === 'affects') affectsCount++;
    else if (res.decision === 'uncertain') uncertainCount++;
    else doesNotAffectCount++;
  }

  return {
    notification_id: notificationId,
    total_businesses_evaluated: allBusinesses.length,
    affects_count: affectsCount,
    uncertain_count: uncertainCount,
    does_not_affect_count: doesNotAffectCount,
  };
}
