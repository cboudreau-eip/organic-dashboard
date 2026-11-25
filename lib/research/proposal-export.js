const INK='173E32',MUTED='63756D',PAPER='F5F7F3';
const PALETTE={'High intent':'E4EFD3','Long-tail':'DDEEF8','AI citations':'EDE3F6',Evergreen:'FFF0D4'};
const MONTHS=['January','February','March'];
const fill=color=>({type:'pattern',pattern:'solid',fgColor:{argb:color}});
const text=v=>String(v??'');
const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')?new Date(v+'T12:00:00Z'):null;
function chunks(value){const result=[];let part='',lines=0;for(const c of value){part+=c;if(c==='\n')lines++;if(part.length>=500||lines>=18){result.push(part);part='';lines=0;}}if(part)result.push(part);return result;}
const short=(v,n=110)=>text(v).length>n?text(v).slice(0,n-1).trimEnd()+'…':text(v);
function band(s,r,c1,c2,value,color=INK,size=11,bg){
 s.mergeCells(r,c1,r,c2);const c=s.getCell(r,c1);c.value=text(value);c.font={name:'Arial',size,color:{argb:color},bold:size>=14};c.alignment={vertical:'middle',wrapText:true};if(bg)c.fill=fill(bg);return c;
}
function base(wb,name,widths){
 const s=wb.addWorksheet(name,{properties:{tabColor:{argb:INK}},views:[{showGridLines:false}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.3,right:.3,top:.4,bottom:.4,header:.15,footer:.15}}});
 widths.forEach((v,i)=>s.getColumn(i+1).width=v);s.properties.defaultRowHeight=22;
 s.headerFooter.oddFooter='MedicareFAQ · Tentative content plan &RPage &P of &N';return s;
}
function link(cell,label,sheet,row){cell.value={text:label,hyperlink:`#'${sheet}'!A${row}`,tooltip:'Open assignment details'};cell.font={name:'Arial',size:10,color:{argb:INK},underline:true};}
function header(s,row,values){values.forEach((v,i)=>{const c=s.getCell(row,i+1);c.value=v;c.fill=fill(INK);c.font={name:'Arial',size:10,bold:true,color:{argb:'FFFFFF'}};c.alignment={wrapText:true,vertical:'middle'};});s.getRow(row).height=30;}

