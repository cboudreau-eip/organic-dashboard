-- Team members remain read-only. Only the private server writer can enrich an
-- existing snapshot; the application uses the add-once function below.
grant update(payload) on public.otterly_snapshots to service_role;
create function public.otterly_enrich_prompt_platforms(p_end date,p_details jsonb,p_fetched_at timestamptz)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
 if jsonb_typeof(p_details) is distinct from 'array' or jsonb_array_length(p_details) <> 7
    or octet_length(p_details::text)>1000000 or p_fetched_at is null then
  raise exception 'Invalid prompt platform details';
 end if;
 update public.otterly_snapshots set payload=payload || jsonb_build_object('promptPlatforms',p_details,'promptPlatformsFetchedAt',p_fetched_at)
 where period_end=p_end and not (payload ? 'promptPlatforms');
 get diagnostics changed = row_count;
 return changed=1;
end;
$$;
revoke all on function public.otterly_enrich_prompt_platforms(date,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.otterly_enrich_prompt_platforms(date,jsonb,timestamptz) to service_role;
