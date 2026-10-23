'use client';
import { useMemo, useState } from 'react';
import CollapsibleSection from './CollapsibleSection';
import { displayMetric } from '../../lib/gsc/report';
import { paginateRows, selectRows, tableValue } from '../../lib/gsc/comparison';

const columns = [
  ['key','Name','text'], ['current.clicks','Clicks','clicks'], ['previous.clicks','Prior clicks','clicks'],
  ['clicksChange','Click change','delta'], ['clicksPercent','Click change %','percent'],
  ['current.impressions','Impressions','impressions'], ['impressionsChange','Impression change','delta'],
  ['current.ctr','CTR','ctr'], ['ctrChange','CTR change','pp'],
  ['current.position','Position','position'], ['positionChange','Position improvement','positionDelta']
];
function formatted(value, type) {
  if (value == null) return 'Not reported';
  if (['delta','percent','pp','positionDelta'].includes(type)) {
    const digits = type === 'delta' ? 0 : type === 'pp' ? 2 : 1;
    return (value > 0 ? '+' : '') + value.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}) +
      (type === 'percent' ? '%' : type === 'pp' ? ' pp' : '');
  }
  return displayMetric(value,type);
}
export default function GscComparisonTable({title,dimension,rows,coverage,limit,period}) {
  const [search,setSearch] = useState('');
  const [filter,setFilter] = useState('all');
  const [sort,setSort] = useState('current.clicks');
  const [direction,setDirection] = useState('desc');
  const [size,setSize] = useState(25);
  const [page,setPage] = useState(1);
  const [jump,setJump] = useState('');
  const selected = useMemo(() => selectRows(rows,{search,filter,sort,direction}),[rows,search,filter,sort,direction]);
  const view = paginateRows(selected,page,size);
  const pages = [...new Set([1,view.pages,...Array.from({length:5},(_,i)=>view.page+i-2).filter(n=>n>=1&&n<=view.pages)])].sort((a,b)=>a-b);
  const changeFilter = value => {setFilter(value);setPage(1);};
  function changeSort(key) {
    setDirection(sort === key ? direction === 'desc' ? 'asc' : 'desc' : key === 'key' ? 'asc' : 'desc');
    setSort(key);setPage(1);
  }
  return <CollapsibleSection className="card gsc-table gsc-comparison" title={title} level={3} header={<h3>{title}</h3>}>
    <p className="gsc-comparison-period"><strong>{period.start} to {period.end}</strong> compared with {period.priorStart} to {period.priorEnd} · Pacific time</p>
    <div className="gsc-table-controls">
      <label>Search {dimension.toLowerCase()}<input type="search" value={search} placeholder={dimension === 'Page' ? 'Find a URL…' : 'Find a keyword…'} onChange={e=>{setSearch(e.target.value);setPage(1);}} /></label>
      <div className="gsc-quick-filters" role="group" aria-label={dimension+' performance filter'}>
        {[['all','All'],['gainers','Gainers'],['losers','Losers'],['unmatched','One period only']].map(([value,label])=><button type="button" key={value} className="button" aria-pressed={filter===value} onClick={()=>changeFilter(value)}>{label}</button>)}
      </div>
      <label>Rows per page<select value={size} onChange={e=>{setSize(Number(e.target.value));setPage(1);}}>{[25,50,100,250].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
      <button type="button" className="button" onClick={()=>{setSearch('');setFilter('all');setSort('current.clicks');setDirection('desc');setPage(1);setJump('');}}>Reset table</button>
    </div>
    <p className="gsc-coverage">Loaded {coverage.current.toLocaleString()} current and {coverage.previous.toLocaleString()} prior rows; {rows.length.toLocaleString()} distinct {dimension === 'Page' ? 'pages' : 'queries'} across both periods. Up to {limit.toLocaleString()} per period, ordered by clicks by Google.
      {(coverage.current>=limit||coverage.previous>=limit)&&<strong> Row limit reached: this is a partial view.</strong>}
      {' '}Search and filters apply to loaded rows only. Google may omit rows, including private queries; these are not complete site totals.
    </p>
    <p className="gsc-comparison-help">Gainers and Losers use click change for rows reported in both periods. “One period only” includes rows missing from either period, without assuming zero. Positive position improvement means a better ranking. CTR change is in percentage points (pp).</p>
    <div className="organic-table-scroll" tabIndex={0} role="region" aria-label={title+' comparison table'}>
      <table><thead><tr>{columns.map(([key,label])=><th scope="col" key={key} aria-sort={sort===key?(direction==='asc'?'ascending':'descending'):'none'}><button type="button" onClick={()=>changeSort(key)}>{key==='key'?dimension:label}{sort===key?(direction==='asc'?' ↑':' ↓'):''}</button></th>)}</tr></thead>
      <tbody>{view.rows.map(row=><tr key={row.key}>{columns.map(([key,,type])=>{
        const value=tableValue(row,key);
        if(key==='key') return <th scope="row" key={key}>{row.key}{(!row.current||!row.previous)&&<small>{row.current?'Current period only':'Previous period only'}</small>}</th>;
        const delta=['delta','percent','pp','positionDelta'].includes(type);
        let label=formatted(value,type);
        if(key==='clicksPercent'&&value==null&&row.current&&row.previous) label=row.current.clicks>0?'No prior clicks':'No change';
        return <td key={key}><span className={delta&&value!=null?'gsc-change '+(value>0?'gain':value<0?'loss':'flat'):undefined}>{label}</span></td>;
      })}</tr>)}</tbody></table>
    </div>
    {!selected.length&&<p role="status">No {dimension.toLowerCase()} rows match these filters.</p>}
    <div className="gsc-pagination">
      <span role="status">{selected.length ? ((view.page-1)*size+1).toLocaleString()+'–'+Math.min(view.page*size,selected.length).toLocaleString() : '0'} of {selected.length.toLocaleString()} matching rows · Page {view.page} of {view.pages}</span>
      <nav aria-label={dimension+' table pages'}>
        <button type="button" className="button" disabled={view.page===1} onClick={()=>setPage(view.page-1)}>Previous</button>
        {pages.map((n,i)=><span key={n}>{i>0&&n>pages[i-1]+1&&<span className="gsc-page-gap">…</span>}<button type="button" className="button" aria-label={'Page '+n} aria-current={n===view.page?'page':undefined} onClick={()=>setPage(n)}>{n}</button></span>)}
        <button type="button" className="button" disabled={view.page===view.pages} onClick={()=>setPage(view.page+1)}>Next</button>
      </nav>
      <form onSubmit={e=>{e.preventDefault();if(jump!==''){setPage(Math.max(1,Math.min(view.pages,Number(jump))));setJump('');}}}>
        <label>Go to page<input type="number" min={1} max={view.pages} step={1} value={jump} onChange={e=>setJump(e.target.value)} /></label>
        <button type="submit" className="button">Go</button>
      </form>
    </div>
  </CollapsibleSection>;
}
