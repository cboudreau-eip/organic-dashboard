alter table public.growth_actions alter column page drop not null;
alter table public.growth_actions
 add column source_otterly_snapshot uuid references public.otterly_snapshots(id),
 add column source_otterly_prompt text,
 add column otterly_baseline jsonb,
 add constraint growth_action_source check (
  (source_otterly_snapshot is null and source_otterly_prompt is null and otterly_baseline is null and page is not null)
  or (source_otterly_snapshot is not null and source_otterly_prompt is not null and otterly_baseline is not null and source_snapshot is null and page is null)
 );
create unique index growth_actions_active_otterly_prompt on public.growth_actions(source_otterly_prompt)
 where source_otterly_prompt is not null and status <> 'archived';
grant insert(source_otterly_snapshot,source_otterly_prompt) on public.growth_actions to authenticated;
-- Derive the baseline inside the existing member/RLS context, never from a browser payload.
create function public.growth_otterly_baseline() returns trigger
language plpgsql security invoker set search_path='' as $$
declare report jsonb; prompt jsonb; platforms jsonb;
begin
 if TG_OP='UPDATE' then
  NEW.source_otterly_snapshot:=OLD.source_otterly_snapshot;
  NEW.source_otterly_prompt:=OLD.source_otterly_prompt;
  NEW.otterly_baseline:=OLD.otterly_baseline;
 elsif NEW.source_otterly_snapshot is not null then
  select payload into report from public.otterly_snapshots where id=NEW.source_otterly_snapshot;
  if report is null or report->>'domain'<>'medicarefaq.com' or report->>'country'<>'us' then
   raise exception 'Otterly report unavailable' using errcode='22023';
  end if;
  select p into prompt from jsonb_array_elements(report->'prompts') p where p->>'id'=NEW.source_otterly_prompt;
  if prompt is null or (prompt->>'mentions')::numeric is distinct from 0 or
     not (coalesce((prompt->>'domainMentions')::numeric,0)>0 or jsonb_array_length(prompt->'competitors')>0) then
   raise exception 'Choose a supported Otterly opportunity' using errcode='22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',e->>'id','label',e->>'label','prompt',
   (select p from jsonb_array_elements(case when jsonb_typeof(e->'prompts')='array' then e->'prompts' else '[]'::jsonb end) p where p->>'id'=NEW.source_otterly_prompt))), '[]'::jsonb)
  into platforms from jsonb_array_elements(coalesce(report->'promptPlatforms','[]'::jsonb)) e;
  NEW.title:=left('Investigate AI visibility: '||(prompt->>'prompt'),160);
  NEW.otterly_baseline:=jsonb_build_object('source','otterly','reportId',report->'reportId','domain',report->'domain','country',report->'country',
   'period',report->'period','fetchedAt',report->'fetchedAt','platformsFetchedAt',report->'promptPlatformsFetchedAt','prompt',prompt,'platforms',platforms,'capturedAt',now());
 end if;
 return NEW;
end $$;
revoke all on function public.growth_otterly_baseline() from public,anon,authenticated;
-- Run before the revision trigger so the history captures the derived title.
create trigger growth_action_otterly_baseline before insert or update on public.growth_actions
 for each row execute function public.growth_otterly_baseline();
