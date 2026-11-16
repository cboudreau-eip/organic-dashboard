create table public.proposal_target_resolutions (
 plan_id uuid not null references public.proposed_content_plans(id),
 item_id text not null check(length(item_id)<=100),
 fingerprint text not null check(length(fingerprint)=24),
 result jsonb not null check(jsonb_typeof(result)='object' and octet_length(result::text)<100000),
 primary key(plan_id,item_id)
);
alter table public.proposal_target_resolutions enable row level security;
revoke all on public.proposal_target_resolutions from public,anon,authenticated;
grant select on public.proposal_target_resolutions to authenticated;
grant all on public.proposal_target_resolutions to service_role;
create policy target_resolutions_read on public.proposal_target_resolutions for select to authenticated using ((select public.growth_access()) in ('viewer','analyst','admin'));
comment on table public.proposal_target_resolutions is 'Server-generated live page evidence. Only the authorized server may write; never mutates assignments or dates.';
