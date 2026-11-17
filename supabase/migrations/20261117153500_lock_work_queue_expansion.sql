create or replace function public.start_content_work_pilot(plan_id uuid,expected_version integer) returns public.content_work_pilots
 language plpgsql security invoker set search_path='' as $$
declare source public.proposed_content_plans; saved public.content_work_pilots; tasks jsonb; first_date date;
begin
 if auth.uid() is null or public.growth_access() not in ('analyst','admin') then raise exception 'Editor access required';end if;
 select * into source from public.proposed_content_plans where id=plan_id for update;
 if source.id is null or source.version<>expected_version then raise exception 'Source plan changed' using errcode='40001';end if;
 select * into saved from public.content_work_pilots where source_plan_id=plan_id for update;
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

