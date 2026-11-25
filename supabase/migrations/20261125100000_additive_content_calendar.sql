-- Additive planning: retain original assignments and allow shared dates.
alter table public.proposed_content_plans drop constraint proposed_content_plans_payload_check;
alter table public.proposed_content_plans add constraint proposed_content_plans_payload_check check(payload ? 'items' and jsonb_typeof(payload->'items')='array' and jsonb_array_length(payload->'items') between 1 and 180 and octet_length(payload::text)<6000000);
alter table public.content_work_pilots drop constraint content_work_pilots_entries_check;
alter table public.content_work_pilots add constraint content_work_pilots_entries_check check(jsonb_typeof(entries)='array' and jsonb_array_length(entries) between 1 and 180 and octet_length(entries::text)<10000000);
create or replace function public.validate_demo_calendar() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry record;
begin
 if new.calendar is null then
  if tg_op='UPDATE' and old.calendar is not null then raise exception 'Saved calendars cannot be cleared';end if;
  return new;
 end if;
 if jsonb_typeof(new.calendar)<>'object' or new.calendar->>'status' is distinct from 'Tentative' or jsonb_typeof(new.calendar->'dates') is distinct from 'object' or jsonb_typeof(new.calendar->'locked') is distinct from 'array' then raise exception 'Invalid tentative calendar';end if;
 if (select count(*) from jsonb_each(new.calendar->'dates'))<>jsonb_array_length(new.payload->'items') or (select count(distinct i->>'id') from jsonb_array_elements(new.payload->'items') i)<>jsonb_array_length(new.payload->'items') then raise exception 'Every assignment requires a date and unique ID';end if;
 for entry in select * from jsonb_each_text(new.calendar->'dates') loop
  if not exists(select 1 from jsonb_array_elements(new.payload->'items') i where i->>'id'=entry.key) or not exists(select 1 from generate_series(date '2027-01-01',date '2027-03-31',interval '1 day') d where to_char(d,'YYYY-MM-DD')=entry.value) then raise exception 'Invalid assignment or calendar date';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements_text(new.calendar->'locked') id where not (new.calendar->'dates') ? id) then raise exception 'Unknown fixed assignment';end if;
 return new;
