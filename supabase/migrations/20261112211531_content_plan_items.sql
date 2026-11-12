-- Shared MedicareFAQ team planning state. Source evidence stays in the versioned shortlist.
create table public.content_plan_items (
 id text primary key check (id ~ '^[a-z][a-z0-9-]{0,79}$'),
 status text not null default 'Needs review' check (status in ('Needs review','Approved','In progress','Ready','Published','Deferred')),
 owner text not null default '' check (length(owner)<=120),
 brief text not null default '' check (length(brief)<=12000),
 approved boolean not null default false,
 scheduled_date date check (scheduled_date between date '2027-01-01' and date '2027-03-31'),
 version integer not null default 1 check (version>0),
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now(),
 check (approved or (scheduled_date is null and status in ('Needs review','Deferred'))),
 check (status<>'Published' or scheduled_date is not null)
);
alter table public.content_plan_items enable row level security;
revoke all on public.content_plan_items from public,anon,authenticated;
grant select,insert,update on public.content_plan_items to authenticated;
create policy content_plan_read on public.content_plan_items for select to authenticated
 using ((select public.growth_access()) in ('viewer','analyst','admin'));
create policy content_plan_insert on public.content_plan_items for insert to authenticated
 with check ((select public.growth_access()) in ('analyst','admin') and updated_by=(select auth.uid()));
create policy content_plan_update on public.content_plan_items for update to authenticated
 using ((select public.growth_access()) in ('analyst','admin'))
 with check ((select public.growth_access()) in ('analyst','admin') and updated_by=(select auth.uid()));
create function public.stamp_content_plan_item() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.id<>old.id then raise exception 'Opportunity identity cannot change'; end if;
  new.version=old.version+1;
 else new.version=1;
 end if;
 new.updated_by=auth.uid();new.updated_at=now();return new;
end;
$$;
revoke all on function public.stamp_content_plan_item() from public,anon,authenticated;
create trigger stamp_content_plan before insert or update on public.content_plan_items
 for each row execute function public.stamp_content_plan_item();
