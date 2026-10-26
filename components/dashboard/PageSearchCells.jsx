'use client';
import {pageFinding} from '../../lib/semrush/gsc-pages';
const number=n=>n==null?'Not reported':n.toLocaleString();
const signed=n=>n==null?'Not comparable':(n>0?'+':'')+n.toLocaleString();
export default function PageSearchCells({group,status}){
 const data=group.gsc, finding=pageFinding(group);
 if(status!=='ready')return <><td colSpan={4}>{status==='error'?'GSC unavailable. Retry in Search performance above.':'Loading GSC for the selected dates…'}</td><td>Waiting for GSC</td></>;
 return <>
  <td><strong>{number(data?.current?.clicks)}</strong><small>Prior: {number(data?.previous?.clicks)}</small></td>
  <td><strong className={data?.clicksChange<0?'sem-loss':data?.clicksChange>0?'sem-gain':undefined}>{signed(data?.clicksChange)}</strong><small>{data?.clicksPercent==null?'Percent unavailable':signed(Number(data.clicksPercent.toFixed(1)))+'%'}</small></td>
  <td>{number(data?.current?.impressions)}<small>Change: {signed(data?.impressionsChange)}</small></td>
  <td>{data?.current?.ctr==null?'Not reported':(data.current.ctr*100).toFixed(2)+'%'}<small>{data?.ctrChange==null?'Change not comparable':signed(Number(data.ctrChange.toFixed(2)))+' pp'}</small></td>
  <td className="sem-finding"><strong>{finding.label}</strong><small>{finding.type==='near'?group.pageTwo+' matching keywords at positions 11–20. ':finding.type==='ctr'?'Screen: ≥1,000 impressions, CTR <1%, average position ≤10. ':''}{finding.action}</small></td>
 </>;
}
