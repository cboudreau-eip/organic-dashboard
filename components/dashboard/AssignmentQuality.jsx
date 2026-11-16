export default function AssignmentQuality({item}){
 if(!item.quality)return null;
 return <section aria-label="Assignment quality check"><h4>{item.quality.status}</h4>
 {item.quality.flags.length?<ul>{item.quality.flags.map((f,n)=><li key={n}>{f.message}</li>)}</ul>:<p>No duplication or page-targeting issue detected in the saved data. This is not publishing approval.</p>}
 {item.quality.candidates.length>0&&<details><summary>Related pages to inspect</summary><ul>{item.quality.candidates.map(p=><li key={p.url}><a href={p.url} target="_blank" rel="noreferrer">{p.title||p.url}</a></li>)}</ul><p>Suggested from saved titles and headings. Your target page has not been changed.</p></details>}
 </section>;
}
