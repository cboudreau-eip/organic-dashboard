import {timingSafeEqual} from 'node:crypto';
import {runOtterlySync} from '../../../../lib/otterly/server';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(request){
 const secret=process.env.CRON_SECRET;
 const supplied=Buffer.from(request.headers.get('authorization')||'');
 const expected=Buffer.from('Bearer '+(secret||''));
 if(!secret||supplied.length!==expected.length||!timingSafeEqual(supplied,expected))return Response.json({error:'Unauthorized'},{status:401});
 try{return Response.json(await runOtterlySync(),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'Otterly sync failed. Check saved sync status.'},{status:503});}
}
