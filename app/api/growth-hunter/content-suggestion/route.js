import 'server-only';
import {generateText,Output,jsonSchema} from 'ai';
import {createAnthropic} from '@ai-sdk/anthropic';
import {serverAuth} from '../../../../lib/auth/server';
import {siteUrl} from '../../../../lib/auth/config';
import {growthEnabled} from '../../../../lib/growth-hunter/access';
import {growthContentHandler} from '../../../../lib/growth-hunter/content-handler';
import {growthContentSystem} from '../../../../lib/growth-hunter/content';
import {suggestionSchema} from '../../../../lib/otterly/content-suggestion';
export const runtime='nodejs';
export const maxDuration=120;
export const POST=growthContentHandler({getClient:serverAuth,enabled:growthEnabled,origin:siteUrl,configured:()=>Boolean(process.env.ANTHROPIC_API_KEY),generate:async evidence=>{
 const provider=createAnthropic({apiKey:process.env.ANTHROPIC_API_KEY});
 const schema=suggestionSchema(evidence.pages);schema.properties.targetId.enum=['target'];
 const {output}=await generateText({model:provider(process.env.ANTHROPIC_MODEL||'claude-haiku-4-5-20251001'),system:growthContentSystem,prompt:JSON.stringify(evidence),output:Output.object({schema:jsonSchema(schema)}),maxOutputTokens:2400,maxRetries:0,abortSignal:AbortSignal.timeout(60000)});
 return output;
}});
