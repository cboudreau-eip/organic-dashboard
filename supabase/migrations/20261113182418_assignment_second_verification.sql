-- Preserve all previous decisions; new Keep writes require the second pass.
create function public.require_assignment_verification() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.decision='Keep' and not exists(
  select 1 from public.research_validations v,
   lateral jsonb_array_elements(coalesce(v.payload->'assignments','[]'::jsonb)) a
  where v.id=new.validation_id and v.status='complete'
   and v.rules_version='validation-v2' and a->>'key'=new.assignment_key
   and a->'result'->>'readiness'='Ready for review'
   and a->'result'->'verification'->>'status'='Passed'
 ) then raise exception 'Complete the second verification pass before Keep';end if;
 return new;
end;$$;
revoke all on function public.require_assignment_verification() from public,anon,authenticated;
create trigger require_assignment_verification before insert or update
 on public.research_assignment_reviews for each row execute function public.require_assignment_verification();
