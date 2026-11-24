import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { dailyCrawlSchedule, crawlSingleSourceFunction } from '@/lib/inngest/functions/crawl';
import { understandNotificationFunction } from '@/lib/inngest/functions/understand';
import { matchNotificationFunction } from '@/lib/inngest/functions/match';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    dailyCrawlSchedule,
    crawlSingleSourceFunction,
    understandNotificationFunction,
    matchNotificationFunction,
  ],
});
