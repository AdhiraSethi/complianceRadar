import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractNotificationFacts } from '@/lib/extractor/service';

/**
 * Understand Inngest Function:
 * Triggered when a new or changed notification is stored by the crawler.
 * Calls the LLM fact extraction service, validates output, and advances to Match.
 */
export const understandNotificationFunction = inngest.createFunction(
  {
    id: 'understand-notification',
    name: 'Extract Structured Facts from Notification',
  },
  { event: 'complianceradar/notification.extracted' },
  async ({ event, step }) => {
    const { source_id, content_hash } = event.data;

    // 1. Locate the notification row in Supabase
    const notificationId = await step.run('find-notification-id', async () => {
      const supabase = createAdminClient();
      const { data, error } = await supabase
        .from('notifications')
        .select('id')
        .eq('source_id', source_id)
        .eq('content_hash', content_hash)
        .single();

      if (error || !data) {
        throw new Error(`Notification not found for source ${source_id} and hash ${content_hash}`);
      }
      return data.id;
    });

    // 2. Perform LLM Extraction, Zod validation, and vector embedding
    const result = await step.run('extract-and-embed-facts', async () => {
      return await extractNotificationFacts(notificationId);
    });

    // 3. If validation succeeded, trigger the Match step
    if (result.success && result.validation_status === 'valid') {
      await step.sendEvent('trigger-matching', {
        name: 'complianceradar/notification.ready_for_matching',
        data: {
          notification_id: result.notification_id,
          notification_number: result.facts.notification_number,
        },
      });
    }

    return {
      notification_id: result.notification_id,
      validation_status: result.validation_status,
      success: result.success,
    };
  }
);
