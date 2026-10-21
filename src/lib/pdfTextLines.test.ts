import {afterEach,describe,expect,it,vi} from 'vitest';
import {freezeParagraphLines} from './pdfTextLines';

const originalClientRects=Object.getOwnPropertyDescriptor(Range.prototype,'getClientRects');
const originalBoundingRect=Object.getOwnPropertyDescriptor(Range.prototype,'getBoundingClientRect');
afterEach(()=>{
  document.body.replaceChildren();vi.restoreAllMocks();
  if(originalClientRects)Object.defineProperty(Range.prototype,'getClientRects',originalClientRects);
  else Reflect.deleteProperty(Range.prototype,'getClientRects');
  if(originalBoundingRect)Object.defineProperty(Range.prototype,'getBoundingClientRect',originalBoundingRect);
  else Reflect.deleteProperty(Range.prototype,'getBoundingClientRect');
});
function fixture(html:string){
  const source=document.createElement('section');source.innerHTML=`<div class="page" data-page-width-mm="210"><p data-source-block-id="first" style="line-height:20px;writing-mode:horizontal-tb">${html}</p></div>`;document.body.append(source);
  const clone=source.cloneNode(true) as HTMLElement;
  return {source,clone,paragraph:source.querySelector('p')!,copy:clone.querySelector('p')!};
}
function measureRows(rowFor:(node:Text,offset:number)=>number,hyphenAt=-1){
  Object.defineProperty(Range.prototype,'getClientRects',{configurable:true,value:function(this:Range){
    const node=this.startContainer as Text,offset=this.startOffset,top=rowFor(node,offset)*20;
    const rects=[{x:offset*5,y:top,top,bottom:top+16,left:offset*5,right:offset*5+5,width:5,height:16}];
    if(offset===hyphenAt)rects.push({x:offset*5+5,y:top,top,bottom:top+16,left:offset*5+5,right:offset*5+9,width:4,height:16});
    return rects as unknown as DOMRectList;
  }});
}
function initialStyle(value='3',float='none'){
  const computed=window.getComputedStyle.bind(window);
  vi.spyOn(window,'getComputedStyle').mockImplementation((element,pseudo)=>{
    if(pseudo==='::first-letter')return {getPropertyValue:()=>value,cssFloat:float,fontFamily:'serif',fontWeight:'400',color:'black'} as unknown as CSSStyleDeclaration;
    return computed(element);
  });
}
describe('canvas line breaks in print-only paragraphs',()=>{
  it('keeps CSS initial-letter openers native, including compiled snapshots',()=>{
    initialStyle();
    const {source,clone,paragraph,copy}=fixture('<span class="drop-cap">T</span>iny atoms and radiation');
    paragraph.classList.add('flow-opener');copy.classList.add('flow-opener');
    const before=copy.outerHTML;measureRows((_node,offset)=>offset<5?0:1);
    freezeParagraphLines(source,clone);expect(copy.outerHTML).toBe(before);
  });
  it('protects compiled issue paragraphs after editor hooks have been stripped',()=>{
    const {source,clone,paragraph,copy}=fixture('One two three');
    for(const p of [paragraph,copy]){p.removeAttribute('data-source-block-id');p.setAttribute('data-pdf-text-paragraph','true');}
    measureRows((_node,offset)=>offset<4?0:1);
    freezeParagraphLines(source,clone);
    expect(copy.dataset.pdfFixedLines).toBe('2');
    expect(copy.querySelectorAll('.pdf-text-line')).toHaveLength(2);
  });
  it('retains nested bold/italic wrappers on every line inside the same question',()=>{
    const {source,clone,copy}=fixture('<em class="question"><strong>First second third</strong></em> Answer follows');
    const before=source.outerHTML;
    measureRows((node,offset)=>node.parentElement?.tagName==='STRONG'?Math.floor(offset/6):3);
    freezeParagraphLines(source,clone);
    const lines=[...copy.querySelectorAll('.pdf-text-line')];
    expect(lines.length).toBeGreaterThan(2);
    for(const line of lines.slice(0,3))expect(line.querySelector('em.question > strong')).not.toBeNull();
    expect(lines.at(-1)?.querySelector('em')).toBeNull();expect(source.outerHTML).toBe(before);
  });
  it('keeps a styled common ancestor even when it contains multiple text nodes',()=>{
    const {source,clone,copy}=fixture('<span style="font-size:12px;color:red"><em>One</em> two three</span> answer');
    measureRows(node=>node.data.includes('three')?1:node.data.includes('answer')?2:0);
    freezeParagraphLines(source,clone);
    const styled=copy.querySelectorAll('.pdf-text-line > span[style]');
    expect(styled.length).toBeGreaterThanOrEqual(2);expect(styled[0].getAttribute('style')).toContain('color:red');
    expect(copy.querySelector('em')?.textContent).toBe('One');
  });
  it('retains emphasis and source DOM while making the measured lines indivisible',()=>{
    const {source,clone,paragraph,copy}=fixture('One <strong>two</strong> three');
    const before=source.outerHTML;
    measureRows(node=>node.data.includes('three')?1:0);
    freezeParagraphLines(source,clone);
    expect(source.outerHTML).toBe(before);expect(copy.dataset.pdfFixedLines).toBe('2');
    expect(copy.querySelectorAll('br[data-pdf-line-break]')).toHaveLength(1);
    expect(copy.querySelector('strong')?.textContent).toBe('two');
    expect([...copy.querySelectorAll<HTMLElement>('.pdf-text-line')].map(line=>line.style.whiteSpace)).toEqual(['nowrap','nowrap']);
    expect(copy.querySelector('[data-pdf-discretionary-hyphen]')).toBeNull();
    expect(paragraph.textContent).toBe('One two three');
  });
  it('preserves a painted automatic hyphen only at a measured mid-word break',()=>{
    const {source,clone,copy}=fixture('nanostructures');measureRows((_node,offset)=>offset<4?0:1,3);
    freezeParagraphLines(source,clone);
    expect([...copy.querySelectorAll('.pdf-text-line')].map(line=>line.textContent)).toEqual(['nano-','structures']);
    expect(copy.querySelector('[data-pdf-discretionary-hyphen]')?.textContent).toBe('-');
  });
  it('does not add a hyphen to a measured emergency word or URL break',()=>{
    const {source,clone,copy}=fixture('nanostructures');measureRows((_node,offset)=>offset<4?0:1);
    freezeParagraphLines(source,clone);
    expect([...copy.querySelectorAll('.pdf-text-line')].map(line=>line.textContent)).toEqual(['nano','structures']);
    expect(copy.querySelector('[data-pdf-discretionary-hyphen]')).toBeNull();
  });
  it('does not invent hyphens at spaces or between inline elements',()=>{
    const {source,clone,copy}=fixture('One two');measureRows((_node,offset)=>offset<4?0:1);
    freezeParagraphLines(source,clone);expect(copy.querySelector('[data-pdf-discretionary-hyphen]')).toBeNull();
  });
  it('leaves manual breaks, complex equations, decorative quotes and RTL text in their specialised layout',()=>{
    for(const html of ['One<br>two','One <span class="tex">x</span> two','One <svg/> two']){
      const {source,clone}=fixture(html),before=clone.outerHTML;measureRows(()=>0);freezeParagraphLines(source,clone);expect(clone.outerHTML).toBe(before);vi.restoreAllMocks();
    }
    const {source,clone,paragraph}=fixture('One two');paragraph.style.direction='rtl';const before=clone.outerHTML;freezeParagraphLines(source,clone);expect(clone.outerHTML).toBe(before);
  });
  it('does not replace an unmeasured or single-line paragraph',()=>{
    const {source,clone}=fixture('Single line'),before=clone.outerHTML;measureRows(()=>0);freezeParagraphLines(source,clone);expect(clone.outerHTML).toBe(before);
  });
  it('preserves native justification instead of collapsing expanded spaces',()=>{
    const {source,clone,paragraph}=fixture('One two three');paragraph.style.textAlign='justify';
    const before=clone.outerHTML;measureRows((_node,offset)=>offset<4?0:1);
    freezeParagraphLines(source,clone);expect(clone.outerHTML).toBe(before);
  });
  it('does not reinterpret a native column boundary as a very long line',()=>{
    const {source,clone}=fixture('One two three'),before=clone.outerHTML;
    measureRows((_node,offset)=>offset<4?0:offset<8?1:0);
    freezeParagraphLines(source,clone);expect(clone.outerHTML).toBe(before);
  });
  it('leaves native three-line drop-cap paragraphs intact instead of enclosing their float in a nowrap line',()=>{
    initialStyle();
    const {source,clone,copy}=fixture('<span class="drop-cap">T</span>iny atoms');
    const before=copy.outerHTML;
    measureRows((node,offset)=>node.parentElement?.classList.contains('drop-cap')?-1:offset<4?0:1);
    freezeParagraphLines(source,clone);
    expect(copy.outerHTML).toBe(before);expect(copy.dataset.pdfFixedLines).toBeUndefined();
    expect(copy.querySelector('.drop-cap')?.textContent).toBe('T');expect(copy.querySelector('.pdf-text-line')).toBeNull();
  });
  it.each(['normal',''])('does not enlarge an inactive continuation-column marker (%s)',value=>{
    initialStyle(value);
    const {source,clone,paragraph,copy}=fixture('<span class="drop-cap">K</span>ajian Ibn al-Haytham');
    paragraph.classList.add('flow-opener');
    vi.spyOn(paragraph,'getBoundingClientRect').mockReturnValue({x:0,y:0,left:0,top:0,width:100,height:60,right:100,bottom:60} as DOMRect);
    measureRows((node,offset)=>node.parentElement?.classList.contains('drop-cap')?0:offset<6?0:1);
    freezeParagraphLines(source,clone);
    expect(copy.dataset.pdfFixedLines).toBe('2');
    expect(copy.querySelector('.pdf-native-initial')).toBeNull();
    expect(copy.dataset.pdfPositionedInitial).toBeUndefined();
    expect(copy.textContent?.replace(/\s/g,'')).toBe(paragraph.textContent?.replace(/\s/g,''));
    expect(copy.querySelector('.pdf-text-line')?.textContent).toMatch(/^Kajian/);
  });
  it('preserves a real measured initial and its neighbouring text positions',()=>{
    initialStyle();
    const {source,clone,paragraph,copy}=fixture('<span class="drop-cap">T</span>iny atoms');
    const rect={x:0,y:0,left:0,top:0,width:100,height:60,right:100,bottom:60} as DOMRect;
    vi.spyOn(paragraph,'getBoundingClientRect').mockReturnValue(rect);
    Object.defineProperty(Range.prototype,'getBoundingClientRect',{configurable:true,value:()=>rect});
    measureRows((node,offset)=>node.parentElement?.classList.contains('drop-cap')?-1:offset<4?0:1);
    freezeParagraphLines(source,clone);
    expect(copy.dataset.pdfPositionedInitial).toBe('true');
    expect(copy.querySelector('.pdf-native-initial')?.textContent).toBe('T');
    expect(copy.querySelectorAll('.pdf-text-line')).toHaveLength(2);
    expect(copy.textContent?.replace(/\s/g,'')).toBe('Tinyatoms');
    expect(clone.querySelector('.page > style[data-pdf-initial-rule]')).not.toBeNull();
  });
  it('leaves a browser fallback float intact',()=>{
    initialStyle('normal','inline-start');
    const {source,clone}=fixture('<span class="drop-cap">T</span>iny atoms');
    const before=clone.outerHTML;measureRows((_node,offset)=>offset<4?0:1);
    freezeParagraphLines(source,clone);expect(clone.outerHTML).toBe(before);
  });
});
