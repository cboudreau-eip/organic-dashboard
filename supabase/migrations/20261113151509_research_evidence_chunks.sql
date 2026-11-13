create table public.research_evidence_chunks (
 run_id uuid not null references public.research_runs(id),
 key text not null check(key ~ '^[a-f0-9]{64}$'),
 payload jsonb not null check(jsonb_typeof(payload)='array' and octet_length(payload::text)<=500000),
 created_at timestamptz not null default now(),
 created_by uuid not null default auth.uid() references auth.users(id),
 primary key(run_id,key)
);
alter table public.research_evidence_chunks enable row level security;
revoke all on public.research_evidence_chunks from public,anon,authenticated;
grant select,insert on public.research_evidence_chunks to authenticated;
create policy research_chunks_read on public.research_evidence_chunks for select to authenticated
 using ((select public.growth_access()) in ('viewer','analyst','admin'));
create policy research_chunks_insert on public.research_evidence_chunks for insert to authenticated
 with check ((select public.growth_access()) in ('analyst','admin') and created_by=(select auth.uid()) and exists(select 1 from public.research_runs r where r.id=run_id and r.status='running'));

create or replace function public.stamp_research_record() returns trigger language plpgsql security invoker set search_path='' as $$
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
   select 1 from public.research_runs r where r.id=new.run_id and r.status='complete' and (
    exists(select 1 from jsonb_array_elements(case when jsonb_typeof(r.payload->'results'->'items')='array' then r.payload->'results'->'items' else '[]'::jsonb end) item where item->>'key'=new.key)
    or exists(select 1 from public.research_evidence_chunks a, lateral jsonb_array_elements(a.payload) item
     where a.run_id=r.id and (r.payload->'results'->'items'->'assetKeys') ? a.key and item->>'key'=new.key)
   )
  ) then raise exception 'Review must reference a completed research candidate';end if;
 end if;
 new.updated_by=auth.uid();new.updated_at=now();return new;
end;$$;
revoke all on function public.stamp_research_record() from public,anon,authenticated;