// A read-only snapshot: workbook changes are never written back to the dashboard.
export async function buildProposalWorkbook(plan){
 if(!plan?.payload?.items?.length)throw Error('No saved assignments to export.');
 const {default:ExcelJS}=await import('exceljs');
 const wb=new ExcelJS.Workbook();wb.creator='MedicareFAQ';wb.title='Tentative content plan | January–March 2027';
 const dates=plan.calendar?.dates||{},fixed=new Set(plan.calendar?.locked||[]);
 const items=[...plan.payload.items].sort((a,b)=>(dates[a.id]||'9999').localeCompare(dates[b.id]||'9999'));
 const overview=base(wb,'Overview',[4,27,17,17,4,27,20,20]);
 const months=MONTHS.map(m=>base(wb,m,[25,25,25,25,25,25,25]));
 const details=base(wb,'Assignment details',[8,15,24,54,13,13,29,42]);
 const briefs=base(wb,'Full details',[4,22,22,22,22,22,4]);
 const briefRows=new Map();let cursor=5;
 for(const [index,item] of items.entries()){
  briefRows.set(item.id,cursor);
  band(briefs,cursor,2,6,`${String(index+1).padStart(2,'0')}   ${item.title}`,INK,16,PALETTE[item.category]||PAPER);briefs.getRow(cursor).height=Math.max(48,Math.ceil(item.title.length/80)*22);
  band(briefs,cursor+1,2,6,`${dates[item.id]||'Unscheduled'}  ·  ${item.category}  ·  Tentative${fixed.has(item.id)?'  ·  Fixed date':''}`,MUTED);
  link(briefs.getCell(cursor+2,2),'Back to assignment list','Assignment details',index+6);cursor+=4;
  const fields=[['Final scope decision',item.scopePass?[item.scopePass.kind,item.scopePass.checkedAt,item.scopePass.reason,item.scopePass.originalQuestion?'Previous question: '+item.scopePass.originalQuestion:'',item.scopePass.receivingAssignmentId?'Question retained in assignment '+item.scopePass.receivingAssignmentId:''].filter(Boolean).join('\n'):'Not reviewed'],['Included AI questions',(item.scopeQuestions||[]).map(q=>[q.prompt,q.evidence.url,q.evidence.excerpt].join('\n')).join('\n\n')||'None'],['Focused target decision',item.targetDecision?[item.targetDecision.kind,item.targetDecision.checkedAt,item.targetDecision.reason,item.targetDecision.gap?.limitation,item.targetDecision.limitation,...(item.targetDecision.checks||[]).map(c=>[c.url,c.status,c.supported?'Topic supported':'No sufficient match',c.evidence?.excerpt].filter(Boolean).join(' — '))].filter(Boolean).join('\n'):'Not yet reviewed'],['Calendar repair history',(plan.payload.repairHistory||[]).flatMap(h=>h.changes.filter(c=>c.id===item.id).map(c=>[h.createdAt,h.undoneAt?'Undone':'Applied',c.reason,'Before: '+c.before.title+' — '+c.before.action+' — '+c.before.targetUrl,'After: '+c.after.title+' — '+c.after.action+' — '+c.after.targetUrl].join('\n'))).join('\n\n')||'No repair applied'],['Overlap and shared-page resolution',(item.overlapResolutions||[]).map(r=>[r.status,r.checkedAt,r.reason,r.next,...r.members.map(m=>m.title+' — '+m.action),...(r.checks||[]).map(c=>[c.url,c.status,c.proposedBoundary,(c.evidence||c.context)?.heading,(c.evidence||c.context)?.excerpt].filter(Boolean).join(' — '))].filter(Boolean).join('\n')).join('\n\n')||'No related pairs'],['Page-target resolution',item.targetResolution?[item.targetResolution.status,item.targetResolution.checkedAt,item.targetResolution.recommendation?.url,item.targetResolution.proposedWork,item.targetResolution.limitation,...(item.targetResolution.checks||[]).map(c=>[c.requested,c.status,c.evidence?.heading,c.evidence?.excerpt].filter(Boolean).join(' — '))].filter(Boolean).join('\n'):'Not checked live'],['Quality check',item.quality?item.quality.status+'\n'+item.quality.flags.map(f=>f.message).join('\n'):'Not checked'],['Related pages to inspect',item.quality?.candidates.map(p=>p.url).join('\n')||'None identified'],['Proposed work',item.action],['Assignment revision',item.revision?`${item.revision.kind}: ${item.revision.reason}\nPrevious assignment: ${item.revision.before.title}`:'Retained from saved plan'],['Paid-search research focus',item.paidSearch?.focus||'No matched paid-search evidence'],['Paid-search limitations',item.paidSearch?.methodology||'No paid-search import attached'],['Target page',item.targetUrl||(item.targetDecision?.kind==='New-page proposal'?'Tentative new page — URL not created':'Unconfirmed')],['Why this assignment',item.whyAssignment?.summary],['Evidence',item.whyAssignment?.facts?.join('\n')],['Evidence scope',item.whyAssignment?.sourceScope],['Target queries',item.terms?.join('\n')],['Your notes',item.notes||'—'],['Verify before implementation',item.verification],['How to measure',item.measure],['Original research title',item.originalTitle||item.title],['Opportunity basis',item.basis],['Assignment reference',item.id]];
  for(const [label,value] of fields){
   band(briefs,cursor,2,6,label,INK,11,PAPER);briefs.getCell(cursor,2).font.bold=true;cursor++;
   // Bounded text blocks avoid Excel's maximum row height, preserving all saved text.
   for(const chunk of chunks(text(value||'Unavailable'))){band(briefs,cursor,2,6,chunk,INK,11);briefs.getRow(cursor).height=Math.min(409,Math.max(30,chunk.split('\n').reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/100)),0)*16+12));cursor++;}
  }cursor+=2;
 }
 band(briefs,2,2,6,'Assignment research and notes',INK,18);band(briefs,3,2,6,'Complete saved text. All assignments remain tentative.',MUTED);briefs.pageSetup.printArea=`B1:F${cursor}`;
 band(details,2,1,8,'Assignment details',INK,18);band(details,3,1,8,'Filter by category, date or fixed status. Click a title for its complete research and notes.',MUTED);
 const headers=['No.','Planned date','Category','Assignment title','Status','Date fixed','Opportunity basis','Target page'];
 const rows=items.map((i,n)=>[n+1,date(dates[i.id])||'Unscheduled',i.category,i.title,'Tentative',fixed.has(i.id)?'Yes':'No',i.basis||'',i.targetUrl||(i.targetDecision?.kind==='New-page proposal'?'Tentative new page — URL not created':'Unconfirmed')]);
 details.addTable({name:'Assignments',ref:'A5',headerRow:true,style:{theme:'TableStyleMedium4',showRowStripes:true},columns:headers.map(name=>({name,filterButton:true})),rows});
 header(details,5,headers);details.views=[{state:'frozen',ySplit:5,xSplit:2,showGridLines:false}];details.pageSetup.printTitlesRow='1:5';
 items.forEach((i,n)=>{const r=details.getRow(n+6);r.height=Math.max(54,Math.ceil(i.title.length/48)*14+12,Math.ceil((i.targetUrl||'').length/37)*14+12);r.eachCell(c=>{c.font={name:'Arial',size:10,color:{argb:INK}};c.alignment={vertical:'top',wrapText:true};});r.getCell(2).numFmt='mmm d, yyyy';r.getCell(3).fill=fill(PALETTE[i.category]||PAPER);link(r.getCell(4),i.title,'Full details',briefRows.get(i.id));});details.pageSetup.printArea=`A1:H${items.length+5}`;
 months.forEach((s,m)=>{
  band(s,2,1,7,`${MONTHS[m]} 2027`,INK,20);s.getRow(2).height=34;
  band(s,3,1,7,'MEDICAREFAQ  /  CONTENT CALENDAR  /  ALL TENTATIVE',MUTED);
  const monthItems=items.filter(i=>dates[i.id]?.startsWith(`2027-0${m+1}-`));
  band(s,4,1,7,`${monthItems.length} assignments · Click any title for full details · Fixed dates are labeled`,MUTED);
  Object.entries(PALETTE).forEach(([name,color],j)=>{const c=s.getCell(6,j+1);c.value=name;c.fill=fill(color);c.font={name:'Arial',size:10,color:{argb:INK},bold:true};});
  header(s,8,['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']);
  const offset=new Date(Date.UTC(2027,m,1)).getUTCDay(),count=new Date(Date.UTC(2027,m+1,0)).getUTCDate(),weeks=Math.ceil((offset+count)/7);
  let cursor=9;
  for(let week=0;week<weeks;week++){
   const days=Array.from({length:7},(_,c)=>week*7+c+1-offset);
   const lists=days.map(day=>monthItems.filter(i=>dates[i.id]===`2027-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`));
   const slots=Math.max(1,...lists.map(x=>x.length)),r=cursor;cursor+=2+slots*2;s.getRow(r).height=23;s.getRow(cursor-1).height=9;
   for(let col=1;col<=7;col++){
    const day=days[col-1];if(day<1||day>count)continue;s.getCell(r,col).value=day;s.getCell(r,col).font={name:'Arial',bold:true,color:{argb:INK}};
    lists[col-1].forEach((item,n)=>{const row=r+1+n*2,color=PALETTE[item.category]||PAPER;s.getRow(row).height=82;s.getRow(row+1).height=25;
     for(const rr of [row,row+1]){const c=s.getCell(rr,col);c.fill=fill(color);c.alignment={wrapText:true,vertical:'top',indent:1};c.font={name:'Arial',size:10,color:{argb:INK}};}
     link(s.getCell(row,col),short(item.title),'Full details',briefRows.get(item.id));s.getCell(row+1,col).value=`${item.category}${fixed.has(item.id)?' · Fixed':''}`;
    });
    if(!lists[col-1].length)s.getCell(r+1,col).value='No assignment';
   }
  }
  s.pageSetup.printArea=`A1:G${cursor-1}`;s.pageSetup.fitToHeight=1;s.views=[{showGridLines:false,zoomScale:80}];
 });
 band(overview,2,2,8,'MedicareFAQ content plan',INK,20);overview.getRow(2).height=36;
 band(overview,3,2,8,'JANUARY–MARCH 2027  /  TENTATIVE CONTENT CALENDAR',MUTED);
 const scheduled=items.filter(i=>dates[i.id]),within=scheduled.filter(i=>dates[i.id]>='2027-01-01'&&dates[i.id]<='2027-03-31');
 band(overview,5,2,4,`${items.length} assignments`,INK,18,'E4EFD3');band(overview,5,6,8,`${scheduled.length} scheduled`,INK,18,'DDEEF8');overview.getRow(5).height=44;
 band(overview,6,2,4,`${items.length-scheduled.length} unscheduled`,MUTED);band(overview,6,6,8,`${items.filter(i=>fixed.has(i.id)).length} fixed dates`,MUTED);
 band(overview,8,2,8,'The quarter at a glance',INK,14);
 ['Category','Assignments','Share'].forEach((v,j)=>{overview.getCell(10,j+2).value=v;overview.getCell(10,j+2).font={name:'Arial',size:10,bold:true,color:{argb:INK}};});
 Object.entries(PALETTE).forEach(([name,color],j)=>{const r=j+11,n=items.filter(i=>i.category===name).length;overview.getCell(r,2).value=name;overview.getCell(r,2).fill=fill(color);overview.getCell(r,3).value=n;overview.getCell(r,4).value=n/items.length;overview.getCell(r,4).numFmt='0.0%';});
 MONTHS.forEach((name,m)=>{const r=10+m*2;link(overview.getCell(r,6),`${name} calendar`,name,1);overview.getCell(r,7).value=items.filter(i=>dates[i.id]?.startsWith(`2027-0${m+1}-`)).length;overview.getCell(r,8).value='assignments';});
 link(overview.getCell(16,2),'Open assignment details','Assignment details',1);link(overview.getCell(16,6),'Open full research and notes','Full details',1);
 band(overview,18,2,8,'Planning context',INK,14);
 band(overview,19,2,8,`All ${items.length} assignments are tentative. ${new Set(within.map(i=>dates[i.id])).size} of 90 quarter dates have assignments.${plan.paidSearch?' '+plan.paidSearch.matchedAssignments+' have paid-search matches.':''}`,INK);overview.getRow(19).height=32;
 band(overview,20,2,8,'This is a snapshot of saved edits and dates. Changes in Excel do not sync back to the dashboard.',MUTED);overview.getRow(20).height=32;
 if(plan.calendarReview){band(overview,21,2,8,'Calendar review: '+(plan.calendarReview.ready?'ready for tentative planning':'review items remain')+' · '+plan.calendarReview.flagged+' quality flags · '+plan.calendarReview.incomplete.length+' missing instructions · '+plan.calendarReview.noEvidence.length+' without evidence.',MUTED);overview.getRow(21).height=32;}
 band(overview,22,2,8,'Source dates and coverage',INK,14);let r=23;
 for(const [name,v] of Object.entries(plan.payload.sourceDates||{})){band(overview,r++,2,8,`${name.toUpperCase()}: ${v.period?`${v.period.start} – ${v.period.end}`:'Reporting dates unavailable'} · ${v.status||'unknown'}`,MUTED);}
 if(r===23)band(overview,r++,2,8,'Source dates unavailable in this saved plan.',MUTED);
 band(overview,r+1,2,8,'Evidence supports investigation; it does not prove a content gap or guarantee results. No articles are included or published.',MUTED);overview.getRow(r+1).height=32;
 if(plan.paidSearch){band(overview,r+2,2,8,`Paid source: ${plan.paidSearch.filename} · Combined account figures are not MedicareFAQ-only results.`,MUTED,10);overview.getRow(r+2).height=30;}
 band(overview,r+3,2,8,`Saved plan ${plan.id||'unknown'} · Version ${plan.version??'unknown'}`,MUTED,10);
 overview.pageSetup.printArea=`B1:H${r+3}`;overview.pageSetup.fitToHeight=1;
 for(const s of wb.worksheets)s.eachRow(row=>row.eachCell(c=>{if(!c.font?.name)c.font={name:'Arial',size:11,color:{argb:INK}};}));
 return wb;
}
export async function exportProposalXlsx(plan){const wb=await buildProposalWorkbook(plan);return wb.xlsx.writeBuffer();}
