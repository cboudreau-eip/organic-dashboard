-- Preserve old snapshots and results; add atomic direct-GSC evidence capture.
begin;
alter table public.growth_snapshots drop constraint growth_snapshots_coverage_check;
alter table public.growth_snapshots add constraint growth_snapshots_coverage_check check (coverage in ('manual_pages_export_not_exhaustive','gsc_api_final_pages_no_parameters_not_exhaustive'));
create or replace function public.growth_import_snapshot(input jsonb) returns jsonb
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
    or input->>'coverage' not in ('manual_pages_export_not_exhaustive','gsc_api_final_pages_no_parameters_not_exhaustive')
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

create or replace function public.growth_detect_declines(prior_id uuid,current_id uuid,scope_confirmed boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 member_role text;
 is_enabled boolean;
 earlier public.growth_snapshots%rowtype;
 later public.growth_snapshots%rowtype;
 saved public.growth_decline_runs%rowtype;
 report jsonb;
 matches integer;
 candidates integer;
 findings jsonb;
begin
 select enabled into is_enabled from public.growth_settings where id for share;
 select role into member_role from public.growth_members where user_id=auth.uid() and active for share;
 if is_enabled is distinct from true or member_role is null or member_role not in ('analyst','admin') then
  raise exception 'Research permission denied' using errcode='42501';
 end if;
 if scope_confirmed is distinct from true then
  raise exception 'Confirm that the exports have the same property, Web search type and filters' using errcode='22023';
 end if;
 select * into earlier from public.growth_snapshots where id=prior_id;
 select * into later from public.growth_snapshots where id=current_id;
 if earlier.id is null or later.id is null then raise exception 'Snapshot not found' using errcode='P0002'; end if;
 if earlier.id=later.id or earlier.period_end+1 <> later.period_start
  or earlier.period_end-earlier.period_start <> later.period_end-later.period_start
  or later.period_end-later.period_start+1 not in (7,28,56,84)
  or (earlier.payload - 'rows' - 'start' - 'end') <> (later.payload - 'rows' - 'start' - 'end') then
  raise exception 'Choose adjacent, equal 7, 28, 56 or 84 day periods with matching source definitions' using errcode='22023';
 end if;
 select * into saved from public.growth_decline_runs where prior_snapshot_id=prior_id and current_snapshot_id=current_id and detector_version='decline-v1';
 if saved.id is not null then return jsonb_build_object('run',to_jsonb(saved),'reused',true); end if;
 with p as (select value v from jsonb_array_elements(earlier.payload->'rows')),
 c as (select value v from jsonb_array_elements(later.payload->'rows'))
 select count(*) into matches from p join c on p.v->>'url'=c.v->>'url';
 with p as (select value v from jsonb_array_elements(earlier.payload->'rows')),
 c as (select value v from jsonb_array_elements(later.payload->'rows')),
 eligible as (
 select p.v prior,c.v current,(p.v->>'clicks')::numeric-(c.v->>'clicks')::numeric loss
 from p join c on p.v->>'url'=c.v->>'url'
 where (p.v->>'clicks')::numeric >= 20 and (p.v->>'impressions')::numeric >=100
 and (p.v->>'clicks')::numeric-(c.v->>'clicks')::numeric >=10
 and (c.v->>'clicks')::numeric <= (p.v->>'clicks')::numeric * 0.8
 ), ranked as (select *,row_number() over(order by loss desc,prior->>'url' collate "C") as rank from eligible)
 select count(*),coalesce(jsonb_agg(jsonb_build_object(
  'url',prior->>'url','prior',prior,'current',current,'lostClicks',loss,
  'declinePercent',round(100*loss/(prior->>'clicks')::numeric,2),
  'impressionsChangePercent',round(100*((current->>'impressions')::numeric/(prior->>'impressions')::numeric-1),2),
  'positionChange',round((current->>'position')::numeric-(prior->>'position')::numeric,2),
  'ctrChangePoints',round(100*((current->>'ctr')::numeric-(prior->>'ctr')::numeric),2)
 ) order by rank) filter(where rank<=100),'[]'::jsonb) into candidates,findings from ranked;
 report := jsonb_build_object(
  'version','decline-v1','status',case when matches=0 then 'insufficient_data' when candidates=0 then 'no_candidates' else 'candidates_found' end,
  'priorPeriod',jsonb_build_object('start',earlier.period_start,'end',earlier.period_end),
  'currentPeriod',jsonb_build_object('start',later.period_start,'end',later.period_end),
  'timezone','America/Los_Angeles','matchedPages',matches,
  'priorOnlyPages',earlier.row_count-matches,'currentOnlyPages',later.row_count-matches,
  'candidateCount',candidates,'findings',findings,'displayLimit',100,
  'ranking','Absolute lost clicks, then URL. Not a lead-value or success-probability score.',
  'thresholds',jsonb_build_object('minimumPriorClicks',20,'minimumPriorImpressions',100,'minimumLostClicks',10,'minimumDeclinePercent',20),
  'scopeConfirmation',case when earlier.coverage='gsc_api_final_pages_no_parameters_not_exhaustive' then 'GSC API snapshot scope: finalized Web search, MedicareFAQ URL-prefix property, no country or device filters; URLs with query parameters or fragments excluded.' else 'User attested matching export scope; not independently verified.' end,
  'limitations',jsonb_build_array(
   'Directional before/after findings, not proof of a cause or incremental impact.',
   'Google Search Console page data may be incomplete. Pages missing in either period are excluded, never treated as zero.',
   'Medicare enrollment seasonality, search demand, query mix, canonical changes and simultaneous edits may explain movement.',
   'No query-level, year-over-year, content inventory or conversion evidence is included.',
   'Review dated source evidence before assigning work. Thresholds are pilot heuristics, not approved business-value weights.'
  )
 );
 insert into public.growth_decline_runs(created_by,prior_snapshot_id,current_snapshot_id,detector_version,result)
 values(auth.uid(),prior_id,current_id,'decline-v1',report)
 on conflict(prior_snapshot_id,current_snapshot_id,detector_version) do nothing returning * into saved;
 if saved.id is null then
  select * into saved from public.growth_decline_runs where prior_snapshot_id=prior_id and current_snapshot_id=current_id and detector_version='decline-v1';
  return jsonb_build_object('run',to_jsonb(saved),'reused',true);
 end if;
 return jsonb_build_object('run',to_jsonb(saved),'reused',false);
end;
$$;
revoke all on function public.growth_detect_declines(uuid,uuid,boolean) from public,anon;
grant execute on function public.growth_detect_declines(uuid,uuid,boolean) to authenticated;

-- Invoker retains the member gate on both imports and the detector. Any error rolls back all writes.
create function public.growth_analyze_gsc(prior_input jsonb,current_input jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare earlier jsonb; later jsonb;
begin
 if public.growth_access() is null or public.growth_access() not in ('analyst','admin') then
  raise exception 'Research permission denied' using errcode='42501';
 end if;
 if (prior_input->>'coverage') is distinct from 'gsc_api_final_pages_no_parameters_not_exhaustive'
 or (current_input->>'coverage') is distinct from 'gsc_api_final_pages_no_parameters_not_exhaustive' then
  raise exception 'Expected matching API scope' using errcode='22023';
 end if;
 earlier := public.growth_import_snapshot(prior_input);
 later := public.growth_import_snapshot(current_input);
 return public.growth_detect_declines((earlier->>'id')::uuid,(later->>'id')::uuid,true);
end;
$$;
revoke all on function public.growth_analyze_gsc(jsonb,jsonb) from public,anon;
grant execute on function public.growth_analyze_gsc(jsonb,jsonb) to authenticated;
commit;
