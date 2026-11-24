-- Retain confirmed duplicate rows verbatim for auditing. Application writes remain insert-only.
alter table public.datorama_cohort_checkpoints
 add column duplicate_of text references public.datorama_cohort_checkpoints(id),
 add constraint checkpoint_duplicate_not_self check (duplicate_of is null or duplicate_of <> id);
create index datorama_cohort_active_history on public.datorama_cohort_checkpoints
 (scope_id,cohort_month,source_exported_at desc,saved_at desc,id desc)
 where duplicate_of is null;

-- Claim the file and save its checkpoints in one transaction. Retrying an identical
-- file must not create orphan history with a different user-entered export time.
create function public.save_datorama_import(p_import jsonb,p_checkpoints jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare latest jsonb;
begin
 perform pg_catalog.pg_advisory_xact_lock(72141,1);
 if exists(select 1 from public.datorama_imports where id=p_import->>'id') then
  return jsonb_build_object('duplicate',true);
 end if;
 select payload into latest from public.datorama_imports order by exported_at desc limit 1;
 if latest is not null and ((latest->>'exportedAt')::timestamptz >= (p_import->>'exported_at')::timestamptz
  or latest->'period'->>'start' < p_import->'payload'->'period'->>'start'
  or latest->'period'->>'end' > p_import->'payload'->'period'->>'end'
  or latest->>'leadDataThrough' > p_import->'payload'->>'leadDataThrough') then
  raise exception 'A newer or wider import is already active';
 end if;
 insert into public.datorama_cohort_checkpoints(id,source_hash,scope_id,cohort_month,source_exported_at,lead_data_through,report)
 select id,source_hash,scope_id,cohort_month,source_exported_at,lead_data_through,report
 from jsonb_to_recordset(p_checkpoints) as r(id text,source_hash text,scope_id text,cohort_month date,source_exported_at timestamptz,lead_data_through date,report jsonb)
 on conflict(id) do nothing;
 insert into public.datorama_imports(id,filename,exported_at,imported_by,payload)
 values(p_import->>'id',p_import->>'filename',(p_import->>'exported_at')::timestamptz,(p_import->>'imported_by')::uuid,p_import->'payload');
 return jsonb_build_object('duplicate',false);
end $$;
revoke all on function public.save_datorama_import(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.save_datorama_import(jsonb,jsonb) to service_role;
