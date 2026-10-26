-- Saved work and observed follow-up results. Existing Growth Hunter membership governs access.
create table public.growth_actions (
 id uuid primary key default gen_random_uuid(),
 page text not null check (length(page)<=2048 and page ~ '^https?://(www\.)?medicarefaq\.com/[^?#]*$'),
 title text not null check (length(trim(title)) between 1 and 160),
 notes text not null default '' check (length(notes)<=4000),
 status text not null default 'planned' check (status in ('planned','in_progress','published','monitoring','archived')),
 published_on date,
 source_snapshot uuid references public.semrush_snapshots(id),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version integer not null default 1,
 history jsonb not null default '[]'::jsonb,
 check (status not in ('published','monitoring') or published_on is not null),
 check (published_on is null or published_on between '2000-01-01'::date and (now() at time zone 'America/Los_Angeles')::date)
);
create unique index growth_actions_active_page on public.growth_actions(page) where status <> 'archived';
create index growth_actions_recent on public.growth_actions(updated_at desc,id);
create table public.growth_action_results (
 id uuid primary key default gen_random_uuid(),
 action_id uuid not null references public.growth_actions(id),
 action_version integer not null,
 published_on date not null,
 window_days integer not null check (window_days in (7,28)),
 payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<200000),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create index growth_action_results_action on public.growth_action_results(action_id,created_at desc);

create function public.growth_action_revision() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then
  NEW.version:=1; NEW.created_by:=auth.uid(); NEW.created_at:=now(); NEW.history:='[]'::jsonb;
 else
  NEW.page:=OLD.page; NEW.source_snapshot:=OLD.source_snapshot; NEW.created_by:=OLD.created_by; NEW.created_at:=OLD.created_at;
  NEW.version:=OLD.version+1; NEW.history:=OLD.history;
 end if;
 if jsonb_array_length(NEW.history)>=500 then raise exception 'Action history limit reached. Archive this action and start another.'; end if;
 NEW.updated_at:=now();
 NEW.history:=NEW.history || jsonb_build_array(jsonb_build_object('version',NEW.version,'at',NEW.updated_at,'actor',auth.uid(),'title',NEW.title,'notes',NEW.notes,'status',NEW.status,'published_on',NEW.published_on));
 return NEW;
end $$;
revoke all on function public.growth_action_revision() from public,anon,authenticated;
create trigger growth_action_revision before insert or update on public.growth_actions for each row execute function public.growth_action_revision();

alter table public.growth_actions enable row level security;
alter table public.growth_action_results enable row level security;
revoke all on public.growth_actions,public.growth_action_results from public,anon,authenticated;
grant select on public.growth_actions,public.growth_action_results to authenticated;
grant insert(page,title,notes,source_snapshot) on public.growth_actions to authenticated;
grant update(title,notes,status,published_on) on public.growth_actions to authenticated;
grant insert(action_id,action_version,published_on,window_days,payload) on public.growth_action_results to authenticated;
create policy growth_actions_read on public.growth_actions for select to authenticated using ((select public.growth_access()) in ('viewer','analyst','admin'));
create policy growth_actions_insert on public.growth_actions for insert to authenticated with check (created_by=(select auth.uid()) and (select public.growth_access()) in ('analyst','admin'));
create policy growth_actions_update on public.growth_actions for update to authenticated using ((select public.growth_access()) in ('analyst','admin')) with check ((select public.growth_access()) in ('analyst','admin'));
create policy growth_action_results_read on public.growth_action_results for select to authenticated using ((select public.growth_access()) in ('viewer','analyst','admin'));
create policy growth_action_results_insert on public.growth_action_results for insert to authenticated with check (
 created_by=(select auth.uid()) and (select public.growth_access()) in ('analyst','admin') and exists (
 select 1 from public.growth_actions a where a.id=action_id and a.version=action_version and a.published_on=growth_action_results.published_on and a.status in ('published','monitoring')
 ));
