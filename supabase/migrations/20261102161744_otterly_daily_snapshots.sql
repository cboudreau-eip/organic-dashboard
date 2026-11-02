create table public.otterly_snapshots (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 period_end date not null unique,
 payload jsonb not null,
 constraint otterly_payload_scope check (
   payload->>'reportId' = '01KVG7BNGPHG2M0RD4T9D9EVA3' and
   payload->>'domain' = 'medicarefaq.com' and payload->>'country' = 'us' and
   payload->'period'->>'end' = period_end::text and
   payload ?& array['reportId','domain','country','period','summary','pages','prompts','fetchedAt'] and
   octet_length(payload::text) < 3000000
 )
);
alter table public.otterly_snapshots enable row level security;
revoke all on public.otterly_snapshots from public,anon,authenticated;
grant select on public.otterly_snapshots to authenticated;
grant select,insert on public.otterly_snapshots to service_role;
create policy otterly_member_read on public.otterly_snapshots for select to authenticated
 using ((select public.growth_access()) in ('viewer','analyst','admin'));

create table public.otterly_sync_runs (
 period_end date primary key,
 started_at timestamptz not null default now(),
 finished_at timestamptz,
 status text not null check(status in ('running','complete','failed')),
 message text,
 attempts integer not null default 1
);
alter table public.otterly_sync_runs enable row level security;
revoke all on public.otterly_sync_runs from public,anon,authenticated;
grant select on public.otterly_sync_runs to authenticated;
grant select,insert,update on public.otterly_sync_runs to service_role;
create policy otterly_run_member_read on public.otterly_sync_runs for select to authenticated
 using ((select public.growth_access()) in ('viewer','analyst','admin'));

-- Only the server role can claim a daily job. Retries are spaced out and bounded.
create function public.otterly_claim_sync(p_end date) returns boolean
language sql security invoker set search_path = '' as $$
 with claimed as (
  insert into public.otterly_sync_runs(period_end,status) values(p_end,'running')
  on conflict(period_end) do update set started_at=now(),finished_at=null,status='running',message=null,attempts=public.otterly_sync_runs.attempts+1
  where public.otterly_sync_runs.status <> 'complete'
    and public.otterly_sync_runs.started_at < now()-interval '1 hour'
    and public.otterly_sync_runs.attempts < 3
  returning period_end
 ) select exists(select 1 from claimed);
$$;
revoke all on function public.otterly_claim_sync(date) from public,anon,authenticated;
grant execute on function public.otterly_claim_sync(date) to service_role;
