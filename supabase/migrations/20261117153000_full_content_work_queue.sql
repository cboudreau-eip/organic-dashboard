alter table public.content_work_pilots drop constraint content_work_pilots_entries_check;
alter table public.content_work_pilots add constraint content_work_pilots_entries_check check(jsonb_typeof(entries)='array' and jsonb_array_length(entries) in (5,90) and octet_length(entries::text)<6000000);
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
  from (select value,ordinality from jsonb_array_elements(source.payload->'items') with ordinality order by source.calendar->'dates'->>(value->>'id'),ordinality limit 90) first_five;
  if (select jsonb_agg(value->>'assignment_id' order by ordinality) from jsonb_array_elements(new.entries) with ordinality) is distinct from expected_ids then raise exception 'Use the first five scheduled assignments';end if;
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
 select * into saved from public.content_work_pilots where source_plan_id=plan_id;
 if saved.id is not null and jsonb_array_length(saved.entries)=90 then return saved;end if;
 if jsonb_array_length(source.payload->'items')<>90 or source.calendar->>'status' is distinct from 'Tentative' then raise exception 'Choose the saved tentative 90-assignment calendar';end if;
 select jsonb_agg(jsonb_build_object('assignment_id',item->>'id','planned_date',source.calendar->'dates'->>(item->>'id'),
  'snapshot',item,'title_edited',coalesce(source.edits->(item->>'id') ? 'title',false),'owner','','status','Tentative',
  'brief','## Proposed work'||chr(10)||coalesce(item->>'action','')||chr(10)||chr(10)||'## Target queries'||chr(10)||
  coalesce((select string_agg(value,chr(10)) from jsonb_array_elements_text(item->'terms')),'')||chr(10)||chr(10)||
  '## Assignment notes'||chr(10)||coalesce(item->>'notes','')||chr(10)||chr(10)||'## Verify before implementation'||chr(10)||coalesce(item->>'verification','')||chr(10)||chr(10)||
  '## Measurement'||chr(10)||coalesce(item->>'measure','')) order by planned,ord) into tasks
 from (select value||coalesce(source.edits->(value->>'id'),'{}'::jsonb) item,source.calendar->'dates'->>(value->>'id') planned,ordinality ord from jsonb_array_elements(source.payload->'items') with ordinality order by planned,ord limit 90) t;
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

