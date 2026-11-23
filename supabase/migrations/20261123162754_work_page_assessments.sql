-- Separate generated proposals from immutable calendar dates and user-authored briefs.
create table public.content_work_assessments (
 id uuid primary key default gen_random_uuid(),
 queue_id uuid not null references public.content_work_pilots(id),
 assignment_id text not null check(length(assignment_id) between 1 and 100),
 fingerprint text not null check(length(fingerprint)=64),
 status text not null check(status in ('running','complete','failed')),
 payload jsonb check(payload is null or (jsonb_typeof(payload)='object' and octet_length(payload::text)<250000)),
 error text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
create index content_work_assessment_history on public.content_work_assessments(queue_id,assignment_id,created_at desc);
create index content_work_assessment_rate on public.content_work_assessments(created_by,created_at desc);
create unique index content_work_assessment_running on public.content_work_assessments(queue_id,assignment_id) where status='running';
alter table public.content_work_assessments enable row level security;
revoke all on public.content_work_assessments from public,anon,authenticated;
grant select on public.content_work_assessments to authenticated;
grant select,insert,update on public.content_work_assessments to service_role;
create policy work_assessment_read on public.content_work_assessments for select to authenticated
 using ((select public.growth_access()) in ('viewer','analyst','admin') and exists (select 1 from public.content_work_pilots q where q.id=queue_id));
