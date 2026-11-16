import { inngest } from '../client';
import { createAdminClient } from '@/lib/supabase/admin';
import { crawlSource } from '@/lib/crawler/service';

/**
 * Scheduled Daily Cron Job:
 * Triggers every day at 06:00 UTC (11:30 AM IST).
 * Fans out individual crawl events for each active source in the registry.
 */
export const dailyCrawlSchedule = inngest.createFunction(
  {
    id: 'daily-gst-crawl-schedule',
    name: 'Daily Regulatory Crawl Schedule',
  },
  [
    { cron: '0 6 * * *' },
    { event: 'complianceradar/crawl.trigger' },
  ],
  async ({ step }) => {
    const sources: Array<{ id: string; name: string; url: string; parser_type: string; is_active: boolean }> =
      await step.run('fetch-active-sources', async () => {
        const supabase = createAdminClient();
        const { data, error } = await supabase
          .from('sources')
          .select('id, name, url, parser_type, is_active')
          .eq('is_active', true);

        if (error) {
          throw new Error(`Failed to fetch active sources: ${error.message}`);
        }
        return (data || []) as Array<{ id: string; name: string; url: string; parser_type: string; is_active: boolean }>;
      });

    if (sources.length === 0) {
      return { status: 'no_active_sources' };
    }

    // Fan-out crawl events per source
    const events = sources.map((source) => ({
      name: 'complianceradar/source.crawl' as const,
      data: {
        source_id: source.id,
      },
    }));

    await step.sendEvent('fan-out-source-crawls', events);

    return {
      status: 'scheduled',
      total_sources: sources.length,
    };
  }
);

/**
 * Serialized Crawl Function per Source:
 * Guaranteed serialized execution per source_id (concurrency limit = 1).
 */
export const crawlSingleSourceFunction = inngest.createFunction(
  {
    id: 'crawl-single-source',
    name: 'Crawl Single Regulatory Source',
    concurrency: {
      key: 'event.data.source_id',
      limit: 1,
    },
  },
  { event: 'complianceradar/source.crawl' },
  async ({ event, step }) => {
    const { source_id } = event.data;

    const source: { id: string; name: string; url: string; parser_type: string; is_active: boolean } =
      await step.run('get-source-record', async () => {
        const supabase = createAdminClient();
        const { data, error } = await supabase
          .from('sources')
          .select('id, name, url, parser_type, is_active')
          .eq('id', source_id)
          .single();

        if (error || !data) {
          throw new Error(`Source not found: ${source_id}`);
        }
        return data as { id: string; name: string; url: string; parser_type: string; is_active: boolean };
      });

    const result = await step.run('execute-crawl-and-detect-changes', async () => {
      return await crawlSource(source);
    });

    // If new or changed documents were discovered, trigger Understand step for each
    if (result.new_documents.length > 0 || result.changed_documents.length > 0) {
      const docsToUnderstand = [...result.new_documents, ...result.changed_documents];

      const extractionEvents = docsToUnderstand.map((doc) => ({
        name: 'complianceradar/notification.extracted' as const,
        data: {
          source_id: source.id,
          content_hash: doc.content_hash,
          url: doc.url,
          title: doc.title,
        },
      }));

      await step.sendEvent('trigger-document-extraction', extractionEvents);
    }

    return {
      source_id: result.source_id,
      is_healthy: result.is_healthy,
      total_found: result.total_documents_found,
      new_count: result.new_documents.length,
      changed_count: result.changed_documents.length,
      unchanged_count: result.unchanged_count,
    };
  }
);
