import { describe, expect, it } from 'vitest';
import { emptyDoc, migrate } from '../schema/document';
import { pageFooter, footerBottomOffset, footerBottomMargin } from './pageFooter';
import { cloneDocForUpdate } from '../store/useDoc';
import { presetFor, TEMPLATES } from '../store/presets';
describe('shared running footer', () => {
  it('defaults to 8mm and preserves zero, fractional and saved offsets', () => {
    const doc=emptyDoc();
    expect(footerBottomOffset(doc)).toBe(8);
    for (const bottomOffset of [0, 6.5, 18, 40]) {
      doc.footer={bottomOffset};
      const saved=migrate(JSON.parse(JSON.stringify(doc)));
      expect(footerBottomOffset(saved)).toBe(bottomOffset);
      const draft=cloneDocForUpdate(doc);draft.footer!.bottomOffset=3;
      expect(doc.footer.bottomOffset).toBe(bottomOffset);
    }
  });
  it('reserves only extra bottom space and releases it when disabled', () => {
    const doc=emptyDoc();doc.design.margin=12;doc.footer={bottomOffset:20};
    expect(footerBottomMargin(doc)).toBeCloseTo(25.4694,3);
    expect(doc.design.margin).toBe(12);
    doc.footer.enabled=false;
    expect(footerBottomMargin(doc)).toBe(12);
  });
  it('bounds invalid distances', () => {
    const doc=emptyDoc();
    for (const [value, expected] of [[-2,0],[99,40],[NaN,8],[Infinity,8]]) {
      doc.footer={bottomOffset:value};expect(footerBottomOffset(doc)).toBe(expected);
    }
  });
  it('accepts only the supported footer fonts and keeps size in bounds', () => {
    const doc=emptyDoc();
    doc.footer={fontFamily:'Avenir Next LT Pro',fontSize:14};
    expect(pageFooter(doc,0)).toMatchObject({fontFamily:'Avenir Next LT Pro',fontSize:14});
    doc.footer={fontFamily:'Comic Sans',fontSize:99};
    expect(pageFooter(doc,0)).toMatchObject({fontFamily:'Helvetica',fontSize:18});
  });
  it('defaults on across every template and follows both masthead side choices', () => {
    for (const template of TEMPLATES) {
      const doc=template.make();
      for (const side of ['left','right'] as const) {
        doc.design.barSide=side;
        doc.footer={text:'Science magazine',startNumber:11};
        for(let i=0;i<4;i++) expect(pageFooter(doc,i)).toMatchObject({enabled:true,text:'Science magazine',number:11+i,right:(side==='right') !== (i%2===1),fontFamily:'Helvetica',fontSize:7});
      }
    }
  });
  it('preserves explicit blank labels, zero, disabled state and undo drafts', () => {
    const original=emptyDoc();original.footer={text:'',startNumber:0,enabled:false};
    const draft=cloneDocForUpdate(original);draft.footer!.startNumber=30;
    expect(pageFooter(original,0)).toMatchObject({text:'',number:0,enabled:false});
  });
  it('reopens the new Paper 3 and saved footer without legacy fallback', () => {
    const doc=presetFor('paper-3');doc.footer={text:'Issue 5',startNumber:11};
    const reopened=migrate(JSON.parse(JSON.stringify(doc)));
    expect(reopened.templateId).toBe('paper-3');
    expect(pageFooter(reopened,1).number).toBe(12);
  });
});
