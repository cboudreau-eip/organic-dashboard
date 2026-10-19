-- Apply only to an inspected development/staging Supabase database first.
-- Deliberately fails on existing conflicting objects; never overwrites a schema.
begin;

create table public.growth_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false
);
insert into public.growth_settings (enabled) values (false);

create table public.growth_members (
  user_id uuid primary key references auth.users(id),
  role text not null check (role in ('viewer','analyst','admin')),
  active boolean not null default true
);

create table public.growth_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  content_hash text not null unique check (length(content_hash) = 64),
  period_start date not null,
  period_end date not null check (period_end >= period_start),
  row_count integer not null check (row_count between 1 and 2000),
  coverage text not null check (coverage = 'manual_pages_export_not_exhaustive'),
  payload jsonb not null
);
create index growth_snapshots_created on public.growth_snapshots (created_at desc, id desc);
create table public.growth_audit (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid not null references auth.users(id),
  snapshot_id uuid not null references public.growth_snapshots(id),
  action text not null check (action = 'snapshot_imported')
);

alter table public.growth_settings enable row level security;
alter table public.growth_members enable row level security;
alter table public.growth_snapshots enable row level security;
alter table public.growth_audit enable row level security;
revoke all on public.growth_settings, public.growth_members, public.growth_snapshots, public.growth_audit from public, anon, authenticated;

create function public.growth_access() returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.growth_members m
  join public.growth_settings s on s.id = true and s.enabled
  where m.user_id = auth.uid() and m.active
$$;
revoke all on function public.growth_access() from public, anon;
grant execute on function public.growth_access() to authenticated;

-- No direct insert/update/delete grants: authenticated users cannot forge imports,
-- edit evidence, self-promote, enable rollout or rewrite audit history.
grant select on public.growth_snapshots to authenticated;
create policy growth_snapshot_read on public.growth_snapshots for select to authenticated
  using ((select public.growth_access()) in ('viewer','analyst','admin'));
grant select on public.growth_audit to authenticated;
create policy growth_audit_read on public.growth_audit for select to authenticated
  using ((select public.growth_access()) = 'admin');

create function public.growth_import_snapshot(input jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  member_role text;
  is_enabled boolean;
  item jsonb;
  start_date date;
  end_date date;
  row_total integer;
  canonical jsonb;
  hash text;
  saved_id uuid;
  inserted boolean := false;
  clicks numeric;
  impressions numeric;
  ctr numeric;
  position numeric;
begin
  -- Locks make an import serialize with membership revocation or rollout disablement.
  select enabled into is_enabled from public.growth_settings where id for share;
  select role into member_role from public.growth_members where user_id = auth.uid() and active for share;
  if is_enabled is distinct from true or member_role is null or member_role not in ('analyst','admin') then
    raise exception 'Growth Hunter import denied' using errcode = '42501';
  end if;
  if input is null or jsonb_typeof(input) <> 'object' or octet_length(input::text) > 1000000
    or input - array['schemaVersion','source','property','timezone','start','end','coverage','rows'] <> '{}'::jsonb
    or not (input ?& array['schemaVersion','source','property','timezone','start','end','coverage','rows'])
    or input->'schemaVersion' <> '1'::jsonb
    or input->>'source' <> 'gsc' or input->>'property' <> 'https://www.medicarefaq.com/'
    or input->>'timezone' <> 'America/Los_Angeles'
    or input->>'coverage' <> 'manual_pages_export_not_exhaustive'
    or jsonb_typeof(input->'rows') <> 'array'
    or jsonb_typeof(input->'start') <> 'string' or jsonb_typeof(input->'end') <> 'string'
    or input->>'start' !~ '^\d{4}-\d{2}-\d{2}$' or input->>'end' !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Invalid snapshot contract' using errcode = '22023';
  end if;
  -- Explicit null check: SQL three-valued comparisons must not admit JSON nulls.
  if exists (select 1 from jsonb_each(input) x where x.value = 'null'::jsonb) then
    raise exception 'Null snapshot fields' using errcode = '22023';
  end if;
  start_date := (input->>'start')::date;
  end_date := (input->>'end')::date;
  if end_date < start_date or end_date - start_date >= 366
    or end_date >= (current_timestamp at time zone 'America/Los_Angeles')::date then
    raise exception 'Invalid snapshot period' using errcode = '22023';
  end if;
  row_total := jsonb_array_length(input->'rows');
  if row_total < 1 or row_total > 2000 then raise exception 'Invalid row count' using errcode = '22023'; end if;
  for item in select value from jsonb_array_elements(input->'rows') loop
    if jsonb_typeof(item) <> 'object'
      or item - array['url','clicks','impressions','ctr','position'] <> '{}'::jsonb
      or not (item ?& array['url','clicks','impressions','ctr','position'])
      or jsonb_typeof(item->'url') <> 'string'
      or length(item->>'url') > 2000
      or item->>'url' !~ '^https://www[.]medicarefaq[.]com/[^?#[:space:]\\]*$'
      or jsonb_typeof(item->'clicks') <> 'number' or jsonb_typeof(item->'impressions') <> 'number'
      or jsonb_typeof(item->'ctr') <> 'number' or jsonb_typeof(item->'position') <> 'number' then
      raise exception 'Invalid aggregate page row' using errcode = '22023';
    end if;
    clicks := (item->>'clicks')::numeric; impressions := (item->>'impressions')::numeric;
    ctr := (item->>'ctr')::numeric; position := (item->>'position')::numeric;
    if clicks < 0 or impressions <= 0 or clicks > impressions or impressions > 9007199254740991
      or trunc(clicks) <> clicks or trunc(impressions) <> impressions
      or ctr < 0 or ctr > 1 or abs(ctr - clicks/impressions) > 0.000000001
      or position < 1 or position > 9007199254740991 then
      raise exception 'Invalid aggregate page metrics' using errcode = '22023';
    end if;
  end loop;
  if (select count(distinct value->>'url') from jsonb_array_elements(input->'rows')) <> row_total then
    raise exception 'Duplicate page rows' using errcode = '22023';
  end if;
  canonical := jsonb_set(input, '{rows}', (select jsonb_agg(value order by value->>'url' collate "C") from jsonb_array_elements(input->'rows')));
  hash := encode(sha256(convert_to(canonical::text, 'UTF8')), 'hex');
  insert into public.growth_snapshots (created_by, content_hash, period_start, period_end, row_count, coverage, payload)
    values (auth.uid(), hash, start_date, end_date, row_total, input->>'coverage', canonical)
    on conflict (content_hash) do nothing returning id into saved_id;
  if saved_id is not null then
    inserted := true;
    insert into public.growth_audit (actor_id, snapshot_id, action) values (auth.uid(), saved_id, 'snapshot_imported');
  else
    select id into saved_id from public.growth_snapshots where content_hash = hash;
  end if;
  return jsonb_build_object('id', saved_id, 'inserted', inserted, 'rowCount', row_total);
end;
$$;
revoke all on function public.growth_import_snapshot(jsonb) from public, anon;
grant execute on function public.growth_import_snapshot(jsonb) to authenticated;
commit;
