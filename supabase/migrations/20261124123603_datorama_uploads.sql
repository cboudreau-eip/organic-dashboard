create table public.datorama_imports (
 id text primary key check (length(id)=64),
 filename text not null,
 exported_at timestamptz not null,
 imported_at timestamptz not null default now(),
 imported_by uuid not null,
 payload jsonb not null check (payload->>'scopeId'='medicarefaq-production')
);
alter table public.datorama_imports enable row level security;
revoke all on public.datorama_imports from anon, authenticated;
grant select,insert on public.datorama_imports to service_role;
create index datorama_imports_exported on public.datorama_imports(exported_at desc);
