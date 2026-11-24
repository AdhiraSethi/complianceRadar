import { inngest } from '../client';
import { matchNotificationToAllBusinesses } from '@/lib/matcher/service';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Match Inngest Function:
 * Triggered when a notification has structured facts and embeddings ready.
 * Evaluates all registered businesses with the hybrid engine.
 */
export const matchNotificationFunction = inngest.createFunction(
  {
    id: 'match-notification-to-businesses',
    name: 'Match Notification Across Registered Businesses',
  },
  { event: 'complianceradar/notification.ready_for_matching' },
  async ({ event, step }) => {
    const { notification_id } = event.data;

    // 1. Run hybrid matching across all businesses
    const summary = await step.run('run-hybrid-matching', async () => {
      return await matchNotificationToAllBusinesses(notification_id);
    });

    // 2. Fetch matches that affect or are uncertain to trigger alerts & calendar tasks
    const relevantMatches = await step.run('fetch-relevant-matches', async () => {
      const supabase = createAdminClient();
      const { data } = await supabase
        .from('matches')
        .select('id, business_id, decision, score')
        .eq('notification_id', notification_id)
        .in('decision', ['affects', 'uncertain']);

      return data || [];
    });

    // 3. Emit alert & task creation events for positive and uncertain matches
    if (relevantMatches.length > 0) {
      const alertEvents = relevantMatches.map((m) => ({
        name: 'complianceradar/match.action_required' as const,
        data: {
          match_id: m.id,
          business_id: m.business_id,
          notification_id: notification_id,
          decision: m.decision,
        },
      }));

      await step.sendEvent('fan-out-alerts-and-tasks', alertEvents);
    }

    return {
      notification_id,
      evaluated_count: summary.total_businesses_evaluated,
      affects_count: summary.affects_count,
      uncertain_count: summary.uncertain_count,
      does_not_affect_count: summary.does_not_affect_count,
    };
  }
);
