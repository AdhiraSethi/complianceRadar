import type { NotificationFacts } from '@/lib/extractor/schema';
import type { LLMProvider } from './types';

export class MockLLMProvider implements LLMProvider {
  name = 'mock';
  private cannedResponse?: Partial<NotificationFacts>;

  constructor(cannedResponse?: Partial<NotificationFacts>) {
    this.cannedResponse = cannedResponse;
  }

  async extractFacts(rawDocumentText: string): Promise<unknown> {
    if (this.cannedResponse) {
      return this.cannedResponse;
    }

    // Default heuristic mock response for sample tests
    return {
      title: 'Extension of GSTR-3B due date for quarterly filers in Delhi',
      notification_number: '12/2024-Central Tax',
      published_date: '2024-07-10',
      summary_plain:
        'Small businesses and traders registered under the quarterly filing scheme have an extended deadline to file Form GSTR-3B without late fees.',
      applies_to: {
        turnover_min_inr: 0,
        turnover_max_inr: 15000000,
        states: ['DL'],
        gst_statuses: ['registered_regular'],
        industries: ['ALL'],
        employee_min: 0,
        employee_max: null,
      },
      change_type: 'extension',
      effective_date: '2024-07-10',
      deadline: '2024-07-28',
      required_actions: [
        {
          action: 'File quarterly Form GSTR-3B on the GST portal before July 28, 2024',
          deadline: '2024-07-28',
          notes: 'No late fee if submitted before new deadline',
        },
      ],
      source_clauses: [
        {
          clause_reference: 'Notification No. 12/2024-Central Tax, Paragraph 2',
          excerpt:
            'In exercise of the powers conferred by section 148 of the Central Goods and Services Tax Act, 2017, the Commissioner hereby extends the due date for furnishing the return in FORM GSTR-3B...',
          page_or_para: 'Paragraph 2',
        },
      ],
    };
  }
}
