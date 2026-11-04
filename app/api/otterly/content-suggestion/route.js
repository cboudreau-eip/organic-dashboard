import {generateText,Output,jsonSchema} from 'ai';
import {createAnthropic} from '@ai-sdk/anthropic';
import {otterlyAccess} from '../../../../lib/otterly/server';
import {siteUrl} from '../../../../lib/auth/config';
import {contentHandler} from '../../../../lib/otterly/content-handlers';
import {contentSources} from '../../../../lib/otterly/content-sources';
import {contentSystem,suggestionSchema} from '../../../../lib/otterly/content-suggestion';
export const runtime='nodejs';
export const maxDuration=120;
export const POST=contentHandler({access:otterlyAccess,origin:siteUrl,sources:contentSources,configured:()=>Boolean(process.env.ANTHROPIC_API_KEY),generate:async evidence=>{
 const provider=createAnthropic({apiKey:process.env.ANTHROPIC_API_KEY});
 const {output}=await generateText({model:provider(process.env.ANTHROPIC_MODEL||'claude-haiku-4-5-20251001'),system:contentSystem,prompt:JSON.stringify(evidence),output:Output.object({schema:jsonSchema(suggestionSchema(evidence.pages))}),maxOutputTokens:2400,maxRetries:0,abortSignal:AbortSignal.timeout(60000)});
 return output;
}});
