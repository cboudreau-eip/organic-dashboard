create table public.proposed_content_plans (
 id uuid primary key default gen_random_uuid(),
 research_run_id uuid not null references public.research_runs(id),
 payload jsonb not null check(payload ? 'items' and jsonb_typeof(payload->'items')='array' and jsonb_array_length(payload->'items')<=90 and octet_length(payload::text)<1500000),
 edits jsonb not null default '{}' check(jsonb_typeof(edits)='object' and octet_length(edits::text)<1000000),
 version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id), updated_by uuid not null default auth.uid() references auth.users(id)
);
alter table public.proposed_content_plans enable row level security;
revoke all on public.proposed_content_plans from public,anon,authenticated;
grant select,insert,update on public.proposed_content_plans to authenticated;
create policy proposals_read on public.proposed_content_plans for select to authenticated using ((select public.growth_access()) in ('viewer','analyst','admin'));
create policy proposals_insert on public.proposed_content_plans for insert to authenticated with check ((select public.growth_access()) in ('analyst','admin') and created_by=(select auth.uid()) and updated_by=(select auth.uid()));
create policy proposals_update on public.proposed_content_plans for update to authenticated using ((select public.growth_access()) in ('analyst','admin')) with check ((select public.growth_access()) in ('analyst','admin') and updated_by=(select auth.uid()));
create function public.stamp_proposed_plan() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry record; field record;
begin
 if tg_op='UPDATE' then
  if new.id<>old.id or new.research_run_id<>old.research_run_id or new.payload is distinct from old.payload then raise exception 'Original proposal evidence is immutable';end if;
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
revoke all on function public.stamp_proposed_plan() from public,anon,authenticated;
create trigger proposed_plan_stamp before insert or update on public.proposed_content_plans for each row execute function public.stamp_proposed_plan();
create index proposed_plans_created on public.proposed_content_plans(created_at desc);
