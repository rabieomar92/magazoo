interface TextPoint { node:Text; offset:number }
interface Line { start:TextPoint; end:TextPoint; top:number; left?:number; hyphen:boolean }

/** Fix the canvas's chosen line breaks in the export copy. Chromium's paged
 * renderer can round font advances differently from screen layout; letting it
 * wrap a paragraph again can move a word and then every following line. Text
 * and inline emphasis stay real DOM, not a bitmap or individually drawn glyphs.
 * Complex maths/decorative quotes keep their specialised layout unchanged. */
export function freezeParagraphLines(source:HTMLElement,clone:HTMLElement) {
  const selector='p[data-source-block-id],p[data-pdf-text-paragraph]';
  const sources=[...source.querySelectorAll<HTMLElement>(selector)];
  const copies=[...clone.querySelectorAll<HTMLElement>(selector)];
  sources.forEach((paragraph,index)=>{
    const copy=copies[index];
    if(!copy||paragraph.querySelector('.katex,.tex,.decorative-quote-mark,br,svg,img')||paragraph.classList.contains('decorative-quote'))return;
    // Flow markers also occur at continuation-column boundaries. Only the
    // computed pseudo-element tells us whether the canvas actually enlarges
    // this letter; a marker alone must never create a drop cap in the PDF.
    const hasInitialMarker=!!paragraph.querySelector('.drop-cap')&&!paragraph.classList.contains('cont')&&!paragraph.closest('.drop-caps-off');
    const pseudo=hasInitialMarker?getComputedStyle(paragraph,'::first-letter'):undefined;
    const initialSize=Number.parseFloat(pseudo?.getPropertyValue('initial-letter')||pseudo?.getPropertyValue('-webkit-initial-letter')||'');
    const nativeInitial=initialSize>1;
    // Older engines use the stylesheet's floating first-letter fallback.
    // Keep that specialised flow native instead of freezing across its float.
    if(hasInitialMarker&&!nativeInitial&&pseudo?.cssFloat&&pseudo.cssFloat!=='none')return;
    // Native initial-letter reserves a different width for the first three
    // lines. Wrapping its marker in an indivisible print-line span prevents
    // that exclusion from flowing naturally, leaving holes or shifted words.
    // Isolate that glyph and preserve the surrounding canvas line positions.
    const style=getComputedStyle(paragraph),leading=Number.parseFloat(style.lineHeight);
    // Justified paragraphs distribute word spacing per native line. Making a
    // line indivisible would suppress that distribution; leave it native.
    if(!(leading>0)||style.writingMode!=='horizontal-tb'||style.direction==='rtl'||style.textAlign==='justify')return;
    const page=paragraph.closest<HTMLElement>('.page'),pageRect=page?.getBoundingClientRect();
    const scale=page&&pageRect?.width? pageRect.width/(Number(page.dataset.pageWidthMm??210)*96/25.4):1;
    if(!(scale>0))return;
    if(nativeInitial&&!(paragraph.getBoundingClientRect().height>0))return;
    const walker=paragraph.ownerDocument.createTreeWalker(paragraph,NodeFilter.SHOW_TEXT);
    const lines:Line[]=[];
    let initial:{point:TextPoint;rect:DOMRect}|undefined;
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
          const drop=nativeInitial&&(!!node.parentElement?.closest('.drop-cap')||rect.height/scale>leading*1.6);
          if(nativeInitial&&drop&&!initial){initial={point,rect};continue;}
          const top=rect.top/scale;
          const last=lines.at(-1);
          // A paragraph fragmented by native CSS columns can jump back to the
          // top of the next column. Do not reinterpret that as one long line.
          if(last&&!drop&&Number.isFinite(last.top)&&top<last.top-leading*.65)crossesColumns=true;
          if(!last){lines.push({start:{node,offset:nativeInitial?offset:0},end:{node,offset:offset+1},top:drop?NaN:top,left:rect.left/scale,hyphen});}
          else if(!drop&&Number.isFinite(last.top)&&top-last.top>leading*.65){
            lines.push({start:point,end:{node,offset:offset+1},top,left:rect.left/scale,hyphen});
          }else{
            if(!drop&&!Number.isFinite(last.top))last.top=top;
            last.end={node,offset:offset+1};last.hyphen=hyphen;
          }
        }
      }
    }
    if(lines.length<2||crossesColumns)return;
    const positioned=nativeInitial&&initial&&paragraph.getBoundingClientRect().height>0;
    const paragraphRect=paragraph.getBoundingClientRect();
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
      if(positioned){
        run.querySelectorAll('.drop-cap').forEach(marker=>marker.replaceWith(...marker.childNodes));
        // Native initial-letter is repaginated differently inside print
        // columns. Preserve the canvas's real vector text line positions for
        // this paragraph only, rather than allowing a hidden overflow column.
        const probe=paragraph.ownerDocument.createElement('span');
        probe.style.cssText='position:absolute;left:0;top:0;white-space:nowrap;line-height:inherit;text-indent:0';
        probe.append(paragraph.ownerDocument.importNode(run,true));paragraph.append(probe);
        const glyph=paragraph.ownerDocument.createRange();glyph.selectNodeContents(probe);
        const glyphRect=glyph.getBoundingClientRect(),probeRect=probe.getBoundingClientRect();
        const offset=(glyphRect.top-probeRect.top)/scale;probe.remove();
        run.style.setProperty('position','absolute');run.style.setProperty('display','block');run.style.setProperty('text-indent','0','important');
        run.style.setProperty('left',`${line.left!-paragraphRect.left/scale}px`);
        run.style.setProperty('top',`${line.top-paragraphRect.top/scale-offset}px`);
      }
      const next=lines[lineIndex+1];
      // Preserve only a hyphen actually painted by the canvas. A URL, CJK
      // text or break-all line may divide adjacent letters with no hyphen.
      if(next&&line.hyphen){
        const hyphen=copy.ownerDocument.createElement('span');hyphen.dataset.pdfDiscretionaryHyphen='true';hyphen.textContent='-';run.append(hyphen);
      }
      fragment.append(run);
      if(next&&!positioned){const br=copy.ownerDocument.createElement('br');br.dataset.pdfLineBreak='true';fragment.append(br);}
    });
    if(positioned&&initial){
      const cap=paragraph.ownerDocument.createElement('span');
      cap.textContent=initial.point.node.data[initial.point.offset];
      // Keep native glyph sizing, isolated from the body paragraph's print
      // fragmentation. The neighbouring real text lines keep their canvas XY.
      cap.className='pdf-native-initial';
      cap.style.cssText='position:absolute;left:0;top:0;display:block;width:100%;height:3lh;line-height:inherit;font-size:inherit;text-indent:0';
      cap.style.fontFamily=pseudo!.fontFamily;cap.style.fontWeight=pseudo!.fontWeight;cap.style.color=pseudo!.color;
      fragment.prepend(copy.ownerDocument.importNode(cap,true));
      if(!clone.querySelector('[data-pdf-initial-rule]')){
        const rule=copy.ownerDocument.createElement('style');rule.dataset.pdfInitialRule='true';
        rule.textContent='.pdf-native-initial::first-letter{initial-letter:3;-webkit-initial-letter:3;font-size:1em;line-height:inherit}';
        (copy.closest('.page')??clone).append(rule);
      }
      copy.style.position='relative';copy.style.height=`${paragraphRect.height/scale}px`;
      copy.dataset.pdfPositionedInitial='true';
    }
    copy.replaceChildren(fragment);
    copy.dataset.pdfFixedLines=String(lines.length);
  });
}
