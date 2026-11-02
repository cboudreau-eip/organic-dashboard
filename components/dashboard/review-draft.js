export const REVIEW_FIELDS = [
 ['period','Review dates','Start and end dates for this review.'],
 ['comparison','Comparison dates','The comparison period; note different dates used by any source.'],
 ['freshness','Sources, scope, and data gaps','MedicareFAQ organic scope; source/report name, data-through and retrieval dates; device/location; missing values.'],
 ['performance','Traffic and search summary','What changed? Include current/prior counts, dates, and the report supporting each finding.'],
 ['leads','Leads and policies','Keep PostHog submissions and Datorama EIP leads separate. Specify gross/approved and MS/MA. Label subtotals and unavailable rates.'],
 ['opportunity1','Opportunity 1','Page URL • evidence and source/date • why it matters • next action • owner • target date • success measure.'],
 ['opportunity2','Opportunity 2','Page URL • evidence and source/date • why it matters • next action • owner • target date • success measure.'],
 ['opportunity3','Opportunity 3','Page URL • evidence and source/date • why it matters • next action • owner • target date • success measure.'],
 ['results','Previous work and available results','What shipped and when? Before/after dates and values, saved result date, limits, and next step. If none, say not yet available.'],
 ['decisions','Decisions and follow-up','What do you need from Pepper? Priorities, owners, next review date, and unresolved questions.']
];
export const emptyReview=()=>Object.fromEntries(REVIEW_FIELDS.map(([key])=>[key,'']));
const keyFor=userId=>{if(typeof userId!=='string'||!userId)throw Error('Sign in to save a draft.');return 'organic-review-draft:v1:'+userId;};
export function validateReview(value){
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid review draft.');
 return Object.fromEntries(REVIEW_FIELDS.map(([key])=>{if(typeof value[key]!=='string'||value[key].length>4000)throw Error('Invalid review draft field.');return [key,value[key]];}));
}
export function readReview(storage,userId){
 const raw=storage.getItem(keyFor(userId));if(!raw)return null;
 const record=JSON.parse(raw);if(record.version!==1||typeof record.savedAt!=='string'||!Number.isFinite(Date.parse(record.savedAt)))throw Error('Invalid saved draft.');
 return {fields:validateReview(record.fields),savedAt:record.savedAt};
}
export function saveReview(storage,userId,fields){
 const record={version:1,fields:validateReview(fields),savedAt:new Date().toISOString()};
 storage.setItem(keyFor(userId),JSON.stringify(record));return record;
}
export function formatReview(fields){
 const draft=validateReview(fields);
 return 'Review for Pepper — MedicareFAQ organic performance\n\n'+REVIEW_FIELDS.map(([key,label])=>label+'\n'+(draft[key].trim()||'[Not recorded]')).join('\n\n');
}
