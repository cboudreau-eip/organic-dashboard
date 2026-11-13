import {assignmentFingerprint,priorDecision} from './assignment-pool.js';
export async function previousDecisions(client,run){
 if(!run?.payload.assignments.length)return {previousReviews:[],historyLimited:false};
 const rows=await client.from('research_assignment_reviews').select('*').in('assignment_key',run.payload.assignments.map(a=>a.key)).order('updated_at',{ascending:false}).limit(1000);
 if(rows.error)throw Error('Review history unavailable');
 const latest=new Map();for(const r of rows.data||[])if(r.validation_id!==run.id&&!latest.has(r.assignment_key))latest.set(r.assignment_key,r);
 const ids=[...new Set([...latest.values()].map(r=>r.validation_id))];if(!ids.length)return {previousReviews:[],historyLimited:false};
 const snapshots=await client.from('research_validations').select('id,payload,created_at').in('id',ids);if(snapshots.error)throw Error('Review evidence unavailable');
 const previousReviews=[];
 for(const r of latest.values()){
  const old=snapshots.data.find(v=>v.id===r.validation_id),before=old?.payload.assignments.find(a=>a.key===r.assignment_key),after=run.payload.assignments.find(a=>a.key===r.assignment_key);
  if(!before||!after||Date.parse(old.created_at)>=Date.parse(run.created_at))continue;
  previousReviews.push(priorDecision({...r,fingerprint:assignmentFingerprint(before,old.payload.sourceDates)},after,run.payload.sourceDates));
 }
 return {previousReviews,historyLimited:rows.data.length===1000};
}
