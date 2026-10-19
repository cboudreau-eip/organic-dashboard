begin;
create table public.growth_query_research (
 id uuid primary key default gen_random_uuid(),
 created_at timestamptz not null default now(),
 created_by uuid not null references auth.users(id),
 run_id uuid not null references public.growth_decline_runs(id),
 page text not null check (octet_length(page)<=2000),
 version text not null check(version='query-v1'),
 payload jsonb not null,
 unique(run_id,page,version)
);
alter table public.growth_query_research enable row level security;
revoke all on public.growth_query_research from public,anon,authenticated;
grant select on public.growth_query_research to authenticated;
create policy growth_query_read on public.growth_query_research for select to authenticated
 using ((select public.growth_access()) in ('viewer','analyst','admin'));
-- Only this private function writes immutable query evidence. No direct client write grants.
create schema if not exists growth_private;
revoke all on schema growth_private from public,anon;
grant usage on schema growth_private to authenticated;
create function growth_private.save_query_research(selected_run uuid,input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 member_role text; is_enabled boolean; selected public.growth_decline_runs%rowtype;
 earlier public.growth_snapshots%rowtype; later public.growth_snapshots%rowtype;
 saved public.growth_query_research%rowtype; period jsonb; item jsonb;
 clicks numeric; impressions numeric; ctr numeric; position numeric;
begin
 select enabled into is_enabled from public.growth_settings where id for share;
 select role into member_role from public.growth_members where user_id=auth.uid() and active for share;
 if is_enabled is distinct from true or member_role is null or member_role not in ('analyst','admin') then
  raise exception 'Keyword research denied' using errcode='42501';
 end if;
 if input is null or jsonb_typeof(input)<>'object' or octet_length(input::text)>2000000
 or input-array['version','source','property','timezone','page','prior','current','fetchedAt']<>'{}'::jsonb
 or not(input ?& array['version','source','property','timezone','page','prior','current','fetchedAt'])
 or exists(select 1 from jsonb_each(input) x where x.value='null'::jsonb)
 or input->>'version'<>'query-v1' or input->>'source'<>'gsc'
 or input->>'property'<>'https://www.medicarefaq.com/' or input->>'timezone'<>'America/Los_Angeles'
 or jsonb_typeof(input->'page')<>'string' or octet_length(input->>'page')>2000
 or jsonb_typeof(input->'fetchedAt')<>'string'
 or input->>'fetchedAt' !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.]\d{3}Z$' then
  raise exception 'Invalid keyword evidence contract' using errcode='22023';
 end if;
 if (input->>'fetchedAt')::timestamptz > now()+interval '5 minutes' then raise exception 'Invalid capture time' using errcode='22023'; end if;
 select * into selected from public.growth_decline_runs where id=selected_run;
 if selected.id is null or not exists(select 1 from jsonb_array_elements(selected.result->'findings') f where f->>'url'=input->>'page') then
  raise exception 'Page is not a saved finding' using errcode='22023';
 end if;
 select * into earlier from public.growth_snapshots where id=selected.prior_snapshot_id;
 select * into later from public.growth_snapshots where id=selected.current_snapshot_id;
 if earlier.coverage<>'gsc_api_final_pages_no_parameters_not_exhaustive' or later.coverage<>earlier.coverage then
  raise exception 'Expected connected GSC source scope' using errcode='22023';
 end if;
 for period in select value from jsonb_array_elements(jsonb_build_array(input->'prior',input->'current')) loop
  if jsonb_typeof(period)<>'object' or period-array['start','end','rows']<>'{}'::jsonb
  or not(period ?& array['start','end','rows']) or exists(select 1 from jsonb_each(period) x where x.value='null'::jsonb)
  or jsonb_typeof(period->'start')<>'string' or jsonb_typeof(period->'end')<>'string'
  or jsonb_typeof(period->'rows')<>'array' then raise exception 'Invalid keyword period' using errcode='22023'; end if;
  if jsonb_array_length(period->'rows')>2000 then raise exception 'Keyword row limit exceeded' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(period->'rows') loop
   if jsonb_typeof(item)<>'object' or item-array['query','clicks','impressions','ctr','position']<>'{}'::jsonb
   or not(item ?& array['query','clicks','impressions','ctr','position'])
   or jsonb_typeof(item->'query')<>'string' or length(btrim(item->>'query'))=0 or length(item->>'query')>2048
   or item->>'query' ~ '[[:cntrl:]]'
   or jsonb_typeof(item->'clicks')<>'number' or jsonb_typeof(item->'impressions')<>'number'
   or jsonb_typeof(item->'ctr')<>'number' or jsonb_typeof(item->'position')<>'number' then
    raise exception 'Invalid keyword row' using errcode='22023';
   end if;
   clicks:=(item->>'clicks')::numeric; impressions:=(item->>'impressions')::numeric;
   ctr:=(item->>'ctr')::numeric; position:=(item->>'position')::numeric;
   if clicks<0 or impressions<=0 or clicks>impressions or impressions>9007199254740991
   or trunc(clicks)<>clicks or trunc(impressions)<>impressions
   or ctr<0 or ctr>1 or abs(ctr-clicks/impressions)>0.000000001
   or position<1 or position>9007199254740991 then raise exception 'Invalid keyword metrics' using errcode='22023'; end if;
  end loop;
  if (select count(distinct value->>'query') from jsonb_array_elements(period->'rows'))<>jsonb_array_length(period->'rows') then
   raise exception 'Duplicate keywords' using errcode='22023';
  end if;
 end loop;
 if input->'prior'->>'start'<>earlier.period_start::text or input->'prior'->>'end'<>earlier.period_end::text
 or input->'current'->>'start'<>later.period_start::text or input->'current'->>'end'<>later.period_end::text then
  raise exception 'Keyword dates must match saved evidence' using errcode='22023';
 end if;
 insert into public.growth_query_research(created_by,run_id,page,version,payload)
 values(auth.uid(),selected_run,input->>'page','query-v1',input)
 on conflict(run_id,page,version) do nothing returning * into saved;
 if saved.id is null then
  select * into saved from public.growth_query_research where run_id=selected_run and page=input->>'page' and version='query-v1';
  return jsonb_build_object('research',to_jsonb(saved),'reused',true);
 end if;
 return jsonb_build_object('research',to_jsonb(saved),'reused',false);
end;
$$;
revoke all on function growth_private.save_query_research(uuid,jsonb) from public,anon;
grant execute on function growth_private.save_query_research(uuid,jsonb) to authenticated;
create function public.growth_save_query_research(selected_run uuid,input jsonb) returns jsonb
language sql security invoker set search_path='' as $$
 select growth_private.save_query_research(selected_run,input)
$$;
revoke all on function public.growth_save_query_research(uuid,jsonb) from public,anon;
grant execute on function public.growth_save_query_research(uuid,jsonb) to authenticated;
commit;
