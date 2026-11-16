create table public.paid_search_research (
 id uuid primary key default gen_random_uuid(),
 fingerprint text not null unique check(length(fingerprint)=64),
 payload jsonb not null check(jsonb_typeof(payload->'rows')='array' and jsonb_array_length(payload->'rows') between 1 and 10000 and octet_length(payload::text)<4000000),
 created_at timestamptz not null default now(),
 created_by uuid default auth.uid() references auth.users(id)
);
alter table public.paid_search_research enable row level security;
revoke all on public.paid_search_research from public,anon,authenticated;
grant select,insert on public.paid_search_research to authenticated;
create policy paid_research_read on public.paid_search_research for select to authenticated using ((select public.growth_access()) in ('viewer','analyst','admin'));
create policy paid_research_insert on public.paid_search_research for insert to authenticated with check ((select public.growth_access()) in ('analyst','admin') and created_by=(select auth.uid()));
create index paid_research_created on public.paid_search_research(created_at desc);
