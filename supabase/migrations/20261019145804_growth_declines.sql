-- Bounded, manual decline research over immutable snapshots. No provider calls.
begin;
create table public.growth_decline_runs (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id),
 prior_snapshot_id uuid not null references public.growth_snapshots(id),
 current_snapshot_id uuid not null references public.growth_snapshots(id),
 detector_version text not null check (detector_version = 'decline-v1'),
 result jsonb not null,
 unique(prior_snapshot_id,current_snapshot_id,detector_version)
);
create index growth_decline_runs_created on public.growth_decline_runs(created_at desc,id desc);
alter table public.growth_decline_runs enable row level security;
revoke all on public.growth_decline_runs from public,anon,authenticated;
grant select on public.growth_decline_runs to authenticated;
create policy growth_decline_read on public.growth_decline_runs for select to authenticated
 using ((select public.growth_access()) in ('viewer','analyst','admin'));

create function public.growth_detect_declines(prior_id uuid,current_id uuid,scope_confirmed boolean) returns jsonb
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
  'scopeConfirmation','User attested matching export scope; not independently verified.',
  'limitations',jsonb_build_array(
   'Directional before/after findings, not proof of a cause or incremental impact.',
   'Manual exports may be incomplete. Pages missing in either period are excluded, never treated as zero.',
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
commit;
