import test from 'node:test';
import assert from 'node:assert/strict';
import { policyConversions } from '../lib/datorama/conversion.js';
const fixture = () => Object.entries({eipLeads:100,allLeads:200,grossMS:10,grossMA:5,approvedMS:4,approvedMA:2}).map(([key,total])=>({key,total,missingDays:0,previous:{total:total*2,missingDays:0}}));
test('conversion uses EIP leads and keeps gross and approved separate',()=>{
 const result=policyConversions(fixture());
 assert.equal(result[0].current.rate,15);
 assert.equal(result[0].current.policies,15);
 assert.equal(result[3].current.rate,6);
 assert.equal(result[0].change,0);
});
test('missing values suppress affected rates and comparisons; zero is not missing',()=>{
 const metrics=fixture();metrics.find(m=>m.key==='grossMA').missingDays=1;
 let result=policyConversions(metrics);
 assert.equal(result[0].current.rate,null);
 assert.equal(result[0].change,null);
 assert.equal(result[1].current.rate,10);
 assert.equal(result[3].current.rate,6);
 metrics.find(m=>m.key==='eipLeads').total=0;
 assert.equal(policyConversions(metrics)[1].current.status,'No EIP leads');
 const zero=fixture();zero.find(m=>m.key==='grossMS').total=0;
 assert.equal(policyConversions(zero)[1].current.rate,0);
 zero.find(m=>m.key==='eipLeads').previous.missingDays=1;
 assert.equal(policyConversions(zero)[1].change,null);
 zero.find(m=>m.key==='grossMS').total=null;
 assert.equal(policyConversions(zero)[0].current.policies,null);
});
