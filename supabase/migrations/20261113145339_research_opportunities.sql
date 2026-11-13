-- Shared planning inputs, immutable completed evidence runs and durable review choices.
create table public.research_settings (
 id text primary key default 'team' check(id='team'),
 settings jsonb not null check(jsonb_typeof(settings)='object'),
 version integer not null default 1,
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now()
);
create table public.research_runs (
 id uuid primary key default gen_random_uuid(),
 settings jsonb not null check(jsonb_typeof(settings)='object'),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 stage text not null default 'gsc' check(stage in ('gsc','posthog','semrush','otterly','sitemaps','pages','rank','complete')),
 status text not null default 'running' check(status in ('running','complete')),
 version integer not null default 1,
 created_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(),
 check((status='complete')=(stage='complete'))
);
create index research_runs_created on public.research_runs(created_at desc);
create table public.research_reviews (
 key text primary key check(key ~ '^[a-f0-9]{24}$'),
 run_id uuid not null references public.research_runs(id),
 decision text not null check(decision in ('Needs review','Keep','Defer','Reject')),
 reason text not null default '' check(length(reason)<=2000),
 version integer not null default 1,
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now()
);
create index research_reviews_run on public.research_reviews(run_id);
create function public.stamp_research_record() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  new.version=old.version+1;
  if tg_table_name='research_runs' then
   if old.status='complete' then raise exception 'Completed research is immutable'; end if;
   if new.settings is distinct from old.settings or new.id<>old.id then raise exception 'Run identity and settings are immutable'; end if;
   new.created_by=old.created_by;new.created_at=old.created_at;
  elsif tg_table_name='research_settings' then
   if new.id<>old.id then raise exception 'Settings identity cannot change'; end if;
  elsif new.key<>old.key then raise exception 'Review identity cannot change';
  end if;
 else
  new.version=1;
  if tg_table_name='research_runs' then new.created_by=auth.uid();new.created_at=now();end if;
 end if;
 if tg_table_name='research_reviews' then
 if not exists (
  select 1 from public.research_runs r, lateral jsonb_array_elements(coalesce(r.payload->'results'->'items','[]'::jsonb)) item
  where r.id=new.run_id and r.status='complete' and item->>'key'=new.key
 ) then raise exception 'Review must reference a completed research candidate';end if;
 end if;
 new.updated_by=auth.uid();new.updated_at=now();return new;
end;$$;
revoke all on function public.stamp_research_record() from public,anon,authenticated;
do $$declare t text;begin
 foreach t in array array['research_settings','research_runs','research_reviews'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select,insert,update on public.%I to authenticated',t);
  execute format('create policy research_read on public.%I for select to authenticated using ((select public.growth_access()) in (''viewer'',''analyst'',''admin''))',t);
  execute format('create policy research_insert on public.%I for insert to authenticated with check ((select public.growth_access()) in (''analyst'',''admin'') and updated_by=(select auth.uid()))',t);
  execute format('create policy research_update on public.%I for update to authenticated using ((select public.growth_access()) in (''analyst'',''admin'')) with check ((select public.growth_access()) in (''analyst'',''admin'') and updated_by=(select auth.uid()))',t);
  execute format('create trigger stamp_research before insert or update on public.%I for each row execute function public.stamp_research_record()',t);
 end loop;
end;$$;
