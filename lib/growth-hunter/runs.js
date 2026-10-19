import { authorizeGrowth } from './access.js';
import { GrowthError } from './contracts.js';
import { reply, errorReply, readBody } from './handlers.js';
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function createRunHandlers({ getClient, enabled, origin }) {
  async function access(action) { const allowed = enabled(); return authorizeGrowth(allowed ? await getClient() : null, allowed, action); }
  return {
    async GET() {
      try {
        const {client} = await access('read');
        const {data,error} = await client.from('growth_decline_runs').select('id,created_at,prior_snapshot_id,current_snapshot_id,detector_version,result').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(20);
        if (error) throw new GrowthError('Saved research is unavailable. Confirm the research migration has been applied.',503,'storage_unavailable');
        return reply({runs:data,limit:20});
      } catch (error) { return errorReply(error); }
    },
    async POST(request) {
      try {
        const {client} = await access('run');
        if(request.headers.get('origin')!==new URL(origin()).origin) throw new GrowthError('Start research from the dashboard.',403,'origin_rejected');
        const body=await readBody(request,2048);
        if(!body || Object.keys(body).some(key=>!['priorId','currentId','scopeConfirmed'].includes(key)) || !uuid(body.priorId) || !uuid(body.currentId) || body.priorId===body.currentId || body.scopeConfirmed!==true) throw new GrowthError('Choose two different snapshots and confirm matching export scope.');
        const {data,error}=await client.rpc('growth_detect_declines',{prior_id:body.priorId,current_id:body.currentId,scope_confirmed:body.scopeConfirmed});
        if(error) {
          if(error.code==='42501') throw new GrowthError('Research permission changed. Reload before continuing.',403,'forbidden');
          if(error.code==='P0002') throw new GrowthError('One of the selected snapshots is unavailable.',404,'not_found');
          if(error.code==='22023') throw new GrowthError('Use adjacent, equal 7, 28, 56 or 84 day snapshots with matching source definitions.',400,'incompatible_periods');
          throw new GrowthError('Research could not be saved. Please retry.',503,'storage_unavailable');
        }
        const {created_by, ...run}=data.run;
        return reply({run,reused:data.reused},data.reused?200:201);
      } catch (error) { return errorReply(error); }
    },
  };
}
