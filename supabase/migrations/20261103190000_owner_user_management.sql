begin;
create table public.dashboard_members (
 user_id uuid primary key references auth.users(id),
 name text not null default '' check(length(name)<=100),
 access_level text not null check(access_level in ('basic','viewer','analyst')),
 active boolean not null default true,
 version integer not null default 1,
 updated_at timestamptz not null default now()
);
insert into public.dashboard_members(user_id,name,access_level,active)
 select u.id,coalesce(left(u.raw_user_meta_data->>'name',100),''),
 case when m.active and m.role in ('analyst','admin') then 'analyst' when m.active and m.role='viewer' then 'viewer' else 'basic' end,
 (u.banned_until is null or u.banned_until<now())
 from auth.users u left join public.growth_members m on m.user_id=u.id;
create table public.dashboard_user_audit (
 id bigint generated always as identity primary key,
 created_at timestamptz not null default now(),
 actor_id uuid not null references auth.users(id),
 target_id uuid not null references auth.users(id),
 action text not null,
 details jsonb not null default '{}'
);
alter table public.dashboard_members enable row level security;
alter table public.dashboard_user_audit enable row level security;
revoke all on public.dashboard_members,public.dashboard_user_audit from public,anon,authenticated;
grant select on public.dashboard_members,public.dashboard_user_audit to service_role;

create function public.dashboard_access() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.dashboard_members where user_id=auth.uid() and active)
$$;
revoke all on function public.dashboard_access() from public,anon;
grant execute on function public.dashboard_access() to authenticated;

create or replace function public.growth_access() returns text
language sql stable security definer set search_path='' as $$
 select m.role from public.growth_members m
 join public.growth_settings s on s.id=true and s.enabled
 join public.dashboard_members d on d.user_id=m.user_id and d.active
 where m.user_id=auth.uid() and m.active
$$;

create function public.admin_user_directory() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'name',coalesce(m.name,''),
 'access',coalesce(m.access_level,'basic'),'active',coalesce(m.active,false),'version',coalesce(m.version,0),
 'confirmed',u.email_confirmed_at is not null,'lastSignIn',u.last_sign_in_at,'createdAt',u.created_at) order by u.created_at),'[]'::jsonb)
 from auth.users u left join public.dashboard_members m on m.user_id=u.id
$$;
revoke all on function public.admin_user_directory() from public,anon,authenticated;
grant execute on function public.admin_user_directory() to service_role;

create function public.admin_save_member(actor uuid,target uuid,display_name text,level text,enabled boolean,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare old_version integer;
begin
 if actor <> 'c8dad8c8-d33d-4b50-839f-f5d4021440dd'::uuid or actor is null or not exists(select 1 from public.dashboard_members where user_id=actor and active) then
  raise exception 'Owner access required' using errcode='42501';
 end if;
 if target='c8dad8c8-d33d-4b50-839f-f5d4021440dd'::uuid then raise exception 'Owner account is protected' using errcode='42501'; end if;
 if level is null or level not in ('basic','viewer','analyst') or display_name is null or length(display_name)>100 or enabled is null then
  raise exception 'Invalid member details' using errcode='22023';
 end if;
 -- Serialize edits, including insertion, and preserve saved work when access is disabled.
 perform id from auth.users where id=target for update;
 if not found then raise exception 'User not found' using errcode='22023'; end if;
 select version into old_version from public.dashboard_members where user_id=target for update;
 if expected_version is distinct from coalesce(old_version,0) then raise exception 'Reload this user before saving' using errcode='40001'; end if;
 insert into public.dashboard_members(user_id,name,access_level,active) values(target,display_name,level,enabled)
 on conflict(user_id) do update set name=excluded.name,access_level=excluded.access_level,active=excluded.active,version=dashboard_members.version+1,updated_at=now();
 insert into public.growth_members(user_id,role,active) values(target,case when level='analyst' then 'analyst' else 'viewer' end,enabled and level<>'basic')
 on conflict(user_id) do update set role=excluded.role,active=excluded.active;
 insert into public.dashboard_user_audit(actor_id,target_id,action,details)
 values(actor,target,'access_saved',jsonb_build_object('name',display_name,'access',level,'active',enabled));
end
$$;
revoke all on function public.admin_save_member(uuid,uuid,text,text,boolean,integer) from public,anon,authenticated;
grant execute on function public.admin_save_member(uuid,uuid,text,text,boolean,integer) to service_role;
commit;
