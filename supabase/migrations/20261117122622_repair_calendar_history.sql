-- Fork immutable plans under a lock. Repairs and undo never update calendar/edits.
create function public.repair_calendar_plan(source_id uuid, expected_version integer, changes jsonb default '[]', undo_id text default null)
returns public.proposed_content_plans language plpgsql security invoker set search_path='' as $$
declare original public.proposed_content_plans; saved public.proposed_content_plans; next_payload jsonb;
 history jsonb; entry jsonb; change jsonb; old_item jsonb; next_item jsonb; items jsonb; recorded jsonb='[]'; skipped jsonb='[]'; slot text; pos integer;
begin
 if auth.uid() is null or coalesce(public.growth_access(),'') not in ('analyst','admin') then raise exception 'Editor access required' using errcode='42501'; end if;
 select * into original from public.proposed_content_plans where id=source_id for update;
 if not found or original.version<>expected_version then raise exception 'Plan changed; reload before repairing' using errcode='40001'; end if;
 next_payload=original.payload; items=next_payload->'items'; history=coalesce(next_payload->'repairHistory','[]');
 if undo_id is not null then
  select value into entry from jsonb_array_elements(history) where value->>'id'=undo_id;
  if entry is null or entry ? 'undoneAt' then raise exception 'Repair is unavailable or already undone' using errcode='40001'; end if;
  changes=entry->'changes';
 end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes)<1 or jsonb_array_length(changes)>90 or
 (select count(distinct value->>'id') from jsonb_array_elements(changes))<>jsonb_array_length(changes) then raise exception 'Invalid repair changes'; end if;
 for change in select value from jsonb_array_elements(changes) loop
  slot=change->>'id'; select value,ordinality::integer-1 into old_item,pos from jsonb_array_elements(items) with ordinality where value->>'id'=slot;
  if old_item is null then raise exception 'Keep original assignment slots'; end if;
  if undo_id is not null then
   if original.edits ? slot or old_item is distinct from change->'after' then skipped=skipped||jsonb_build_array(slot);continue;end if;
   next_item=change->'before';
  else
   if original.edits ? slot then raise exception 'Manually edited assignments must remain unchanged';end if;
   next_item=change->'item';
  end if;
  if next_item->>'id' is distinct from slot or next_item->>'category' is distinct from old_item->>'category' or
    jsonb_typeof(next_item)<>'object' or coalesce(length(next_item->>'title'),0)=0 or coalesce(length(next_item->>'action'),0)=0 then raise exception 'Keep assignment identity and category';end if;
  if next_item=old_item then continue;end if;
  items=jsonb_set(items,array[pos::text],next_item);
  recorded=recorded||jsonb_build_array(jsonb_build_object('id',slot,'before',old_item,'after',next_item,'reason',change->>'reason','evidence',change->'evidence'));
 end loop;
 if jsonb_array_length(recorded)=0 then raise exception 'No unchanged assignments are eligible for this operation' using errcode='40001';end if;
 if undo_id is null then
  history=history||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'createdAt',now(),'sourcePlanId',original.id,'sourceVersion',original.version,'changes',recorded,'tentative',true));
 else
  select jsonb_agg(case when value->>'id'=undo_id then value||jsonb_build_object('undoneAt',now(),'restored',jsonb_array_length(recorded),'protected',skipped) else value end order by ordinality) into history from jsonb_array_elements(history) with ordinality;
 end if;
 next_payload=jsonb_set(jsonb_set(next_payload,'{items}',items),'{repairHistory}',history);
 insert into public.proposed_content_plans(research_run_id,payload,edits,calendar) values(original.research_run_id,next_payload,original.edits,original.calendar) returning * into saved;
 return saved;
end;$$;
revoke all on function public.repair_calendar_plan(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.repair_calendar_plan(uuid,integer,jsonb,text) to authenticated;
