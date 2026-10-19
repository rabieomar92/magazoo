import {expect,it} from 'vitest';
import {decodeIssuePdf} from './externalPdfData';
it('accepts complete PDF bytes without fetching a data URL',()=>{
 expect(new TextDecoder().decode(decodeIssuePdf('data:application/pdf;base64,JVBERi0xLjcK'))).toBe('%PDF-1.7\n');
});
it.each(['data:application/pdf;base64,JVBERi0xLjcK[Truncated]','data:application/pdf;base64,a','data:application/pdf;base64,aGVsbG8=','https://example.com/a.pdf',null])('rejects damaged backup data with a recovery message: %s',src=>{
 expect(()=>decodeIssuePdf(src)).toThrow('incomplete or damaged embedded PDF');
});
