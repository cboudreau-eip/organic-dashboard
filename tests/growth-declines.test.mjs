import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
test('decline SQL preserves evidence, computes loss, excludes missing pages and enforces roles',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to authenticated,anon;
 insert into auth.users values ('11111111-1111-4111-8111-111111111111');`);
 for(const file of ['20261019145752_growth_foundation.sql','20261019145804_growth_declines.sql']) await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec("begin; select set_config('growth_test.user_id','11111111-1111-4111-8111-111111111111',true);");
 await db.exec(await readFile(new URL('../supabase/tests/growth_declines.sql',import.meta.url),'utf8'));
 await db.exec('rollback');
 }finally{await db.close();}
});
