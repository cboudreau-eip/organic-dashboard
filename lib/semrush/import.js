
/** Semrush Position Tracking export contract. No inferred prior ranks. */
export const LIMIT = 5000;
const fail = message => { throw new Error(message); };
const clean = value => String(value ?? '').trim();
const date = value => {
 const s=clean(value).replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s) fail('Invalid report date.');
 return s;
};
export function csvRows(text) {
 if(new TextEncoder().encode(text).length>2_000_000)fail('CSV must be under 2 MB.');
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else if(!quoted&&field!=='')fail('Invalid CSV quoting.');else quoted=!quoted;}
  else if(!quoted&&(c===','||c==='\n'||c==='\r')){row.push(field);field='';if(c!==','){rows.push(row);row=[];if(c==='\r'&&text[i+1]==='\n')i++;}}
  else field+=c;
 }
 if(quoted)fail('Unclosed CSV quote.');
 if(field||row.length){row.push(field);rows.push(row);}
 return rows;
}
const nullableNumber=(value,name,min=0,max=Number.MAX_SAFE_INTEGER)=>{
 const s=clean(value);
 if(['','-','—','n/a','na','null'].includes(s.toLowerCase()))return null;
 if(!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(s))fail('Invalid '+name+': '+s);
 const n=Number(s.replaceAll(',',''));if(!Number.isFinite(n)||n<min||n>max)fail('Invalid '+name+'.');return n;
};
export function parseSemrush(matrix) {
 if(!Array.isArray(matrix)||matrix.length>LIMIT+100)fail('Import up to 5,000 keyword rows.');
 const indices=matrix.flatMap((r,i)=>Array.isArray(r)&&clean(r[0]).replace(/^\uFEFF/,'')==='Keyword'?[i]:[]);
 if(indices.length!==1)fail('Expected one Rankings Overview table with a Keyword column.');
 const index=indices[0],headers=matrix[index].map(clean);
 const positions=headers.flatMap((h,i)=>/^\*\.medicarefaq\.com\/\*_\d{8}$/.test(h)?[i]:[]);
 if(positions.length!==1)fail('Expected one MedicareFAQ position date column.');
 const positionIndex=positions[0],positionHeader=headers[positionIndex],prefix=positionHeader.replace(/_\d{8}$/,'');
 const asOf=date(positionHeader.slice(-8));
 const required=['Keyword',positionHeader,positionHeader+'_share_of_voice',positionHeader+'_type',positionHeader+'_landing',prefix+'_difference',prefix+'_share_of_voice_difference','Tags','Intents','CPC','Search Volume','Keyword Difficulty'];
 if(required.some(h=>headers.filter(v=>v===h).length!==1)||headers.some(h=>h&&!required.includes(h)))fail('Export columns do not match the supported MedicareFAQ Rankings Overview format.');
 const meta=matrix.slice(0,index).map(r=>r.map(clean).join(' ')).join('\n');
 const id=meta.match(/\bID:\s*(\d+)/i)?.[1];
 const range=meta.match(/Period:\s*(\d{8})\s*-\s*(\d{8})/i);
 if(!id||!range||!/position_tracking_rankings_overview/i.test(meta))fail('Keep the report ID, report type and period rows above the table.');
 const start=date(range[1]),end=date(range[2]);
 if(start>end||end!==asOf)fail('Report period does not match the ranking column date.');
 const rows=[],seen=new Set();
 for(const r of matrix.slice(index+1)){
  if(!r.some(v=>clean(v)))continue;
  const get=h=>clean(r[headers.indexOf(h)]);
  const keyword=get('Keyword');
  if(!keyword||keyword.length>500||/[\u0000-\u001f]/.test(keyword))fail('A keyword is missing or invalid.');
  const key=keyword.toLowerCase();if(seen.has(key))fail('Duplicate keyword: '+keyword);seen.add(key);
  const rawPosition=get(positionHeader);
  let position=null;
  if(/^\d+$/.test(rawPosition)){const n=Number(rawPosition);if(n>=1&&n<=100)position=n;else if(![0,101].includes(n))fail('Unexpected position: '+rawPosition);}
  else if(!['','-','—','n/a','not ranked','100+','>100'].includes(rawPosition.toLowerCase()))fail('Unexpected position: '+rawPosition);
  const landing=get(positionHeader+'_landing');
  if(landing&&!['-','—','n/a'].includes(landing.toLowerCase())){
   let u;try{u=new URL(landing);}catch{fail('Invalid landing URL for '+keyword);}
   if(!['http:','https:'].includes(u.protocol)||u.username||u.password||!(u.hostname==='medicarefaq.com'||u.hostname.endsWith('.medicarefaq.com')))fail('Landing URL must belong to MedicareFAQ.');
  }
  const item={keyword,position,rawPosition,landing:['-','—','n/a'].includes(landing.toLowerCase())?'':landing,
   resultType:get(positionHeader+'_type'),tags:get('Tags'),intents:get('Intents'),
   sourceDifference:get(prefix+'_difference'),shareOfVoice:get(positionHeader+'_share_of_voice'),
   shareOfVoiceDifference:get(prefix+'_share_of_voice_difference'),
   cpc:nullableNumber(get('CPC'),'CPC'),volume:nullableNumber(get('Search Volume'),'search volume'),
   difficulty:nullableNumber(get('Keyword Difficulty'),'difficulty',0,100)};
  if(item.volume!==null&&!Number.isSafeInteger(item.volume))fail('Search volume must be an integer.');
  if(Object.values(item).some(v=>typeof v==='string'&&v.length>2048))fail('A cell exceeds the text limit.');
  rows.push(item);if(rows.length>LIMIT)fail('Import up to 5,000 keywords.');
 }
 if(!rows.length)fail('The export contains no keywords.');
 rows.sort((a,b)=>a.keyword<b.keyword?-1:a.keyword>b.keyword?1:0);
 return {version:1,campaignId:id,domain:'medicarefaq.com',start,end,rows};
}
export function validateSnapshot(input) {
 if(!input||typeof input!=='object'||!input.report||!input.scope)fail('Select a report and campaign settings.');
 const {report,scope}=input;
 // Rebuild through the same parser on the server; never trust normalized browser values.
 if(!Array.isArray(report.matrix))fail('Report rows are required.');
 const parsed=parseSemrush(report.matrix);
 const location=clean(scope.location),device=clean(scope.device),engine=clean(scope.engine);
 if(location.length<2||location.length>120||/[\u0000-\u001f]/.test(location))fail('Enter the campaign location exactly as shown in Semrush.');
 if(!['desktop','mobile','tablet'].includes(device)||!['Google','Bing','Baidu'].includes(engine))fail('Choose the campaign device and search engine.');
 if(scope.confirmed!==true)fail('Confirm campaign settings and that all keyword filters were cleared.');
 return {...parsed,scope:{location,device,engine},coverage:'User-confirmed unfiltered Semrush export; not independently verified'};
}
export function sameScope(a,b){
 return a.campaignId===b.campaignId&&a.domain===b.domain&&a.scope.location.toLowerCase()===b.scope.location.toLowerCase()&&a.scope.device===b.scope.device&&a.scope.engine===b.scope.engine;
}
export function compareSnapshots(current,prior){
 if(!sameScope(current,prior)||prior.end>=current.end)fail('Choose an earlier snapshot with matching campaign settings.');
 const before=new Map(prior.rows.map(r=>[r.keyword.toLowerCase(),r]));
 return current.rows.map(r=>{const p=before.get(r.keyword.toLowerCase());return {...r,priorPosition:p?.position??null,change:p?.position!=null&&r.position!=null?p.position-r.position:null,comparison:!p?'Not in earlier export':p.position==null||r.position==null?'Rank unavailable':'Comparable'};});
}
