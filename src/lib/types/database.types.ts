export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type GstStatus = 'registered_regular' | 'registered_composition' | 'unregistered';
export type MatchDecision = 'affects' | 'does_not_affect' | 'uncertain';
export type TaskStatus = 'pending' | 'done' | 'snoozed' | 'not_applicable';
export type ValidationStatus = 'valid' | 'flagged_for_review';
export type OwnerType = 'notification' | 'business';

export interface AppliesToCriteria {
  turnover_min_inr?: number | null;
  turnover_max_inr?: number | null;
  states?: string[];
  gst_statuses?: GstStatus[];
  industries?: string[];
  employee_min?: number | null;
  employee_max?: number | null;
}

export interface SourceClause {
  clause_reference: string;
  excerpt: string;
  page_or_para?: string;
}

export interface RequiredAction {
  action: string;
  deadline?: string | null;
  notes?: string;
}

export interface MatchEvidence {
  rule_matches: {
    rule: string;
    passed: boolean;
    reason: string;
  }[];
  semantic_score?: number | null;
  summary_reason: string;
}

export interface Database {
  public: {
    Tables: {
      sources: {
        Row: {
          id: string;
          name: string;
          slug: string;
          url: string;
          parser_type: string;
          frequency: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          url: string;
          parser_type?: string;
          frequency?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['sources']['Insert']>;
      };
      notifications: {
        Row: {
          id: string;
          source_id: string;
          url: string;
          title: string | null;
          content_hash: string;
          raw_text: string;
          fetched_at: string;
          version: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          url: string;
          title?: string | null;
          content_hash: string;
          raw_text: string;
          fetched_at?: string;
          version?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
      notification_facts: {
        Row: {
          id: string;
          notification_id: string;
          title: string;
          notification_number: string | null;
          published_date: string | null;
          summary_plain: string;
          applies_to: AppliesToCriteria;
          change_type: string;
          effective_date: string | null;
          deadline: string | null;
          required_actions: RequiredAction[];
          source_clauses: SourceClause[];
          validation_status: ValidationStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          notification_id: string;
          title: string;
          notification_number?: string | null;
          published_date?: string | null;
          summary_plain: string;
          applies_to: AppliesToCriteria;
          change_type?: string;
          effective_date?: string | null;
          deadline?: string | null;
          required_actions?: RequiredAction[];
          source_clauses?: SourceClause[];
          validation_status?: ValidationStatus;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notification_facts']['Insert']>;
      };
      embeddings: {
        Row: {
          id: string;
          owner_type: OwnerType;
          owner_id: string;
          vector: number[];
          model: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_type: OwnerType;
          owner_id: string;
          vector: number[];
          model: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['embeddings']['Insert']>;
      };
      businesses: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          state: string;
          gst_status: GstStatus;
          turnover_band: string;
          employee_count: number;
          industry: string;
          description: string | null;
          telegram_chat_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          state?: string;
          gst_status: GstStatus;
          turnover_band: string;
          employee_count?: number;
          industry: string;
          description?: string | null;
          telegram_chat_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['businesses']['Insert']>;
      };
      matches: {
        Row: {
          id: string;
          business_id: string;
          notification_id: string;
          decision: MatchDecision;
          evidence: MatchEvidence;
          score: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          notification_id: string;
          decision: MatchDecision;
          evidence: MatchEvidence;
          score?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['matches']['Insert']>;
      };
      tasks: {
        Row: {
          id: string;
          business_id: string;
          match_id: string;
          title: string;
          description: string | null;
          source_url: string;
          due_date: string;
          status: TaskStatus;
          snoozed_until: string | null;
          feedback_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          match_id: string;
          title: string;
          description?: string | null;
          source_url: string;
          due_date: string;
          status?: TaskStatus;
          snoozed_until?: string | null;
          feedback_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
      };
      reminders: {
        Row: {
          id: string;
          task_id: string;
          send_at: string;
          sent_at: string | null;
          channel: string;
          escalation_level: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          send_at: string;
          sent_at?: string | null;
          channel?: string;
          escalation_level?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['reminders']['Insert']>;
      };
      audit_log: {
        Row: {
          id: string;
          actor: string;
          event_type: string;
          entity_ref: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor: string;
          event_type: string;
          entity_ref: string;
          payload?: Json;
          created_at?: string;
        };
        Update: never;
      };
    };
  };
}
