
-- Run inside a transaction after both migrations; always roll back fixture data.
insert into public.growth_members(user_id,role)
select current_setting('growth_test.user_id')::uuid,'analyst';
select set_config('request.jwt.claim.sub',current_setting('growth_test.user_id'),true);
set local role authenticated;
do $$ begin
  begin perform public.growth_detect_declines(null,null,true); raise exception 'Disabled run allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.growth_settings set enabled=true;
set local role authenticated;
do $$
declare p jsonb; c jsonb; a jsonb; b jsonb; r jsonb; again jsonb; fid uuid;
begin
p := '{"schemaVersion":1,"source":"gsc","property":"https://www.medicarefaq.com/","timezone":"America/Los_Angeles","start":"2026-01-01","end":"2026-01-28","coverage":"manual_pages_export_not_exhaustive","rows":[{"url":"https://www.medicarefaq.com/test-decline/","clicks":100,"impressions":1000,"ctr":0.1,"position":5},{"url":"https://www.medicarefaq.com/test-missing/","clicks":100,"impressions":1000,"ctr":0.1,"position":5}]}'::jsonb;
c := jsonb_set(jsonb_set(p,'{start}','"2026-01-29"'),'{end}','"2026-02-25"');
c := jsonb_set(c,'{rows}','[{"url":"https://www.medicarefaq.com/test-decline/","clicks":60,"impressions":1000,"ctr":0.06,"position":7},{"url":"https://www.medicarefaq.com/test-new/","clicks":20,"impressions":100,"ctr":0.2,"position":4}]');
a := public.growth_import_snapshot(p);
b := public.growth_import_snapshot(c);
assert (a->>'inserted')::boolean;
assert public.growth_import_snapshot(p)->>'id'=a->>'id';
assert public.growth_import_snapshot(p)->>'inserted'='false';
begin perform public.growth_import_snapshot(jsonb_set(p,'{rows,0,ctr}','0.99')); raise exception 'Bad CTR allowed';
exception when invalid_parameter_value then null; end;
begin perform public.growth_import_snapshot(jsonb_set(p,'{source}','null')); raise exception 'Null source allowed';
exception when invalid_parameter_value then null; end;
r := public.growth_detect_declines((a->>'id')::uuid,(b->>'id')::uuid,true);
assert r#>>'{run,result,status}'='candidates_found';
assert r#>>'{run,result,matchedPages}'='1';
assert r#>>'{run,result,priorOnlyPages}'='1';
assert r#>>'{run,result,currentOnlyPages}'='1';
assert r#>>'{run,result,candidateCount}'='1';
assert r#>>'{run,result,findings,0,lostClicks}'='40';
assert (r#>>'{run,result,findings,0,declinePercent}')::numeric=40;
assert (r#>>'{run,result,findings,0,positionChange}')::numeric=2;
assert (r#>>'{run,result,findings,0,ctrChangePoints}')::numeric=-4;
again := public.growth_detect_declines((a->>'id')::uuid,(b->>'id')::uuid,true);
assert again->>'reused'='true';
assert again#>>'{run,id}'=r#>>'{run,id}';
begin perform public.growth_detect_declines((a->>'id')::uuid,(b->>'id')::uuid,false); raise exception 'Unconfirmed scope allowed';
exception when invalid_parameter_value then null; end;
begin perform public.growth_detect_declines((b->>'id')::uuid,(a->>'id')::uuid,true); raise exception 'Reversed periods allowed';
exception when invalid_parameter_value then null; end;
begin perform public.growth_detect_declines((a->>'id')::uuid,(a->>'id')::uuid,true); raise exception 'Same snapshot allowed';
exception when invalid_parameter_value then null; end;
begin perform public.growth_detect_declines(gen_random_uuid(),(a->>'id')::uuid,true); raise exception 'Missing snapshot allowed';
exception when no_data_found then null; end;
begin update public.growth_decline_runs set result='{}'; raise exception 'Run edit allowed';
exception when insufficient_privilege then null; end;
begin delete from public.growth_snapshots; raise exception 'Snapshot deletion allowed';
exception when insufficient_privilege then null; end;
begin update public.growth_members set role='admin'; raise exception 'Self promotion allowed';
exception when insufficient_privilege then null; end;
assert (select count(*) from public.growth_decline_runs)=1;
end $$;
reset role;
update public.growth_members set role='viewer';
set local role authenticated;
do $$ begin
assert (select count(*) from public.growth_decline_runs)=1;
begin perform public.growth_detect_declines(null,null,true); raise exception 'Viewer run allowed';
exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.growth_members set active=false;
set local role authenticated;
do $$ begin
assert (select count(*) from public.growth_decline_runs)=0;
assert (select count(*) from public.growth_snapshots)=0;
end $$;
reset role;
set local role anon;
do $$ begin
begin perform public.growth_access(); raise exception 'Anon access allowed';
exception when insufficient_privilege then null; end;
begin perform public.growth_detect_declines(null,null,true); raise exception 'Anon run allowed';
exception when insufficient_privilege then null; end;
end $$;
reset role;
