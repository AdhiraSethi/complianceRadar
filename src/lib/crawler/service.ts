import { createAdminClient } from '@/lib/supabase/admin';
import { getParser } from './parsers';
import { CrawlResultSchema, type CrawlResult, type CrawledDocument } from './types';

export interface SourceRecord {
  id: string;
  name: string;
  url: string;
  parser_type: string;
  is_active: boolean;
}

export interface CrawlServiceOptions {
  supabaseClient?: ReturnType<typeof createAdminClient>;
  fetchFn?: typeof fetch;
}

/**
 * Service to execute crawls for regulatory sources, perform change detection,
 * trigger operational health alerts on zero-results, and persist documents idempotently.
 */
export async function crawlSource(
  source: SourceRecord,
  options?: CrawlServiceOptions
): Promise<CrawlResult> {
  const supabase = options?.supabaseClient || createAdminClient();
  const fetcher = options?.fetchFn || fetch;
  const fetchedAt = new Date().toISOString();

  let html = '';
  try {
    const response = await fetcher(source.url, {
      headers: {
        'User-Agent':
          'ComplianceRadar-Bot/1.0 (+https://github.com/complianceradar; compliance monitoring for Indian MSMEs)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP fetch failed with status ${response.status}: ${response.statusText}`);
    }

    html = await response.text();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown fetch error';

    // Log operational alert to audit log
    await supabase.from('audit_log').insert({
      actor: 'system:crawler',
      event_type: 'operational_health_alert',
      entity_ref: `source:${source.id}`,
      payload: {
        source_name: source.name,
        source_url: source.url,
        error: errorMsg,
        reason: 'HTTP fetch failed during crawl',
        timestamp: fetchedAt,
      },
    });

    return CrawlResultSchema.parse({
      source_id: source.id,
      source_name: source.name,
      source_url: source.url,
      fetched_at: fetchedAt,
      total_documents_found: 0,
      new_documents: [],
      changed_documents: [],
      unchanged_count: 0,
      is_healthy: false,
      error_message: errorMsg,
    });
  }

  // Parse HTML
  let documents: CrawledDocument[] = [];
  try {
    const parser = getParser(source.parser_type);
    documents = await parser.parse(html, source.url);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Parsing error';

    await supabase.from('audit_log').insert({
      actor: 'system:crawler',
      event_type: 'operational_health_alert',
      entity_ref: `source:${source.id}`,
      payload: {
        source_name: source.name,
        parser_type: source.parser_type,
        error: errorMsg,
        reason: 'Parser threw exception',
        timestamp: fetchedAt,
      },
    });

    return CrawlResultSchema.parse({
      source_id: source.id,
      source_name: source.name,
      source_url: source.url,
      fetched_at: fetchedAt,
      total_documents_found: 0,
      new_documents: [],
      changed_documents: [],
      unchanged_count: 0,
      is_healthy: false,
      error_message: errorMsg,
    });
  }

  // Health Alert: Zero results returned from an active source
  if (documents.length === 0) {
    const reason = 'Crawl returned zero notifications. Source markup may have changed or site is empty.';
    await supabase.from('audit_log').insert({
      actor: 'system:crawler',
      event_type: 'operational_health_alert',
      entity_ref: `source:${source.id}`,
      payload: {
        source_name: source.name,
        source_url: source.url,
        reason,
        timestamp: fetchedAt,
      },
    });

    return CrawlResultSchema.parse({
      source_id: source.id,
      source_name: source.name,
      source_url: source.url,
      fetched_at: fetchedAt,
      total_documents_found: 0,
      new_documents: [],
      changed_documents: [],
      unchanged_count: 0,
      is_healthy: false,
      error_message: reason,
    });
  }

  // Fetch existing notifications for this source to perform change detection
  const { data: existingRows } = await supabase
    .from('notifications')
    .select('id, url, content_hash, version')
    .eq('source_id', source.id);

  const existingByHash = new Set((existingRows || []).map((r) => r.content_hash));
  const existingByUrl = new Map(
    (existingRows || []).map((r) => [r.url, { id: r.id, hash: r.content_hash, version: r.version }])
  );

  const newDocs: CrawledDocument[] = [];
  const changedDocs: CrawledDocument[] = [];
  let unchangedCount = 0;

  for (const doc of documents) {
    if (existingByHash.has(doc.content_hash)) {
      // Content hash is identical: No change, idempotent skip
      unchangedCount++;
      continue;
    }

    const previousVersion = existingByUrl.get(doc.url);

    if (previousVersion) {
      // Same URL, but new content hash: It is an updated/amended document
      const newVersion = previousVersion.version + 1;
      const { data: inserted, error } = await supabase
        .from('notifications')
        .insert({
          source_id: source.id,
          url: doc.url,
          title: doc.title,
          content_hash: doc.content_hash,
          raw_text: doc.raw_text,
          fetched_at: fetchedAt,
          version: newVersion,
        })
        .select('id')
        .single();

      if (!error && inserted) {
        changedDocs.push(doc);
        await supabase.from('audit_log').insert({
          actor: 'system:crawler',
          event_type: 'notification_changed',
          entity_ref: `notification:${inserted.id}`,
          payload: {
            source_id: source.id,
            url: doc.url,
            previous_version: previousVersion.version,
            new_version: newVersion,
            content_hash: doc.content_hash,
          },
        });
      }
    } else {
      // Unknown URL and new hash: Brand new notification
      const { data: inserted, error } = await supabase
        .from('notifications')
        .insert({
          source_id: source.id,
          url: doc.url,
          title: doc.title,
          content_hash: doc.content_hash,
          raw_text: doc.raw_text,
          fetched_at: fetchedAt,
          version: 1,
        })
        .select('id')
        .single();

      if (!error && inserted) {
        newDocs.push(doc);
        await supabase.from('audit_log').insert({
          actor: 'system:crawler',
          event_type: 'notification_created',
          entity_ref: `notification:${inserted.id}`,
          payload: {
            source_id: source.id,
            url: doc.url,
            content_hash: doc.content_hash,
            notification_number: doc.notification_number,
          },
        });
      }
    }
  }

  // Record summary crawl event in audit log
  await supabase.from('audit_log').insert({
    actor: 'system:crawler',
    event_type: 'crawled',
    entity_ref: `source:${source.id}`,
    payload: {
      source_name: source.name,
      total_found: documents.length,
      new_count: newDocs.length,
      changed_count: changedDocs.length,
      unchanged_count: unchangedCount,
      timestamp: fetchedAt,
    },
  });

  return CrawlResultSchema.parse({
    source_id: source.id,
    source_name: source.name,
    source_url: source.url,
    fetched_at: fetchedAt,
    total_documents_found: documents.length,
    new_documents: newDocs,
    changed_documents: changedDocs,
    unchanged_count: unchangedCount,
    is_healthy: true,
  });
}
