import { computeContentHash } from '../hasher';
import { CrawledDocumentSchema, type CrawledDocument, type SourceParser } from '../types';

const MONTH_MAP: Record<string, string> = {
  january: '01',
  jan: '01',
  february: '02',
  feb: '02',
  march: '03',
  mar: '03',
  april: '04',
  apr: '04',
  may: '05',
  june: '06',
  jun: '06',
  july: '07',
  jul: '07',
  august: '08',
  aug: '08',
  september: '09',
  sep: '09',
  sept: '09',
  october: '10',
  oct: '10',
  november: '11',
  nov: '11',
  december: '12',
  dec: '12',
};

/**
 * Robust, timezone-independent date parser for Indian official portals:
 * Parses formats like "10/07/2024", "10-07-2024", "10.07.2024", "10 July 2024", "10th July 2024", "2024-07-10"
 */
export function parseOfficialDate(rawDate: string): string | null {
  const clean = rawDate.trim().replace(/(st|nd|rd|th)/gi, '');

  // Format: YYYY-MM-DD
  const isoMatch = clean.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Format: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Format: "10 July 2024" or "July 10, 2024"
  const namedMatch1 = clean.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/);
  if (namedMatch1) {
    const [, d, monthName, y] = namedMatch1;
    const m = MONTH_MAP[monthName.toLowerCase()];
    if (m) {
      return `${y}-${m}-${d.padStart(2, '0')}`;
    }
  }

  const namedMatch2 = clean.match(/^([a-zA-Z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (namedMatch2) {
    const [, monthName, d, y] = namedMatch2;
    const m = MONTH_MAP[monthName.toLowerCase()];
    if (m) {
      return `${y}-${m}-${d.padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Strip HTML tags and entities
 */
export function cleanHtmlText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parser for CBIC GST Central Tax notifications table.
 */
export const cbicGstParser: SourceParser = {
  parser_type: 'cbic_gst',

  async parse(html: string, baseUrl: string): Promise<CrawledDocument[]> {
    const documents: CrawledDocument[] = [];

    // Extract table rows: <tr>...</tr>
    const rowMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) || [];

    for (const rowHtml of rowMatches) {
      // Extract individual cells: <td>...</td>
      const cellMatches = rowHtml.match(/<td[\s\S]*?<\/td>/gi) || [];
      if (cellMatches.length < 3) continue;

      const cells = cellMatches.map((c) => cleanHtmlText(c));

      // Notification tables usually have:
      // Cell 0: Notification Number (e.g. "04/2024 - Central Tax" or "04/2024-CT")
      // Cell 1: Date (e.g. "10-07-2024")
      // Cell 2: Subject/Description (e.g. "Seeks to amend notification...")
      const notifNumber = cells[0];
      const dateRaw = cells[1];
      const subject = cells[2];

      // Ignore header rows
      if (
        /notification\s*no/i.test(notifNumber) ||
        /date/i.test(dateRaw) ||
        !notifNumber ||
        !subject
      ) {
        continue;
      }

      const formattedDate = parseOfficialDate(dateRaw);
      if (!formattedDate) continue;

      // Extract PDF or direct notification link from row
      const hrefMatch = rowHtml.match(/href=["']([^"']+)["']/i);
      let docUrl = baseUrl;
      let pdfUrl: string | undefined = undefined;

      if (hrefMatch && hrefMatch[1]) {
        try {
          const resolvedUrl = new URL(hrefMatch[1], baseUrl).toString();
          if (resolvedUrl.toLowerCase().endsWith('.pdf')) {
            pdfUrl = resolvedUrl;
            docUrl = resolvedUrl;
          } else {
            docUrl = resolvedUrl;
          }
        } catch {
          // If relative URL resolution fails, fall back to base URL with anchor
          docUrl = `${baseUrl}#${encodeURIComponent(notifNumber)}`;
        }
      } else {
        docUrl = `${baseUrl}#${encodeURIComponent(notifNumber)}`;
      }

      // Combine structured content for deterministic hashing
      const rawText = `Notification No: ${notifNumber}\nDate: ${formattedDate}\nSubject: ${subject}`;
      const contentHash = computeContentHash(rawText);

      const docCandidate = {
        url: docUrl,
        title: subject,
        notification_number: notifNumber,
        published_date: formattedDate,
        raw_text: rawText,
        content_hash: contentHash,
        pdf_url: pdfUrl,
      };

      const parsed = CrawledDocumentSchema.safeParse(docCandidate);
      if (parsed.success) {
        documents.push(parsed.data);
      }
    }

    return documents;
  },
};
