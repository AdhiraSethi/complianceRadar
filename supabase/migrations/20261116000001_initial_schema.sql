-- ComplianceRadar Initial Schema Migration
-- Extensions
create extension if not exists "vector" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- 1. Sources (Official regulatory registries, e.g. CBIC GST Notifications)
create table if not exists public.sources (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    url text not null,
    parser_type text not null default 'cbic_gst',
    frequency text not null default 'daily',
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- 2. Notifications (Raw crawled notifications with content hash for idempotency)
create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    source_id uuid not null references public.sources(id) on delete cascade,
    url text not null,
    title text,
    content_hash text not null,
    raw_text text not null,
    fetched_at timestamptz not null default now(),
    version int not null default 1,
    created_at timestamptz not null default now(),
    constraint notifications_source_content_hash_key unique (source_id, content_hash)
);

create index if not exists idx_notifications_source_id on public.notifications(source_id);
create index if not exists idx_notifications_fetched_at on public.notifications(fetched_at desc);

-- 3. Notification Facts (Structured facts extracted via LLM & validated by Zod)
create table if not exists public.notification_facts (
    id uuid primary key default gen_random_uuid(),
    notification_id uuid not null unique references public.notifications(id) on delete cascade,
    title text not null,
    notification_number text,
    published_date date,
    summary_plain text not null,
    applies_to jsonb not null default '{}'::jsonb,
    change_type text not null default 'new_rule',
    effective_date date,
    deadline date,
    required_actions jsonb not null default '[]'::jsonb,
    source_clauses jsonb not null default '[]'::jsonb,
    validation_status text not null default 'valid' check (validation_status in ('valid', 'flagged_for_review')),
    created_at timestamptz not null default now()
);

create index if not exists idx_notification_facts_deadline on public.notification_facts(deadline);

-- 4. Embeddings (1536-dimensional vectors for semantic matching)
create table if not exists public.embeddings (
    id uuid primary key default gen_random_uuid(),
    owner_type text not null check (owner_type in ('notification', 'business')),
    owner_id uuid not null,
    vector extensions.vector(1536) not null,
    model text not null,
    created_at timestamptz not null default now(),
    constraint embeddings_owner_model_key unique (owner_type, owner_id, model)
);

create index if not exists idx_embeddings_owner on public.embeddings(owner_type, owner_id);

-- 5. Businesses (Profiles registered under an owner)
create table if not exists public.businesses (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    state text not null default 'DL',
    gst_status text not null check (gst_status in ('registered_regular', 'registered_composition', 'unregistered')),
    turnover_band text not null,
    employee_count int not null default 0,
    industry text not null,
    description text,
    telegram_chat_id text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_businesses_owner on public.businesses(owner_id);

-- 6. Matches (Applicability decisions from hybrid engine: rules + vector similarity)
create table if not exists public.matches (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    notification_id uuid not null references public.notifications(id) on delete cascade,
    decision text not null check (decision in ('affects', 'does_not_affect', 'uncertain')),
    evidence jsonb not null default '{}'::jsonb,
    score numeric(6, 5),
    created_at timestamptz not null default now(),
    constraint matches_business_notification_key unique (business_id, notification_id)
);

create index if not exists idx_matches_business on public.matches(business_id);
create index if not exists idx_matches_decision on public.matches(decision);

-- 7. Tasks (Compliance calendar tasks generated from matches)
create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    business_id uuid not null references public.businesses(id) on delete cascade,
    match_id uuid not null references public.matches(id) on delete cascade,
    title text not null,
    description text,
    source_url text not null,
    due_date date not null,
    status text not null default 'pending' check (status in ('pending', 'done', 'snoozed', 'not_applicable')),
    snoozed_until date,
    feedback_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint tasks_business_match_key unique (business_id, match_id)
);

create index if not exists idx_tasks_business on public.tasks(business_id);
create index if not exists idx_tasks_due_date on public.tasks(due_date);
create index if not exists idx_tasks_status on public.tasks(status);

