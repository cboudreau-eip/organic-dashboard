export const PRODUCTS=['Medigap','Medicare Advantage','Part D'];
export const DECISIONS=['Needs review','Keep','Defer','Reject'];
export const DEFAULTS={start:'2027-01-01',duration:90,products:PRODUCTS,states:[],excluded:[],objective:'Qualified quote opportunities',weeklyCapacity:2,newContentPercent:50,notes:''};
export class ResearchError extends Error{constructor(message,status=422){super(message);this.status=status;}}
export function settingsInput(x){
 if(!x||Object.keys(x).some(k=>!Object.keys(DEFAULTS).includes(k)))throw new ResearchError('Invalid planning settings.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(x.start)||!Number.isFinite(Date.parse(x.start))||new Date(x.start).toISOString().slice(0,10)!==x.start)throw new ResearchError('Choose a valid planning start date.');
 if(!Number.isInteger(x.duration)||x.duration<7||x.duration>366||!Number.isInteger(x.weeklyCapacity)||x.weeklyCapacity<1||x.weeklyCapacity>30||!Number.isInteger(x.newContentPercent)||x.newContentPercent<0||x.newContentPercent>100)throw new ResearchError('Check duration, weekly capacity and content mix.');
 if(!Array.isArray(x.products)||!x.products.length||x.products.some(p=>!PRODUCTS.includes(p)))throw new ResearchError('Choose at least one supported product.');
 for(const key of ['states','excluded'])if(!Array.isArray(x[key])||x[key].length>50||x[key].some(v=>typeof v!=='string'||!v.trim()||v.length>100||/[\u0000-\u001f]/.test(v)))throw new ResearchError('Use up to 50 short state names or excluded phrases.');
 if(typeof x.objective!=='string'||!x.objective.trim()||x.objective.length>300||typeof x.notes!=='string'||x.notes.length>2000)throw new ResearchError('Keep the objective under 300 characters and notes under 2,000.');
 return {...x,products:[...new Set(x.products)],states:x.states.map(s=>s.trim().toLowerCase()),excluded:x.excluded.map(s=>s.trim().toLowerCase())};
}
export const uuid=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x);
export function reviewInput(x){if(!x||!uuid(x.runId)||typeof x.key!=='string'||!/^[a-f0-9]{24}$/.test(x.key)||!DECISIONS.includes(x.decision)||typeof x.reason!=='string'||x.reason.length>2000)throw new ResearchError('Choose a valid opportunity and review decision.');return x;}
