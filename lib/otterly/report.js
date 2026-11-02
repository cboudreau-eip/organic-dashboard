export const REPORT_ID = '01KVG7BNGPHG2M0RD4T9D9EVA3';
export const WORKSPACE_ID = '01KVG663108Q1YK3G12YESDHEN';
export const REPORT_URL = `https://app.otterly.ai/ws/${WORKSPACE_ID}/reports/${REPORT_ID}`;
export const ENGINES = {chatgpt:'ChatGPT',google:'Google AI Overviews',perplexity:'Perplexity',copilot:'Copilot',google_ai_mode:'Google AI Mode',gemini:'Gemini',claude:'Claude'};
const day = 86400000;
export function reportPeriod(now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const end = Date.parse(today+'T00:00:00Z')-day;
  return {start:new Date(end-29*day).toISOString().slice(0,10),end:new Date(end).toISOString().slice(0,10)};
}
export function ownUrl(value) {
  try { const u=new URL(value); return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!u.port&&['medicarefaq.com','www.medicarefaq.com'].includes(u.hostname) ? u.href : null; } catch { return null; }
}
export function ownDomain(value) {return typeof value==='string'&&['medicarefaq.com','www.medicarefaq.com'].includes(value.toLowerCase());}
const num = v => typeof v==='number'&&Number.isFinite(v)?v:null;
export function validateReport(meta) {
  if(meta?.id!==REPORT_ID||meta.workspaceId!==WORKSPACE_ID||!ownDomain(meta.brandDomain)||meta.brand?.toLowerCase()!=='medicarefaq'||meta.brandDomainWildcard||meta.brandDomainVariations?.some(d=>!ownDomain(d))) throw Error('Otterly report scope does not match MedicareFAQ.com.');
}
export function normalizeStats(stats) {
  if(stats?.id!==REPORT_ID||!ownDomain(stats.brand?.brandDomain)||stats.brand?.brand?.toLowerCase()!=='medicarefaq'||stats.status!=='finished'||stats.isRecalculating===true||!stats.summary) throw Error('Otterly report is unavailable or recalculating.');
  const main=(stats.competitorBrandsAnalysis?.brandMentions||[]).filter(r=>r.isMainBrand===true);
  if(main.length>1||main.some(r=>r.brand?.toLowerCase()!=='medicarefaq'))throw Error('Unexpected main brand in Otterly report.');
  const s=main[0];
  // The API summary aggregates brands. Only the explicitly marked main-brand row is ours.
  return {totalPrompts:num(stats.totalPrompts),mentions:num(s?.mentions),coverage:num(s?.brandCoverage),position:num(s?.averagePosition),
    // Use the configured-competitor analysis consistently; never mix its denominator with all detected brands.
    competitors:(stats.competitorBrandsAnalysis?.brandMentions||[]).map(r=>({brand:r.brand,main:r.isMainBrand===true,mentions:num(r.mentions),coverage:num(r.brandCoverage),shareOfVoice:num(r.shareOfVoice)})),
    history:(stats.competitorBrandsAnalysis?.brandCoverageHistory||[]).map(r=>({date:r.date,coverage:num(r.brands?.find(b=>b.isMainBrand)?.coverage)}))};
}
export function normalizeReport({meta,stats,citations,prompts,engines,period},now=new Date()) {
  validateReport(meta);
  const summary=normalizeStats(stats);
  const pages=citations.map(r=>({...r,url:ownUrl(r.url)})).filter(r=>r.url).map(r=>({url:r.url,title:String(r.title||''),citations:num(r.citations)})).sort((a,b)=>(b.citations??-1)-(a.citations??-1));
  if(new Set(pages.map(r=>r.url)).size!==pages.length)throw Error('Duplicate citation pages require review.');
  const rows=prompts.map(r=>({id:r.id,prompt:r.prompt,mentions:num(r.brandMentions),domainMentions:num(r.domainMentions),competitors:(r.competitors||[]).filter(c=>num(c.brandMentions)>0).map(c=>({brand:c.brand,mentions:num(c.brandMentions)}))}));
  if(prompts.some(r=>r.country!=='us')||new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Unexpected prompt scope.');
  return {version:1,reportId:REPORT_ID,workspaceId:WORKSPACE_ID,domain:'medicarefaq.com',country:'us',period,fetchedAt:now.toISOString(),sourceCreatedAt:meta.createdDate,summary,pages,prompts:rows,engines};
}
