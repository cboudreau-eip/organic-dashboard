-- Independent, resumable validation snapshots; original research is immutable.
create table public.research_validations (
 id uuid primary key default gen_random_uuid(),
 research_run_id uuid not null references public.research_runs(id),
 rules_version text not null,
 status text not null default 'running' check(status in ('running','complete')),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=2000000),
 version integer not null default 1,
 lease_token uuid,
 lease_expires_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid not null default auth.uid() references auth.users(id),
 check ((lease_token is null)=(lease_expires_at is null))
);
create index research_validations_history on public.research_validations(research_run_id,created_at desc);
create unique index research_validation_active on public.research_validations(research_run_id,rules_version) where status='running';
create table public.research_assignment_reviews (
 validation_id uuid not null references public.research_validations(id),
 assignment_key text not null check(assignment_key ~ '^[a-f0-9]{24}$'),
 decision text not null check(decision in ('Needs review','Keep','Defer','Reject')),
 reason text not null default '' check(length(reason)<=2000),
 version integer not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid not null default auth.uid() references auth.users(id),
 primary key(validation_id,assignment_key)
);
create function public.stamp_research_validation() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='research_validations' then
  if not exists(select 1 from public.research_runs where id=new.research_run_id and status='complete') then raise exception 'Validation needs completed research';end if;
  if tg_op='UPDATE' then
   if old.status='complete' then raise exception 'Completed validation is immutable';end if;
   if new.id<>old.id or new.research_run_id<>old.research_run_id or new.rules_version<>old.rules_version then raise exception 'Validation identity is immutable';end if;
   new.created_at=old.created_at;new.created_by=old.created_by;
  else new.created_at=now();new.created_by=auth.uid();end if;
 else
  if tg_op='UPDATE' and (new.validation_id<>old.validation_id or new.assignment_key<>old.assignment_key) then raise exception 'Review identity is immutable';end if;
  if not exists(select 1 from public.research_validations v, lateral jsonb_array_elements(coalesce(v.payload->'assignments','[]'::jsonb)) a where v.id=new.validation_id and v.status='complete' and a->>'key'=new.assignment_key and (new.decision<>'Keep' or a->'result'->>'readiness'='Ready for review')) then raise exception 'Choose a completed assignment; Keep requires ready evidence';end if;
 end if;
 new.version=case when tg_op='INSERT' then 1 else old.version+1 end;
 new.updated_at=now();new.updated_by=auth.uid();return new;
end;$$;
revoke all on function public.stamp_research_validation() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['research_validations','research_assignment_reviews'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('create policy validation_read on public.%I for select to authenticated using ((select public.growth_access()) in (''viewer'',''analyst'',''admin''))',t);
  execute format('create policy validation_insert on public.%I for insert to authenticated with check ((select public.growth_access()) in (''analyst'',''admin'') and updated_by=(select auth.uid()))',t);
  execute format('create policy validation_update on public.%I for update to authenticated using ((select public.growth_access()) in (''analyst'',''admin'')) with check ((select public.growth_access()) in (''analyst'',''admin'') and updated_by=(select auth.uid()))',t);
  execute format('create trigger stamp_validation before insert or update on public.%I for each row execute function public.stamp_research_validation()',t);
 end loop;
end;$$;
