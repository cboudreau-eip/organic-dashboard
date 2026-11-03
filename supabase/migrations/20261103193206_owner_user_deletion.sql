begin;
alter table public.dashboard_members add column deletion_requested boolean not null default false;

-- A failed Auth API call must never allow access to be re-enabled during deletion.
create function public.guard_member_deletion() returns trigger
language plpgsql set search_path='' as $$
begin
 if old.deletion_requested then raise exception 'Deletion is pending' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.guard_member_deletion() from public,anon,authenticated;
create trigger protect_pending_user_deletion before update on public.dashboard_members
for each row execute function public.guard_member_deletion();

create or replace function public.admin_user_directory() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'name',coalesce(m.name,''),
 'access',coalesce(m.access_level,'basic'),'active',coalesce(m.active,false),'version',coalesce(m.version,0),
 'deletionPending',coalesce(m.deletion_requested,false),
 'confirmed',u.email_confirmed_at is not null,'lastSignIn',u.last_sign_in_at,'createdAt',u.created_at) order by u.created_at),'[]'::jsonb)
 from auth.users u left join public.dashboard_members m on m.user_id=u.id where u.deleted_at is null
$$;

create function public.admin_prepare_user_deletion(actor uuid,target uuid,confirmation_email text,expected_version integer) returns void
language plpgsql security definer set search_path='' as $$
declare member public.dashboard_members; target_email text;
begin
 if actor is distinct from 'c8dad8c8-d33d-4b50-839f-f5d4021440dd'::uuid or not exists(select 1 from public.dashboard_members where user_id=actor and active) then
  raise exception 'Owner access required' using errcode='42501';
 end if;
 if target='c8dad8c8-d33d-4b50-839f-f5d4021440dd'::uuid then raise exception 'Owner account is protected' using errcode='42501'; end if;
 select email into target_email from auth.users where id=target and deleted_at is null for update;
 if not found or confirmation_email is distinct from target_email then raise exception 'Confirm the current email' using errcode='22023'; end if;
 select * into member from public.dashboard_members where user_id=target for update;
 if expected_version is distinct from coalesce(member.version,0) then raise exception 'Reload this user' using errcode='40001'; end if;
 if member.deletion_requested then return; end if;
 perform public.admin_save_member(actor,target,coalesce(member.name,''),coalesce(member.access_level,'basic'),false,expected_version);
 update public.dashboard_members set deletion_requested=true where user_id=target;
 insert into public.dashboard_user_audit(actor_id,target_id,action) values(actor,target,'deletion_requested');
end $$;
revoke all on function public.admin_prepare_user_deletion(uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.admin_prepare_user_deletion(uuid,uuid,text,integer) to service_role;
commit;
