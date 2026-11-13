import {createHash} from 'node:crypto';
const stop=new Set('a an the is are do does i my me you your how what which can should to for of in on with and or at by from'.split(' '));
export function tokens(value){return [...new Set(String(value).toLowerCase().replace(/medicare supplement(?:al)?/g,'medigap').replace(/supplemental insurance/g,'medigap').replace(/companies/g,'company').replace(/quotes/g,'quote').replace(/plans/g,'plan').match(/[a-z0-9]+/g)?.filter(s=>!stop.has(s))||[])];}
export const hash=value=>createHash('sha256').update(value).digest('hex').slice(0,24);
// Keep the original key available so unchanged groups retain their saved reviews.
export const topicKey=text=>hash(tokens(text).sort().join(' '));
const carriers=['aetna','anthem','cigna','humana','lumico','usaa','mutual of omaha','unitedhealthcare','aarp','wellcare','bcbs'];
const states='alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming'.split('|');
export function normalizedTopic(text){
 let value=String(text).toLowerCase().replace(/\bmedicare supplement(?:al)?(?: insurance)?\b/g,'medigap').replace(/\bmedigap insurance\b/g,'medigap').replace(/\bplans\b/g,'plan').replace(/\bblue cross(?: blue shield)?\b/g,'bcbs');
 // Anthem's brand remains distinct from the broader BCBS family.
 value=value.replace(/\banthem bcbs\b/g,'anthem');
 value=value.replace(/\bversus\b/g,'vs').replace(/\b(plan [a-n]) vs ([a-n])\b/g,'$1 vs plan $2');
 if(/\bplan [fgn]\b/.test(value)&&!/\bmedigap\b|advantage|part [abcd]/.test(value))value=value.replace(/\bmedicare\b/g,'')+' medigap';
 // Remove the generic word "plan", but preserve all specific plan letters.
 if(/\bmedigap\b/.test(value))value=value.replace(/\bplan\b(?!\s+[a-n]\b)/g,'');
 value=value.replace(/\bnh\b/g,'new hampshire');
 return value.replace(/\s+/g,' ').trim();
}
export function groupingKey(text){
 const normalized=normalizedTopic(text);
 // Reverse comparison order is equivalent; reverse switching direction is not.
 return /\b(from|to)\b/.test(normalized)&&/\b(switch|switching|change|changing)\b/.test(normalized)?hash('ordered:'+normalized):topicKey(normalized);
}
export function productFor(text){return /\b(part d|prescription|drug|pharmacy)\b/i.test(text)?'Part D':/\b(advantage|mapd|hmo|ppo)\b/i.test(text)&&!/medigap|supplement/i.test(text)?'Medicare Advantage':/medigap|supplement|plan [fgndklm]\b/i.test(text)?'Medigap':'General Medicare';}
export function entities(text){
 const value=normalizedTopic(text);
 return {carriers:carriers.filter(c=>value.includes(c)),states:states.filter(s=>new RegExp('\\b'+s+'\\b').test(value)),plans:[...new Set([...value.matchAll(/\bplan ([a-n])\b/g)].map(m=>m[1]))],parts:[...new Set([...value.matchAll(/\bpart ([abcd])\b/g)].map(m=>m[1]))]};
}
export function intentFor(text,sourceIntents=[],planningYear=null){
 const value=String(text).toLowerCase();
 if(/\b(log[ -]?in|sign[ -]?in|customer service|phone number|provider (?:directory|list)|find (?:a )?(?:doctor|provider)|doctors? (?:that |who )?accept|primary care|rx coupons?|drug coupons?)\b/.test(value))return {value:1,label:'Service / navigation',reason:'Provider lookup, account support or coupons do not establish a policy-buying opportunity.'};
 const years=value.match(/\b20\d{2}\b/g)||[];
 if(planningYear&&years.some(y=>Number(y)<planningYear-1))return {value:1,label:'Historical query',reason:'The observed query names a year more than one year before the planning year; excluded from the current buying-intent queue.'};
 const timing=/\b(enrollment|enrolment|enroll)\b/.test(value)&&/\b(period|window|deadline|when|time|date|late|penalty|penalties)\b/.test(value);
 if(timing||/\benrollment\b/.test(value))return {value:4,label:'Commercial / buying obstacle',reason:'Enrollment timing or eligibility can support a buying decision, but is not evidence of an application or purchase.'};
 if(/\b(quotes?|apply|enroll|buy|purchase)\b/.test(value))return {value:5,label:'Transactional',reason:'Explicit quote, application or purchase wording; validate current search-result intent before approval.'};
 const commercial=/\b(compare|comparison|chart|versus|vs|reviews?|best|company|companies|carriers?|prices?|pricing|costs?|premiums?|discounts?|rates?|switch(?:ing)?|chang(?:e|ing)|underwriting|eligible|eligibility)\b/.test(value);
 const selection=entities(value).carriers.length>0&&productFor(value)!=='General Medicare'||/\bplan [a-n]\b/.test(value)&&productFor(value)==='Medigap';
 if(commercial||selection||sourceIntents.includes('commercial')||sourceIntents.includes('transactional'))return {value:4,label:'Commercial / buying obstacle',reason:commercial?'Comparison, pricing, selection or eligibility wording suggests a buying decision.':selection?'Carrier or plan selection suggests commercial research; a Semrush transactional label alone does not prove purchase intent.':'Semrush flags commercial/transactional intent; ambiguous wording receives commercial-level credit pending review.'};
 return {value:2,label:'Supporting information',reason:'No strong buying signal in the observed wording.'};
}
