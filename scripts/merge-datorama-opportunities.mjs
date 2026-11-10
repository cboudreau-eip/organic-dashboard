// Usage: node --env-file=.env.local scripts/merge-datorama-opportunities.mjs private-input.json
// Validates against the existing scoped snapshot before updating the ignored local environment.
import {readFileSync,writeFileSync} from 'node:fs';
import {gzipSync,gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {validateDaily} from '../lib/datorama/periods.js';
import {preserveCheckpoints} from './save-datorama-checkpoints.mjs';
const data=validateDaily(JSON.parse(gunzipSync(Buffer.from(process.env.DATORAMA_DAILY_GZIP,'base64'))));
assert.equal(data.scopeId,'medicarefaq-production');
await preserveCheckpoints(data);
const input=JSON.parse(readFileSync(process.argv[2],'utf8'));
assert.equal(Object.keys(input.opportunities).length,data.rows.length);
for(const row of data.rows){
  assert.ok(Object.hasOwn(input.opportunities,row.date));
  for(const [key,value] of Object.entries(input.controls[row.date]))assert.equal(row.values[key],value,`Source mismatch: ${row.date} ${key}`);
  row.values.opportunities=input.opportunities[row.date];
}
data.version=2;
data.metrics=data.metrics.filter(m=>m.key!=='opportunities');
data.metrics.push({key:'opportunities',label:'Salesforce Opportunity Count'});
data.totals.opportunities=input.total;
validateDaily(data);
await preserveCheckpoints(data);
const value=gzipSync(JSON.stringify(data)).toString('base64');
const env=readFileSync('.env.local','utf8');
assert.match(env,/^DATORAMA_DAILY_GZIP=.*$/m);
writeFileSync('.env.local',env.replace(/^DATORAMA_DAILY_GZIP=.*$/m,`DATORAMA_DAILY_GZIP=${value}`));
console.log(JSON.stringify({version:data.version,metrics:data.metrics.length,days:data.rows.length,total:input.total,exportedAt:data.exportedAt}));
