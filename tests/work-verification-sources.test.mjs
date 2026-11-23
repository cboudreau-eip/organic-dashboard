import test from 'node:test';import assert from 'node:assert/strict';
import {readVerificationSource,selectDocumentPages,verificationPassages,extractPdf} from '../lib/work-queue/verification-sources.js';
test('official source reader accepts bounded PDF evidence with page references and refuses unsafe redirects',async()=>{
 const url='https://www.medicare.gov/guide.pdf';
 const p=await readVerificationSource(url,'trial rights',{fetcher:async()=>new Response('%PDF-test',{headers:{'Content-Type':'application/pdf'}}),parsePdf:async()=>[{page:2,label:'1',text:'Trial rights conditions '.repeat(20)}]});p.id='source';
 const refs=verificationPassages(p);assert.equal(refs[0].page,2);assert.equal(refs[0].pageLabel,'1');assert.equal(refs[0].url,url+'#page=2');
 await assert.rejects(()=>readVerificationSource(url,'test',{fetcher:async()=>new Response(null,{status:302,headers:{location:'http://127.0.0.1/private'}})}),/Unsupported redirect/);
 await assert.rejects(()=>readVerificationSource(url,'test',{fetcher:async()=>new Response('x'.repeat(8000001),{headers:{'Content-Type':'application/pdf'}})}),/too large/);
});
test('document selection retains complete page text and labels for relevant evidence',()=>{
 const pages=[{page:1,label:'cover',text:'Welcome'},{page:2,label:'1',text:'Medigap trial rights conditions and exclusions'},{page:3,label:'2',text:'Unrelated directory'}];
 assert.deepEqual(selectDocumentPages(pages,'Medigap trial rights',1),[pages[1]]);
});
test('PDF.js extracts actual document text and rejects unreadable bytes',async()=>{
 const body='BT /F1 12 Tf 40 700 Td '+Array.from({length:8},()=>'(Official qualifying conditions apply.) Tj 0 -20 Td').join('\n')+' ET';
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${body.length} >>\nstream\n${body}\nendstream`];
 let pdf='%PDF-1.4\n',offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${o}\nendobj\n`;});const offset=Buffer.byteLength(pdf);pdf+='xref\n0 6\n0000000000 65535 f \n'+offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;
 const pages=await extractPdf(Buffer.from(pdf));assert.equal(pages.length,1);assert.match(pages[0].text,/Official qualifying/);await assert.rejects(()=>extractPdf(Buffer.from('not a PDF')));
});
