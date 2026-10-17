interface TextPoint { node:Text; offset:number }
interface Line { start:TextPoint; end:TextPoint; top:number; hyphen:boolean }

/** Fix the canvas's chosen line breaks in the export copy. Chromium's paged
 * renderer can round font advances differently from screen layout; letting it
 * wrap a paragraph again can move a word and then every following line. Text
 * and inline emphasis stay real DOM, not a bitmap or individually drawn glyphs.
 * Complex maths/decorative quotes keep their specialised layout unchanged. */
export function freezeParagraphLines(source:HTMLElement,clone:HTMLElement) {
  const sources=[...source.querySelectorAll<HTMLElement>('p[data-source-block-id]')];
  const copies=[...clone.querySelectorAll<HTMLElement>('p[data-source-block-id]')];
  sources.forEach((paragraph,index)=>{
    const copy=copies[index];
    if(!copy||paragraph.querySelector('.katex,.tex,.decorative-quote-mark,br,svg,img')||paragraph.classList.contains('decorative-quote'))return;
    const style=getComputedStyle(paragraph),leading=Number.parseFloat(style.lineHeight);
    // Justified paragraphs distribute word spacing per native line. Making a
    // line indivisible would suppress that distribution; leave it native.
    if(!(leading>0)||style.writingMode!=='horizontal-tb'||style.direction==='rtl'||style.textAlign==='justify')return;
    const page=paragraph.closest<HTMLElement>('.page'),pageRect=page?.getBoundingClientRect();
    const scale=page&&pageRect?.width? pageRect.width/(Number(page.dataset.pageWidthMm??210)*96/25.4):1;
    if(!(scale>0))return;
    const walker=paragraph.ownerDocument.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);
    const lines:Line[]=[];
    let crossesColumns=false;
    while(walker.nextNode()){
      const node=walker.currentNode as Text;
      for(let offset=0;offset<node.length;offset++){
        const char=node.data[offset],point={node,offset};
        if(!/\s/.test(char)){
          const range=paragraph.ownerDocument.createRange();range.setStart(node,offset);range.setEnd(node,offset+1);
          // At an automatic break Chromium can include a separate hyphen's
          // rectangle beside the preceding glyph or above the following one.
          // Read the actual glyph, not that two-line union.
          const rects=[...range.getClientRects()].filter(rect=>rect.width>0&&rect.height>0);
          const bottomLine=Math.max(...rects.map(rect=>rect.top));
          const rect=rects.find(rect=>Math.abs(rect.top-bottomLine)<.5);
          if(!rect)continue;
          const hyphen=char==='\u00ad'||rects.some(other=>other!==rect&&Math.abs(other.top-rect.top)<.5&&other.left>=rect.right-.5);
          // An enlarged ::first-letter is a float, not a different text line.
          const drop=!!node.parentElement?.closest('.drop-cap')||rect.height/scale>leading*1.6;
          const top=rect.top/scale;
          const last=lines.at(-1);
          // A paragraph fragmented by native CSS columns can jump back to the
          // top of the next column. Do not reinterpret that as one long line.
          if(last&&!drop&&Number.isFinite(last.top)&&top<last.top-leading*.65)crossesColumns=true;
          if(!last){lines.push({start:{node,offset:0},end:{node,offset:offset+1},top:drop?NaN:top,hyphen});}
          else if(!drop&&Number.isFinite(last.top)&&top-last.top>leading*.65){
            lines.push({start:point,end:{node,offset:offset+1},top,hyphen});
          }else{
            if(!drop&&!Number.isFinite(last.top))last.top=top;
            last.end={node,offset:offset+1};last.hyphen=hyphen;
          }
        }
      }
    }
    if(lines.length<2||crossesColumns)return;
    const fragment=copy.ownerDocument.createDocumentFragment();
    lines.forEach((line,lineIndex)=>{
      const range=paragraph.ownerDocument.createRange();range.setStart(line.start.node,line.start.offset);range.setEnd(line.end.node,line.end.offset);
      const run=copy.ownerDocument.createElement('span');run.className='pdf-text-line';
      run.style.setProperty('white-space','nowrap','important');run.style.setProperty('hyphens','none','important');
      // cloneContents includes children, not the common ancestor itself. If
      // both endpoints are inside one <em>/<strong>/<span>, omitting that
      // ancestor silently turns the middle lines of a question into plain text.
      let content:Node=copy.ownerDocument.importNode(range.cloneContents(),true);
      let ancestor=range.commonAncestorContainer.nodeType===Node.ELEMENT_NODE
        ? range.commonAncestorContainer as Element : range.commonAncestorContainer.parentElement;
      while(ancestor&&ancestor!==paragraph){
        const wrapper=copy.ownerDocument.importNode(ancestor.cloneNode(false),false);
        wrapper.appendChild(content);content=wrapper;ancestor=ancestor.parentElement;
      }
      run.append(content);
      const next=lines[lineIndex+1];
      // Preserve only a hyphen actually painted by the canvas. A URL, CJK
      // text or break-all line may divide adjacent letters with no hyphen.
      if(next&&line.hyphen){
        const hyphen=copy.ownerDocument.createElement('span');hyphen.dataset.pdfDiscretionaryHyphen='true';hyphen.textContent='-';run.append(hyphen);
      }
      fragment.append(run);
      if(next){const br=copy.ownerDocument.createElement('br');br.dataset.pdfLineBreak='true';fragment.append(br);}
    });
    copy.replaceChildren(fragment);
    copy.dataset.pdfFixedLines=String(lines.length);
  });
}
