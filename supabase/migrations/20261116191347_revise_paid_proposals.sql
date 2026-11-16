-- Fork under a row lock: concurrent edits cannot disappear between read and save.
create function public.revise_paid_proposal_plan(source_id uuid, expected_version integer, revised_payload jsonb)
returns public.proposed_content_plans language plpgsql security invoker set search_path='' as $$
declare original public.proposed_content_plans; saved public.proposed_content_plans; edited_id text;
begin
 if auth.uid() is null or coalesce(public.growth_access(),'') not in ('analyst','admin') then raise exception 'Editor access required' using errcode='42501'; end if;
 select * into original from public.proposed_content_plans where id=source_id for update;
 if not found or original.version<>expected_version then raise exception 'Plan changed; reload before revising' using errcode='40001'; end if;
 if jsonb_array_length(revised_payload->'items')<>90 or
    (select jsonb_agg(i->>'id' order by i->>'id') from jsonb_array_elements(revised_payload->'items') i)
     is distinct from (select jsonb_agg(i->>'id' order by i->>'id') from jsonb_array_elements(original.payload->'items') i)
 then raise exception 'Keep all original assignment slots'; end if;
 for edited_id in select jsonb_object_keys(original.edits) loop
  if (select i from jsonb_array_elements(original.payload->'items') i where i->>'id'=edited_id)
    is distinct from (select i from jsonb_array_elements(revised_payload->'items') i where i->>'id'=edited_id)
  then raise exception 'Manually edited assignments must remain unchanged'; end if;
 end loop;
 insert into public.proposed_content_plans(research_run_id,payload,edits,calendar)
 values(original.research_run_id,revised_payload,original.edits,original.calendar) returning * into saved;
 return saved;
end;$$;
revoke all on function public.revise_paid_proposal_plan(uuid,integer,jsonb) from public,anon;
grant execute on function public.revise_paid_proposal_plan(uuid,integer,jsonb) to authenticated;
