alter table public.proposed_content_plans add column calendar jsonb;
create function public.validate_demo_calendar() returns trigger language plpgsql security invoker set search_path='' as $$
declare entry record;
begin
 if new.calendar is null then
  if tg_op='UPDATE' and old.calendar is not null then raise exception 'Saved calendars cannot be cleared';end if;
  return new;
 end if;
 if jsonb_typeof(new.calendar)<>'object' or new.calendar->>'status' is distinct from 'Tentative' or jsonb_typeof(new.calendar->'dates') is distinct from 'object' or jsonb_typeof(new.calendar->'locked') is distinct from 'array' then raise exception 'Invalid tentative calendar';end if;
 if jsonb_array_length(new.payload->'items')<>90 or (select count(*) from jsonb_each(new.calendar->'dates'))<>90 or (select count(distinct value) from jsonb_each_text(new.calendar->'dates'))<>90 then raise exception 'Exactly 90 distinct daily assignments required';end if;
 for entry in select * from jsonb_each_text(new.calendar->'dates') loop
  if not exists(select 1 from jsonb_array_elements(new.payload->'items') i where i->>'id'=entry.key) or not exists(select 1 from generate_series(date '2027-01-01',date '2027-03-31',interval '1 day') d where to_char(d,'YYYY-MM-DD')=entry.value) then raise exception 'Invalid assignment or calendar date';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements_text(new.calendar->'locked') id where not (new.calendar->'dates') ? id) then raise exception 'Unknown fixed assignment';end if;
 return new;
end;$$;
revoke all on function public.validate_demo_calendar() from public,anon,authenticated;
create trigger demo_calendar_validate before insert or update on public.proposed_content_plans for each row execute function public.validate_demo_calendar();
