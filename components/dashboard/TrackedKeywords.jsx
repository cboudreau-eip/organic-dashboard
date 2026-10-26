
'use client';
import CollapsibleSection from './CollapsibleSection';
import {useEffect,useMemo,useState} from 'react';
import {xlsxKeywordRows} from '../../lib/growth-hunter/files';
import {csvRows,parseSemrush,validateSnapshot,sameScope,compareSnapshots} from '../../lib/semrush/import';
import {BANDS,tokens,filterKeywords,groupPages} from '../../lib/semrush/opportunities';
import './tracked-keywords.css';
import {joinPages,pageFinding} from '../../lib/semrush/gsc-pages';
import PageSearchCells from './PageSearchCells';
const fmt=n=>n==null?'Unavailable':n.toLocaleString();
async function api(query='',init){
 const r=await fetch('/api/semrush/snapshots'+query,{cache:'no-store',...init});
 const data=await r.json();if(!r.ok)throw Error(data.error||'Keyword data is unavailable.');return data;
}

function KeywordPagination({page,pageSize,total,onPage,onSize,placement,noun='keywords'}){
 const [jump,setJump]=useState('');
 const pages=Math.max(1,Math.ceil(total/pageSize));
 const numbers=[...new Set([0,pages-1,...Array.from({length:5},(_,i)=>page+i-2).filter(n=>n>=0&&n<pages)])].sort((a,b)=>a-b);
 return <nav className="sem-pagination" aria-label={noun+' pagination '+placement}>
  <div className="sem-page-summary"><span aria-live="polite">{total? page*pageSize+1:0}–{Math.min((page+1)*pageSize,total)} of {total} {noun} · Page {page+1} of {pages}</span>
   <label>Rows per page<select value={pageSize} onChange={e=>{onSize(Number(e.target.value));setJump('');}}>{[25,50,100,250].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
  </div>
  <div className="sem-page-actions">
   <div className="sem-page-numbers">
    <button type="button" className="button" disabled={page===0} onClick={()=>onPage(page-1)} aria-label="Previous keyword page">Previous</button>
    {numbers.map((n,i)=><span className="sem-page-item" key={n}>{i>0&&n>numbers[i-1]+1&&<span className="sem-page-gap" aria-hidden="true">…</span>}<button type="button" className="button" aria-label={'Keyword page '+(n+1)} aria-current={n===page?'page':undefined} onClick={()=>onPage(n)}>{n+1}</button></span>)}
    <button type="button" className="button" disabled={page>=pages-1} onClick={()=>onPage(page+1)} aria-label="Next keyword page">Next</button>
   </div>
   <form className="sem-page-jump" onSubmit={e=>{e.preventDefault();const n=Number(jump);if(Number.isInteger(n)&&n>=1&&n<=pages){onPage(n-1);setJump('');}}}>
    <label>Go to page<input type="number" min="1" max={pages} step="1" required value={jump} placeholder={String(page+1)} onChange={e=>setJump(e.target.value)} /></label>
    <button type="submit" className="button" disabled={!total}>Go</button>
   </form>
  </div>
 </nav>;
}

export default function TrackedKeywords({searchData={status:'loading',result:null}}){
 const [attention,setAttention]=useState('all');
 const searchResult=searchData.result;
 const [history,setHistory]=useState([]),[offset,setOffset]=useState(0),[more,setMore]=useState(false),[role,setRole]=useState('');
 const [matrix,setMatrix]=useState(null),[report,setReport]=useState(null),[selected,setSelected]=useState(null),[prior,setPrior]=useState(null);
 const [scope,setScope]=useState({location:'',device:'',engine:'Google',confirmed:false});
 const [busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[filter,setFilter]=useState(''),[sort,setSort]=useState('position'),[page,setPage]=useState(0);
 async function historyPage(next=0){const d=await api('?offset='+next);setHistory(d.snapshots);setRole(d.role);setMore(d.hasMore);setOffset(next);}
 useEffect(()=>{
  let active=true;
  async function restore(){
   try{
    const d=await api();if(!active)return;
    setHistory(d.snapshots);setRole(d.role);setMore(d.hasMore);
    const latest=d.snapshots[0];
    if(latest){
     const saved=await api('?id='+encodeURIComponent(latest.id));if(!active)return;
     setSelected(saved.snapshot);
     setScope({...saved.snapshot.payload.scope,confirmed:false});
     setNotice('Your latest saved report has been restored.');
    }
   }catch(e){if(active)setError(e.message);}
   finally{if(active)setBusy(false);}
  }
  restore();return()=>{active=false};
 },[]);
 useEffect(()=>{
  if(!matrix)return;
  const warn=event=>{event.preventDefault();event.returnValue='';};
  window.addEventListener('beforeunload',warn);
  return()=>window.removeEventListener('beforeunload',warn);
 },[matrix]);
 const [pageSize,setPageSize]=useState(50);
 const [view,setView]=useState('keywords'),[band,setBand]=useState('all'),[intent,setIntent]=useState(''),[tag,setTag]=useState(''),[minVolume,setMinVolume]=useState(''),[maxVolume,setMaxVolume]=useState(''),[landing,setLanding]=useState(null),[pageSort,setPageSort]=useState('opportunities');
 function resetFilters(){setAttention('all');setFilter('');setBand('all');setIntent('');setTag('');setMinVolume('');setMaxVolume('');setLanding(null);setPage(0);}
 function changeFilter(setter,value){setter(value);setPage(0);}

 const canSave=['analyst','admin'].includes(role);
 const current=selected?.payload||report;
 async function file(event){
  const upload=event.target.files?.[0];setLanding(null);setError('');setNotice('');setMatrix(null);setReport(null);setSelected(null);setPrior(null);setSort('position');setPage(0);setScope(s=>({...s,confirmed:false}));
  if(!upload)return;setBusy(true);
  try{
   if(upload.size>5_000_000)throw Error('Choose a file under 5 MB.');
   const rows=upload.name.toLowerCase().endsWith('.xlsx')?await xlsxKeywordRows(await upload.arrayBuffer()):upload.name.toLowerCase().endsWith('.csv')?csvRows(await upload.text()):null;
   if(!rows)throw Error('Choose an .xlsx or .csv export.');
   const parsed=parseSemrush(rows);setMatrix(rows);setReport(parsed);setNotice('Not saved yet. Check the campaign settings, then click Save report to keep these keywords after refresh.');
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function save(){
  setError('');setNotice('');setBusy(true);
  try{
   const input={report:{matrix},scope};validateSnapshot(input);
   const d=await api('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
   if(d.snapshot){setSelected(d.snapshot);setMatrix(null);setReport(null);setNotice('Saved to the dashboard. This report will reopen automatically after refresh.');}
   else setNotice(d.message);
   await historyPage();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function open(id,baseline=false){
  setBusy(true);setError('');
  try{const d=await api('?id='+encodeURIComponent(id));
   if(baseline){compareSnapshots(current,d.snapshot.payload);setPrior(d.snapshot);}
   else{setLanding(null);setSelected(d.snapshot);setMatrix(null);setReport(null);setPrior(null);setSort('position');setPage(0);setScope({...d.snapshot.payload.scope,confirmed:false});setNotice('Opened saved report.');}
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const compared=useMemo(()=>current&&prior?compareSnapshots(current,prior.payload):null,[current,prior]);
 const rows=useMemo(()=>{
  const list=filterKeywords(compared||current?.rows||[],{search:filter,band,intent,tag,minVolume,maxVolume,landing});
  return [...list].sort((a,b)=>sort==='volume'?(b.volume??-1)-(a.volume??-1):sort==='change'?(b.change??-Infinity)-(a.change??-Infinity):(a.position??Infinity)-(b.position??Infinity));
 },[compared,current,filter,sort,band,intent,tag,minVolume,maxVolume,landing]);
 const tagOptions=useMemo(()=>[...new Set((current?.rows||[]).flatMap(r=>tokens(r.tags)))].sort((a,b)=>a.localeCompare(b)),[current]);
 const pages=useMemo(()=>{
  let groups=joinPages(groupPages(rows),searchResult?.comparisons?.pages);
  if(searchData.status==='ready'&&attention!=='all')groups=groups.filter(g=>pageFinding(g).type===attention);
  if(pageSort==='clicks')groups.sort((a,b)=>(b.gsc?.current?.clicks??-1)-(a.gsc?.current?.clicks??-1));
  if(pageSort==='loss')groups.sort((a,b)=>(a.gsc?.clicksChange??Infinity)-(b.gsc?.clicksChange??Infinity));
  if(pageSort==='volume')groups.sort((a,b)=>(b.volume??-1)-(a.volume??-1)||b.count-a.count);
  if(pageSort==='count')groups.sort((a,b)=>b.count-a.count||a.url.localeCompare(b.url));
  return groups;
 },[rows,pageSort,searchResult,searchData.status,attention]);
 const total=view==='pages'?pages.length:rows.length;
 const activePage=Math.min(page,Math.max(0,Math.ceil(total/pageSize)-1));
 const paginationProps={page:activePage,pageSize,total,noun:view==='pages'?'URL groups':'keywords',onPage:setPage,onSize:size=>{setPageSize(size);setPage(0);}};
 const candidates=selected?history.filter(s=>s.summary.end<current.end&&sameScope(current,{...s.summary,domain:'medicarefaq.com'})):[];
 const priorOnly=useMemo(()=>{if(!current||!prior)return 0;const keys=new Set(current.rows.map(r=>r.keyword.toLowerCase()));return prior.payload.rows.filter(r=>!keys.has(r.keyword.toLowerCase())).length;},[current,prior]);
 return <CollapsibleSection className="card tracked-keywords" aria-labelledby="tracked-title" title="Tracked keywords" level={2} header={<div className="organic-heading"><div><span className="organic-badge">SEMRUSH · IMPORTED SNAPSHOTS</span><h2 id="tracked-title">Tracked keywords</h2><p>Your monitored keywords, ranking pages and saved comparisons.</p></div></div>}>
  
  <p>This is a manual import, not a live Semrush connection. Snapshot access uses your Growth Hunter team permissions.</p>
  {busy&&!current&&<p role="status">Loading your saved keyword data…</p>}
  {error&&<p role="alert" className="organic-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <details open={!selected} className="sem-import"><summary>Import a Position Tracking export</summary>
   <p>Use the unfiltered MedicareFAQ Rankings Overview export. Excel is supported. Keep its report metadata and headers unchanged.</p>
   <fieldset disabled={busy||!canSave}><legend>Report and campaign settings</legend>
    <label>Excel or CSV file<input type="file" accept=".xlsx,.csv" onChange={file}/></label>
    <label>Campaign location<input maxLength={120} placeholder="Exactly as shown in Semrush" value={scope.location} onChange={e=>setScope({...scope,location:e.target.value,confirmed:false})}/></label>
    <label>Device<select value={scope.device} onChange={e=>setScope({...scope,device:e.target.value,confirmed:false})}><option value="">Select device</option><option value="desktop">Desktop</option><option value="mobile">Mobile</option><option value="tablet">Tablet</option></select></label>
    <label>Search engine<select value={scope.engine} onChange={e=>setScope({...scope,engine:e.target.value,confirmed:false})}>{['Google','Bing','Baidu'].map(v=><option key={v}>{v}</option>)}</select></label>
    <label className="sem-confirm"><input type="checkbox" checked={scope.confirmed} onChange={e=>setScope({...scope,confirmed:e.target.checked})}/>I confirmed these campaign settings and cleared all keyword filters before exporting.</label>
    <button className="button primary" onClick={save} disabled={!matrix||!scope.confirmed||!scope.location||!scope.device}>{busy?'Saving / loading…':'Save report'}</button>
   </fieldset>
   {!canSave&&<p>An authorized analyst can save imports. If access is unavailable, use Reload history below.</p>}
  </details>
  <CollapsibleSection className="sem-history" title="Saved keyword snapshots" level={3} header={<h3>Saved snapshots</h3>}><button className="button" disabled={busy} onClick={()=>{setBusy(true);historyPage(offset).catch(e=>setError(e.message)).finally(()=>setBusy(false))}}>Reload history</button>
   {!history.length?<p>No snapshots on this history page.</p>:<ul>{history.map(s=><li key={s.id}><span><strong>{s.summary.end}</strong> · {s.summary.count} keywords · Campaign {s.summary.campaignId} · {s.summary.scope.location} · {s.summary.scope.device} · {s.summary.scope.engine}<small>Imported {new Date(s.created_at).toLocaleString()}</small></span><button className="button" disabled={busy} onClick={()=>open(s.id)}>Open</button></li>)}</ul>}
   <button className="button" disabled={busy||offset===0} onClick={()=>{setBusy(true);historyPage(Math.max(0,offset-50)).catch(e=>setError(e.message)).finally(()=>setBusy(false))}}>Newer snapshots</button>{' '}
   <button className="button" disabled={busy||!more} onClick={()=>{setBusy(true);historyPage(offset+50).catch(e=>setError(e.message)).finally(()=>setBusy(false))}}>Older snapshots</button>
  </CollapsibleSection>
  {current&&<>
   <h3>{selected?'Saved report':'Unsaved import preview'} · {current.end}</h3>
   <p role="status">{selected?'Saved in the dashboard. Available after refresh and on your next visit.':'This preview has not been saved. Use Save report above to keep it.'}</p>
   <p>Campaign {current.campaignId} · Report period {current.start} to {current.end} · {current.rows.length} keywords{current.scope&&' · '+current.scope.location+' · '+current.scope.device+' · '+current.scope.engine}</p>
   <div className="sem-stats"><div><span>Tracked keywords</span><strong>{current.rows.length}</strong></div><div><span>Reported positions 1–10</span><strong>{current.rows.filter(r=>r.position!=null&&r.position<=10).length}</strong></div><div><span>Rank unavailable / outside supported range</span><strong>{current.rows.filter(r=>r.position==null).length}</strong></div></div>
   {selected&&<label>Compare with an earlier snapshot on this history page<select disabled={busy} value={prior?.id||''} onChange={e=>{setPage(0);if(e.target.value)open(e.target.value,true);else {setPrior(null);setSort('position');}}}><option value="">No comparison</option>{candidates.map(s=><option key={s.id} value={s.id}>{s.summary.end} · imported {new Date(s.created_at).toLocaleString()} · {s.id.slice(0,8)}</option>)}</select></label>}
   {prior&&<p>Compared with {prior.payload.end}. Positive position change means improvement. {priorOnly} keywords appear only in the earlier export; they are not treated as lost rankings.</p>}

   <div className="sem-view-switch" role="group" aria-label="Results view">
    <button type="button" className="button" aria-pressed={view==='keywords'} onClick={()=>{setView('keywords');setPage(0);}}>Keywords</button>
    <button type="button" className="button" aria-pressed={view==='pages'} onClick={()=>{setView('pages');setPage(0);}}>Page opportunities</button>
   </div>
   <div className="sem-opportunity-filters">
    <label>Search keywords or URLs<input value={filter} onChange={e=>changeFilter(setFilter,e.target.value)}/></label>
    <label>Position range<select value={band} onChange={e=>changeFilter(setBand,e.target.value)}>{BANDS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
    <label>Search intent<select value={intent} onChange={e=>changeFilter(setIntent,e.target.value)}><option value="">All intents</option>{['informational','navigational','commercial','transactional'].map(v=><option key={v} value={v}>{v[0].toUpperCase()+v.slice(1)}</option>)}</select></label>
    <label>Tag<select value={tag} onChange={e=>changeFilter(setTag,e.target.value)}><option value="">All tags</option>{tagOptions.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
    <label>Minimum search volume<input type="number" min="0" step="1" placeholder="Any" value={minVolume} onChange={e=>changeFilter(setMinVolume,e.target.value)}/></label>
    <label>Maximum search volume<input type="number" min="0" step="1" placeholder="Any" value={maxVolume} onChange={e=>changeFilter(setMaxVolume,e.target.value)}/></label>
    {view==='keywords'?<label>Sort keywords<select value={sort} onChange={e=>changeFilter(setSort,e.target.value)}><option value="position">Best position</option><option value="volume">Highest search volume</option>{prior&&<option value="change">Largest improvement</option>}</select></label>:<label>Sort pages<select value={pageSort} onChange={e=>changeFilter(setPageSort,e.target.value)}><option value="opportunities">Most keywords in positions 4–20</option><option value="clicks">Most GSC clicks</option><option value="loss">Largest GSC click loss</option><option value="count">Most matching keywords</option><option value="volume">Highest summed keyword volume</option></select></label>}
    {view==='pages'&&<label>Needs attention<select value={attention} disabled={searchData.status!=='ready'} onChange={e=>changeFilter(setAttention,e.target.value)}><option value="all">All pages</option><option value="decline">Losing clicks</option><option value="near">Close to top 10</option><option value="ctr">Investigate CTR</option><option value="unmatched">Missing / ambiguous GSC match</option><option value="monitor">Monitor</option></select></label>}
    <button type="button" className="button" onClick={resetFilters}>Clear filters</button>
   </div>
   {minVolume!==''&&maxVolume!==''&&Number(minVolume)>Number(maxVolume)&&<p role="alert">Minimum volume must not exceed maximum volume.</p>}
   {landing!==null&&<p className="sem-page-focus">Showing keywords for <strong>{landing||'No reported URL'}</strong> <button type="button" className="button" onClick={()=>{setLanding(null);setPage(0);}}>Clear URL filter</button></p>}
   <p role="status">{rows.length} of {current.rows.length} keywords match · {pages.length} URL groups. All filters apply together.</p>
   {view==='pages'&&<p>Groups use the exact ranking URL reported by Semrush. Counts reflect matching keywords only. GSC metrics describe the entire page, not only these filtered tracked keywords. Summed keyword volume can overlap across searches and is not measured traffic or lead potential.</p>}
   {view==='pages'&&<div className="sem-gsc-context" role="status">
    <strong>Semrush snapshot: {current.end}</strong>
    {searchResult?<><p><strong>GSC: {searchResult.period.start} to {searchResult.period.end}</strong> · Comparison: {searchResult.period.priorStart} to {searchResult.period.priorEnd} · Pacific time. Change these dates in Search performance above.</p>
    {(current.end<searchResult.period.start||current.end>searchResult.period.end)&&<p className="gsc-date-warning">The Semrush snapshot falls outside the selected GSC period. Rankings and traffic cover different dates.</p>}
    <p>{pages.filter(g=>g.gsc?.current).length} of {pages.length} displayed URL groups have a current GSC match. GSC returns up to {searchResult.coverage.limit.toLocaleString()} pages per period; missing rows are not zero traffic.</p></>:<p>{searchData.status==='error'?'GSC unavailable. Retry in Search performance above.':'Loading GSC for the selected dates…'}</p>}
    <p>GSC covers all countries and devices. Semrush uses {current.scope?current.scope.location+' / '+current.scope.device+' / '+current.scope.engine:'the campaign settings in this import'}. Rankings are snapshot observations, not period averages.</p>
    <details><summary>Matching and recommendation rules</summary><p>URLs match conservatively with fragments removed. Protocol, www, path case, trailing slashes and query parameters remain distinct; redirects are not inferred. Ambiguous matches are withheld. Findings use the first applicable rule: click loss, keywords at positions 11–20, then a CTR screen (at least 1,000 impressions, CTR below 1%, average GSC position 10 or better). These are investigation prompts, not proven causes or lead forecasts. Keyword filters affect ranking counts, not whole-page GSC metrics.</p></details>
   </div>}
   <KeywordPagination {...paginationProps} placement="above table" />
   {view==='keywords'?<div className="organic-table-scroll" role="region" aria-label="Tracked keyword results" tabIndex={0}><table><thead><tr>{['Keyword','Position','Prior position','Observed change','Ranking URL','Tags / intent','Search volume','Difficulty','CPC (source)','Source difference'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.slice(activePage*pageSize,(activePage+1)*pageSize).map(r=><tr key={r.keyword}><th scope="row">{r.keyword}</th><td>{r.position??'Unavailable'}{r.position==null&&<small>Source: {r.rawPosition||'blank'}</small>}</td><td>{prior?fmt(r.priorPosition):'No comparison'}</td><td>{prior?(r.change==null?r.comparison:(r.change>0?'+':'')+r.change):'No comparison'}</td><td>{r.landing?<a href={r.landing} target="_blank" rel="noreferrer">{r.landing}</a>:'Unavailable'}<small>{r.resultType}</small></td><td>{r.tags||'No tags'}<small>{r.intents||'No intent'}</small></td><td>{fmt(r.volume)}</td><td>{fmt(r.difficulty)}</td><td>{fmt(r.cpc)}</td><td>{r.sourceDifference||'Unavailable'}</td></tr>)}</tbody></table></div>:<div className="organic-table-scroll" role="region" aria-label="Page opportunities" tabIndex={0}><table><thead><tr>{['Ranking page','GSC clicks / prior','Click change','Impressions / change','CTR / change','Finding / next step','Matching keywords','Positions 1–3','Positions 4–10','Positions 11–20','Positions 21–50','Commercial / transactional','Best position','Summed keyword volume','Inspect'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{pages.slice(activePage*pageSize,(activePage+1)*pageSize).map(g=><tr key={g.url}><th scope="row">{g.url?<a href={g.url} target="_blank" rel="noreferrer">{g.url}</a>:'No reported URL'}{g.unknown>0&&<small>{g.unknown} ranks unavailable / outside 1–100</small>}</th><PageSearchCells group={g} status={searchData.status}/><td>{g.count}</td><td>{g.top3}</td><td><strong>{g.nearTop}</strong></td><td><strong>{g.pageTwo}</strong></td><td>{g.develop}</td><td>{g.commercial}</td><td>{fmt(g.best)}</td><td>{fmt(g.volume)}<small>Known for {g.knownVolume} of {g.count} keywords</small></td><td><button type="button" className="button" onClick={()=>{setLanding(g.url);setView('keywords');setPage(0);}}>View keywords</button></td></tr>)}</tbody></table></div>}
   {!total&&<p>No matching {view==='pages'?'pages':'keywords'}. Try clearing filters.</p>}
   <KeywordPagination {...paginationProps} placement="below table" />
   <details><summary>Definitions and import limits</summary><p>Positions are observations on the report date, not weekly averages. Only positions 1–100 are shown as numeric ranks; other supported source markers are preserved without inventing a position. Source difference is retained exactly as exported; its direction is not used to reconstruct earlier ranks. Share-of-voice values are preserved in the saved data but not interpreted until their units are verified. Search volume, CPC and difficulty are Semrush metrics, not measured website traffic, costs or leads. CPC currency is not supplied by this export. Comparisons require the same campaign, location, device and search engine. Missing keywords do not establish a ranking loss. Up to 5,000 rows; weekly automation and Growth Hunter task creation are not included in this first release.</p></details>
  </>}
 </CollapsibleSection>;
}
