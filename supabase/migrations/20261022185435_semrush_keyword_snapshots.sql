
create table public.semrush_snapshots (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),
 input jsonb not null,
 summary jsonb not null,
 fingerprint text generated always as (md5(input::text)) stored unique,
 constraint semrush_input_size check (octet_length(input::text)<=3000000),
 constraint semrush_input_shape check (
  jsonb_typeof(input)='object' and input ? 'report' and input ? 'scope'
  and jsonb_typeof(input->'report'->'matrix')='array'
  and jsonb_array_length(input->'report'->'matrix') between 2 and 5100
  and input->'scope'->>'device' in ('desktop','mobile','tablet')
  and input->'scope'->>'engine' in ('Google','Bing','Baidu')
  and length(input->'scope'->>'location') between 2 and 120
  and input->'scope'->>'confirmed'='true'
  and input->'scope' ?& array['location','device','engine','confirmed']
  and input->'report' ? 'matrix'
 ),
 constraint semrush_summary_shape check (jsonb_typeof(summary)='object' and octet_length(summary::text)<2000)
);
alter table public.semrush_snapshots enable row level security;
revoke all on public.semrush_snapshots from public,anon,authenticated;
grant select,insert on public.semrush_snapshots to authenticated;
create policy semrush_member_read on public.semrush_snapshots for select to authenticated
 using ((select public.growth_access()) in ('viewer','analyst','admin'));
create policy semrush_analyst_insert on public.semrush_snapshots for insert to authenticated
 with check (created_by=(select auth.uid()) and (select public.growth_access()) in ('analyst','admin'));
create index semrush_snapshots_created on public.semrush_snapshots(created_at desc,id);