-- 8. Reminders (Escalating follow-ups until tasks are done)
create table if not exists public.reminders (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references public.tasks(id) on delete cascade,
    send_at timestamptz not null,
    sent_at timestamptz,
    channel text not null default 'telegram',
    escalation_level int not null default 1,
    created_at timestamptz not null default now()
);

create index if not exists idx_reminders_task on public.reminders(task_id);
create index if not exists idx_reminders_pending on public.reminders(send_at) where sent_at is null;

-- 9. Audit Log (Append-only record of all actions)
create table if not exists public.audit_log (
    id uuid primary key default gen_random_uuid(),
    actor text not null,
    event_type text not null,
    entity_ref text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_event on public.audit_log(event_type);
create index if not exists idx_audit_log_entity on public.audit_log(entity_ref);
create index if not exists idx_audit_log_created_at on public.audit_log(created_at desc);

-- Protect audit_log against UPDATE and DELETE (Append-Only)
create or replace function public.prevent_audit_log_mutation()
returns trigger as $$
begin
    raise exception 'audit_log is append-only. UPDATE and DELETE are prohibited.';
end;
$$ language plpgsql;

create or replace trigger trg_protect_audit_log
before update or delete on public.audit_log
for each row execute function public.prevent_audit_log_mutation();

-- Row Level Security (RLS)
alter table public.sources enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_facts enable row level security;
alter table public.embeddings enable row level security;
alter table public.businesses enable row level security;
alter table public.matches enable row level security;
alter table public.tasks enable row level security;
alter table public.reminders enable row level security;
alter table public.audit_log enable row level security;

-- RLS Policies
-- Sources, Notifications, Notification Facts: Authenticated users can read
create policy "Authenticated users can read sources" on public.sources
    for select to authenticated using (true);

create policy "Authenticated users can read notifications" on public.notifications
    for select to authenticated using (true);

create policy "Authenticated users can read notification_facts" on public.notification_facts
    for select to authenticated using (true);

-- Businesses: Owners see only their own businesses
create policy "Owners can view their businesses" on public.businesses
    for select to authenticated using (auth.uid() = owner_id);

create policy "Owners can create their businesses" on public.businesses
    for insert to authenticated with check (auth.uid() = owner_id);

create policy "Owners can update their businesses" on public.businesses
    for update to authenticated using (auth.uid() = owner_id);

-- Matches: Owners see matches for their businesses
create policy "Owners can view matches for their businesses" on public.matches
    for select to authenticated using (
        exists (
            select 1 from public.businesses b
            where b.id = matches.business_id and b.owner_id = auth.uid()
        )
    );

-- Tasks: Owners manage tasks for their businesses
create policy "Owners can view tasks for their businesses" on public.tasks
    for select to authenticated using (
        exists (
            select 1 from public.businesses b
            where b.id = tasks.business_id and b.owner_id = auth.uid()
        )
    );

create policy "Owners can update tasks for their businesses" on public.tasks
    for update to authenticated using (
        exists (
            select 1 from public.businesses b
            where b.id = tasks.business_id and b.owner_id = auth.uid()
        )
    );

-- Reminders: Owners can view reminders for their tasks
create policy "Owners can view reminders for their tasks" on public.reminders
    for select to authenticated using (
        exists (
            select 1 from public.tasks t
            join public.businesses b on b.id = t.business_id
            where t.id = reminders.task_id and b.owner_id = auth.uid()
        )
    );

-- Audit log: Authenticated users can view entries related to their user id or businesses
create policy "Owners can view relevant audit log entries" on public.audit_log
    for select to authenticated using (
        actor = ('user:' || auth.uid()::text) or
        exists (
            select 1 from public.businesses b
            where b.owner_id = auth.uid() and audit_log.entity_ref = ('business:' || b.id::text)
        )
    );
