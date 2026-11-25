-- Private recovery archive for the initial expansion quality correction.
create table if not exists public.content_expansion_recovery (
 id uuid primary key default gen_random_uuid(), saved_at timestamptz not null default now(),
 reason text not null, plan_snapshot jsonb not null, queue_snapshot jsonb not null
);
alter table public.content_expansion_recovery enable row level security;
revoke all on public.content_expansion_recovery from anon,authenticated;
