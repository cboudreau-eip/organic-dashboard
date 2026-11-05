-- Server-only aggregated reports. Browser roles cannot read or write this cache.
create table if not exists public.conversion_report_cache (
 id text primary key,
 report jsonb,
 partial jsonb,
 job jsonb,
 lease_owner uuid,
 lease_until timestamptz not null default '1970-01-01',
 updated_at timestamptz not null default now()
);
alter table public.conversion_report_cache enable row level security;
revoke all on public.conversion_report_cache from public, anon, authenticated;
grant select, insert, update, delete on public.conversion_report_cache to service_role;