end;$$;
create or replace function public.stamp_proposed_plan() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry record; field record;
begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.research_run_id<>old.research_run_id then raise exception 'Original proposal evidence is immutable';end if;
  if new.payload is distinct from old.payload then
   if (new.payload-'items') is distinct from (old.payload-'items') or jsonb_array_length(new.payload->'items')<=jsonb_array_length(old.payload->'items') or
    exists(select 1 from jsonb_array_elements(old.payload->'items') with ordinality o where o.value is distinct from new.payload->'items'->(o.ordinality::integer-1)) or
    new.edits is distinct from old.edits or new.calendar->'locked' is distinct from old.calendar->'locked' or
    exists(select 1 from jsonb_each(old.calendar->'dates') d where new.calendar->'dates'->d.key is distinct from d.value)
   then raise exception 'Append only: preserve existing assignments, edits and dates';end if;
  end if;
  new.version=old.version+1;new.created_at=old.created_at;new.created_by=old.created_by;
 else
  if not exists(select 1 from public.research_runs where id=new.research_run_id and status='complete') then raise exception 'Completed research required';end if;
  new.version=1;new.created_at=now();new.created_by=auth.uid();
 end if;
 for entry in select * from jsonb_each(new.edits) loop
  if jsonb_typeof(entry.value)<>'object' or not exists(select 1 from jsonb_array_elements(new.payload->'items') i where i->>'id'=entry.key) then raise exception 'Invalid proposal edit';end if;
  for field in select * from jsonb_each(entry.value) loop
   if field.key not in ('title','action','targetUrl','notes') or jsonb_typeof(field.value)<>'string' or length(field.value#>>'{}')>(case when field.key='title' then 300 when field.key='targetUrl' then 1000 else 3000 end) then raise exception 'Invalid editable field';end if;
   if field.key in ('title','action') and length(trim(field.value#>>'{}'))=0 then raise exception 'Required proposal text';end if;
   if field.key='targetUrl' and field.value#>>'{}'<>'' and (field.value#>>'{}') !~ '^https://(www\.)?medicarefaq\.com(/[^[:space:]]*)?$' then raise exception 'Invalid MedicareFAQ URL';end if;
  end loop;
 end loop;
 new.updated_at=now();new.updated_by=auth.uid();return new;
end;$$;
create or replace function public.validate_content_work_pilot() returns trigger language plpgsql security invoker set search_path='' as $$
declare source public.proposed_content_plans; e jsonb; old_e jsonb; original jsonb; n integer; expected_ids jsonb;
begin
 if auth.uid() is null or public.growth_access() not in ('analyst','admin') then raise exception 'Editor access required';end if;
 select * into source from public.proposed_content_plans where id=new.source_plan_id;
 if (select count(distinct value->>'assignment_id') from jsonb_array_elements(new.entries))<>jsonb_array_length(new.entries) then raise exception 'Duplicate assignment';end if;
 if tg_op='INSERT' then
  select * into source from public.proposed_content_plans where id=new.source_plan_id;
  if source.id is null or source.version<>new.source_version then raise exception 'Source plan changed' using errcode='40001';end if;
  select jsonb_agg(value->>'id' order by source.calendar->'dates'->>(value->>'id'),ordinality) into expected_ids
  from (select value,ordinality from jsonb_array_elements(source.payload->'items') with ordinality order by source.calendar->'dates'->>(value->>'id'),ordinality) first_five;
  if (select jsonb_agg(value->>'assignment_id' order by ordinality) from jsonb_array_elements(new.entries) with ordinality) is distinct from expected_ids then raise exception 'Use all scheduled assignments';end if;
  if new.week_start is distinct from (source.calendar->'dates'->>(new.entries->0->>'assignment_id'))::date then raise exception 'Keep the planned week';end if;
  new.created_by=auth.uid();new.created_at=now();new.version=1;
 else
  if new.id<>old.id or new.source_plan_id<>old.source_plan_id or new.source_version<>old.source_version or new.week_start<>old.week_start or new.created_by<>old.created_by then raise exception 'Pilot source is immutable';end if;
  new.created_at=old.created_at;new.version=old.version+1;
 end if;
 for e,n in select value,ordinality::integer-1 from jsonb_array_elements(new.entries) with ordinality loop
  if jsonb_typeof(e->'owner') is distinct from 'string' or length(e->>'owner')>120 or
   jsonb_typeof(e->'brief') is distinct from 'string' or length(e->>'brief')>20000 or length(trim(e->>'brief'))=0 or
   e->>'status' is null or e->>'status' not in ('Tentative','Ready','In progress','Review','Published') then raise exception 'Invalid work fields';end if;
  old_e=null;
  if tg_op='UPDATE' then select value into old_e from jsonb_array_elements(old.entries) where value->>'assignment_id'=e->>'assignment_id';end if;
  if old_e is null then
   select value||coalesce(source.edits->(value->>'id'),'{}'::jsonb) into original from jsonb_array_elements(source.payload->'items') where value->>'id'=e->>'assignment_id';
   if e->'snapshot' is distinct from original or e->>'planned_date' is distinct from source.calendar->'dates'->>(e->>'assignment_id') or
     e->'title_edited' is distinct from to_jsonb(coalesce(source.edits->(e->>'assignment_id') ? 'title',false)) or e->>'status'<>'Tentative' or e->>'owner'<>'' then raise exception 'Preserve original assignment and initial work state';end if;
   if original is null or e->>'planned_date' is null then raise exception 'Unknown scheduled assignment';end if;
  else

   if (e - array['owner','status','brief']) is distinct from (old_e - array['owner','status','brief']) then raise exception 'Assignment snapshot and dates are immutable';end if;
  end if;
 end loop;
 if tg_op='UPDATE' and exists(select 1 from jsonb_array_elements(old.entries) o where not exists(select 1 from jsonb_array_elements(new.entries) candidate where candidate->>'assignment_id'=o->>'assignment_id')) then raise exception 'Cannot remove work';end if;
 new.updated_at=now();return new;
end;$$;
create or replace function public.start_content_work_pilot(plan_id uuid,expected_version integer) returns public.content_work_pilots
 language plpgsql security invoker set search_path='' as $$
declare source public.proposed_content_plans; saved public.content_work_pilots; tasks jsonb; first_date date;
begin
 if auth.uid() is null or public.growth_access() not in ('analyst','admin') then raise exception 'Editor access required';end if;
 select * into source from public.proposed_content_plans where id=plan_id for update;
 if source.id is null or source.version<>expected_version then raise exception 'Source plan changed' using errcode='40001';end if;
 select * into saved from public.content_work_pilots where source_plan_id=plan_id for update;
 if saved.id is not null and not exists(select 1 from jsonb_array_elements(source.payload->'items') i where not exists(select 1 from jsonb_array_elements(saved.entries) e where e->>'assignment_id'=i->>'id')) then return saved;end if;
 if jsonb_array_length(source.payload->'items') not between 1 and 180 or source.calendar->>'status' is distinct from 'Tentative' then raise exception 'Choose the saved tentative calendar';end if;
 select jsonb_agg(jsonb_build_object('assignment_id',item->>'id','planned_date',source.calendar->'dates'->>(item->>'id'),
  'snapshot',item,'title_edited',coalesce(source.edits->(item->>'id') ? 'title',false),'owner','','status','Tentative',
  'brief','## Proposed work'||chr(10)||coalesce(item->>'action','')||chr(10)||chr(10)||'## Target queries'||chr(10)||
  coalesce((select string_agg(value,chr(10)) from jsonb_array_elements_text(item->'terms')),'')||chr(10)||chr(10)||
  '## Assignment notes'||chr(10)||coalesce(item->>'notes','')||chr(10)||chr(10)||'## Verify before implementation'||chr(10)||coalesce(item->>'verification','')||chr(10)||chr(10)||
  '## Measurement'||chr(10)||coalesce(item->>'measure','')) order by planned,ord) into tasks
 from (select value||coalesce(source.edits->(value->>'id'),'{}'::jsonb) item,source.calendar->'dates'->>(value->>'id') planned,ordinality ord from jsonb_array_elements(source.payload->'items') with ordinality order by planned,ord) t;
 if saved.id is not null then
  select jsonb_agg(coalesce((select e from jsonb_array_elements(saved.entries) e where e->>'assignment_id'=t->>'assignment_id'),t) order by ord) into tasks from jsonb_array_elements(tasks) with ordinality a(t,ord);
  update public.content_work_pilots set entries=tasks where id=saved.id returning * into saved;return saved;
 end if;
 first_date=(tasks->0->>'planned_date')::date;
 insert into public.content_work_pilots(source_plan_id,source_version,week_start,entries) values(plan_id,expected_version,first_date,tasks) returning * into saved;
 return saved;
end;$$;
revoke all on function public.start_content_work_pilot(uuid,integer) from public,anon;
grant execute on function public.start_content_work_pilot(uuid,integer) to authenticated;

create or replace function public.append_content_assignments(source_id uuid,expected_version integer,additions jsonb) returns public.proposed_content_plans language plpgsql security invoker set search_path='' as $$
declare saved public.proposed_content_plans; item jsonb; n integer; next_dates jsonb; chosen text; total integer;
begin
 if auth.uid() is null or coalesce(public.growth_access(),'') not in ('analyst','admin') then raise exception 'Editor access required' using errcode='42501';end if;
 select * into saved from public.proposed_content_plans where id=source_id for update;
 if saved.id is null or saved.version<>expected_version then raise exception 'Plan changed; reload before adding' using errcode='40001';end if;
 total=jsonb_array_length(additions);
 if jsonb_typeof(additions) is distinct from 'array' or total not between 1 and 6 or saved.calendar is null then raise exception 'Choose 1–6 additions and a scheduled plan';end if;
 next_dates=saved.calendar->'dates';
 for item,n in select value,ordinality::integer from jsonb_array_elements(additions) with ordinality loop
  if nullif(item->>'id','') is null or next_dates ? (item->>'id') or item->>'type' is distinct from 'New-page proposal' or coalesce(item->>'targetUrl','')<>'' or nullif(item->>'title','') is null or nullif(item->>'action','') is null or jsonb_typeof(item->'expansionEvidence') is distinct from 'object' then raise exception 'Invalid new-content addition';end if;
  select to_char(d,'YYYY-MM-DD') into chosen from generate_series(date '2027-01-01',date '2027-03-31',interval '1 day') d
   order by (select count(*) from jsonb_each_text(next_dates) x where x.value=to_char(d,'YYYY-MM-DD')),abs((d::date-date '2027-01-01')-floor((n-0.5)*90/total)) limit 1;
  next_dates=next_dates||jsonb_build_object(item->>'id',chosen);
 end loop;
 update public.proposed_content_plans set payload=jsonb_set(payload,'{items}',payload->'items'||additions),calendar=jsonb_set(calendar,'{dates}',next_dates) where id=source_id returning * into saved;
 -- Same transaction: queue additions cannot overwrite concurrent saved work.
 if exists(select 1 from public.content_work_pilots where source_plan_id=source_id) then perform public.start_content_work_pilot(saved.id,saved.version);end if;
 return saved;
end;$$;
revoke all on function public.append_content_assignments(uuid,integer,jsonb) from public,anon;
grant execute on function public.append_content_assignments(uuid,integer,jsonb) to authenticated;
