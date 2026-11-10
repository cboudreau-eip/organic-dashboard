-- Immutable aggregate checkpoints. Only authenticated application server routes expose history.
create table public.datorama_cohort_checkpoints (
 id text primary key,
 source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
 scope_id text not null check (scope_id = 'medicarefaq-production'),
 cohort_month date not null check (extract(day from cohort_month) = 1),
 source_exported_at timestamptz not null,
 lead_data_through date not null,
 saved_at timestamptz not null default now(),
 report jsonb not null check (jsonb_typeof(report) = 'object'),
 unique (source_hash, cohort_month)
);
create index datorama_cohort_checkpoint_history on public.datorama_cohort_checkpoints
 (scope_id, cohort_month, source_exported_at desc, saved_at desc, id desc);
alter table public.datorama_cohort_checkpoints enable row level security;
revoke all on public.datorama_cohort_checkpoints from public, anon, authenticated, service_role;
grant select, insert on public.datorama_cohort_checkpoints to service_role;
