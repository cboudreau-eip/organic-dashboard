-- Retain accumulated evidence and reversible changes without dropping history.
-- Keep item/count validation and a bounded payload; RLS and edit limits are unchanged.
alter table public.proposed_content_plans drop constraint proposed_content_plans_payload_check;
alter table public.proposed_content_plans add constraint proposed_content_plans_payload_check
 check (payload ? 'items' and jsonb_typeof(payload->'items')='array'
 and jsonb_array_length(payload->'items')<=90 and octet_length(payload::text)<3000000);
