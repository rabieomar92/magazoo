import {act} from 'react';
import {createRoot,type Root} from 'react-dom/client';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {emptyDoc,migrate} from '../schema/document';
import {cloneDocForUpdate,useDoc} from '../store/useDoc';
import {HeroCaption} from './HeroCaption';
import {PreviewReadOnly} from './PreviewReadOnly';

const pointer=(type:string,x:number,y:number)=>{
  const event=new MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y});
  Object.defineProperty(event,'pointerId',{value:7});return event;
};
const rect=(left:number,top:number,width:number,height:number)=>({x:left,y:top,left,top,width,height,right:left+width,bottom:top+height,toJSON(){}});
let host:HTMLDivElement,root:Root;
function CaptionProof({readOnly=false,cover=false,location=false}:{readOnly?:boolean;cover?:boolean;location?:boolean}){
  const doc=useDoc(s=>s.doc);
  return <div className="page"><div className="cropped-photo"><PreviewReadOnly.Provider value={readOnly}><HeroCaption doc={doc} cover={cover} location={location}/></PreviewReadOnly.Provider></div></div>;
}
const source=()=>host.querySelector<HTMLElement>('[data-hero-caption-source]')!;
const floating=()=>host.querySelector<HTMLElement>('[data-hero-caption-floating]');

beforeEach(()=>{
  (globalThis as typeof globalThis&{IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
    if(this.classList.contains('page'))return rect(10,20,420,594); // 2 screen px per physical mm.
    if(this.hasAttribute('data-hero-caption-floating'))return rect(10+parseFloat(this.style.left)*2,20+parseFloat(this.style.top)*2,parseFloat(this.style.width)*2,20);
    return rect(50,80,120,20);
  });
  const doc=emptyDoc();doc.meta.heroCaption='Exact authored hero caption.';doc.meta.coverCaption='Independent cover caption.';
  useDoc.getState().load(doc);useDoc.temporal.getState().clear();
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();useDoc.getState().load(emptyDoc());});

describe('independent hero caption canvas movement',()=>{
  it('resizes the legacy particle-photo location label independently of the hero caption',()=>{
    useDoc.getState().doc.meta.location='Legacy photo description';
    act(()=>root.render(<CaptionProof location/>));
    expect(source().dataset.editorTarget).toBe('meta-location');
    act(()=>host.querySelector<HTMLElement>('.hero-caption-resize--right')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',shiftKey:true,bubbles:true})));
    const saved=useDoc.getState().doc;
    expect(saved.design.locationCaptionPlacement).toEqual({x:20,y:30,widthMm:55});
    expect(saved.design.heroCaptionPlacement).toBeUndefined();
    expect(saved.meta.heroCaption).toBe('Exact authored hero caption.');
    expect(migrate(JSON.parse(JSON.stringify(saved))).design.locationCaptionPlacement).toEqual(saved.design.locationCaptionPlacement);
    const copy=cloneDocForUpdate(saved);copy.design.locationCaptionPlacement!.widthMm=99;
    expect(saved.design.locationCaptionPlacement!.widthMm).toBe(55);
  });
  it('resizes a native caption from its right edge without moving it and saves one undoable change',()=>{
    act(()=>root.render(<CaptionProof/>));
    const handle=host.querySelector<HTMLElement>('.hero-caption-resize--right')!;
    expect(handle.getAttribute('aria-label')).toBe('Resize hero caption from right');
    act(()=>{handle.dispatchEvent(pointer('pointerdown',170,90));window.dispatchEvent(pointer('pointermove',210,90));});
    expect(useDoc.getState().doc.design.heroCaptionPlacement).toBeUndefined();
    expect(floating()?.style.width).toBe('80mm');expect(floating()?.style.left).toBe('20mm');
    act(()=>window.dispatchEvent(pointer('pointerup',210,90)));
    expect(useDoc.getState().doc.design.heroCaptionPlacement).toEqual({x:20,y:30,widthMm:80});
    expect(useDoc.temporal.getState().pastStates).toHaveLength(1);
    expect(migrate(JSON.parse(JSON.stringify(useDoc.getState().doc))).design.heroCaptionPlacement?.widthMm).toBe(80);
    act(()=>useDoc.temporal.getState().undo());expect(floating()).toBeNull();
    act(()=>useDoc.temporal.getState().redo());expect(floating()?.style.width).toBe('80mm');
  });
  it('resizes from the left while holding the right edge fixed and supports keyboard cover resizing',()=>{
    act(()=>root.render(<CaptionProof cover/>));
    act(()=>host.querySelector<HTMLElement>('.hero-caption-resize--left')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true})));
    expect(useDoc.getState().doc.design.coverCaptionPlacement).toEqual({x:25,y:30,widthMm:55});
    expect(useDoc.getState().doc.design.heroCaptionPlacement).toBeUndefined();
    const handle=host.querySelector<HTMLElement>('[data-hero-caption-floating] .hero-caption-resize--left')!;
    act(()=>{handle.dispatchEvent(pointer('pointerdown',60,90));window.dispatchEvent(pointer('pointermove',80,90));window.dispatchEvent(pointer('pointerup',80,90));});
    expect(useDoc.getState().doc.design.coverCaptionPlacement).toEqual({x:35,y:30,widthMm:45});
  });
  it('cancels a native resize without persisting placement or changing caption text',()=>{
    act(()=>root.render(<CaptionProof/>));
    act(()=>{host.querySelector<HTMLElement>('.hero-caption-resize--right')!.dispatchEvent(pointer('pointerdown',170,90));window.dispatchEvent(pointer('pointermove',210,90));window.dispatchEvent(pointer('pointercancel',210,90));});
    expect(floating()).toBeNull();expect(useDoc.getState().doc.design.heroCaptionPlacement).toBeUndefined();
    expect(useDoc.temporal.getState().pastStates).toHaveLength(0);expect(source().textContent).toBe('Exact authored hero caption.');
  });
  it('leaves the native caption slot unchanged until a deliberate drag and commits only once',()=>{
    act(()=>root.render(<CaptionProof/>));
    expect(floating()).toBeNull();expect(source().textContent).toBe('Exact authored hero caption.');
    act(()=>{source().dispatchEvent(pointer('pointerdown',60,90));window.dispatchEvent(pointer('pointermove',61,91));window.dispatchEvent(pointer('pointerup',61,91));});
    expect(floating()).toBeNull();expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
    act(()=>{source().dispatchEvent(pointer('pointerdown',60,90));window.dispatchEvent(pointer('pointermove',100,150));});
    expect(useDoc.getState().doc.design.heroCaptionPlacement).toBeUndefined();
    expect(floating()?.parentElement?.className).toBe('page');
    expect(source().dataset.heroCaptionPlaceholder).toBe('true');
    act(()=>window.dispatchEvent(pointer('pointermove',140,170)));
    expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
    act(()=>window.dispatchEvent(pointer('pointerup',140,170)));
    expect(useDoc.getState().doc.design.heroCaptionPlacement).toEqual({x:60,y:70,widthMm:60});
    expect(useDoc.getState().doc.meta.heroCaption).toBe('Exact authored hero caption.');
    expect(useDoc.temporal.getState().pastStates).toHaveLength(1);
    act(()=>useDoc.temporal.getState().undo());
    expect(floating()).toBeNull();expect(source().dataset.heroCaptionPlaceholder).toBeUndefined();
    act(()=>useDoc.temporal.getState().redo());
    expect(floating()?.style.left).toBe('60mm');
  });
  it('cancels a new drag without leaving a floating duplicate or an undo entry',()=>{
    act(()=>root.render(<CaptionProof/>));
    act(()=>{source().dispatchEvent(pointer('pointerdown',60,90));window.dispatchEvent(pointer('pointermove',160,190));});
    expect(floating()).not.toBeNull();
    act(()=>window.dispatchEvent(pointer('pointercancel',160,190)));
    expect(floating()).toBeNull();expect(useDoc.getState().doc.design.heroCaptionPlacement).toBeUndefined();
    expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
  });
  it('cancels an existing free position and preserves saved geometry',()=>{
    useDoc.getState().doc.design.heroCaptionPlacement={x:25,y:40,widthMm:35};
    act(()=>root.render(<CaptionProof/>));
    act(()=>{floating()!.dispatchEvent(pointer('pointerdown',65,105));window.dispatchEvent(pointer('pointermove',165,205));});
    act(()=>window.dispatchEvent(pointer('pointercancel',165,205)));
    expect(floating()?.style.left).toBe('25mm');expect(floating()?.style.top).toBe('40mm');
    expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
  });
  it('supports precise keyboard movement, independent cover coordinates and JSON round trips',()=>{
    act(()=>root.render(<CaptionProof cover/>));
    act(()=>source().dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',shiftKey:true,bubbles:true})));
    const saved=useDoc.getState().doc;
    expect(saved.design.coverCaptionPlacement).toEqual({x:20,y:35,widthMm:60});
    expect(saved.design.heroCaptionPlacement).toBeUndefined();
    expect(migrate(JSON.parse(JSON.stringify(saved))).design.coverCaptionPlacement).toEqual(saved.design.coverCaptionPlacement);
    const copy=cloneDocForUpdate(saved);copy.design.coverCaptionPlacement!.x=999;
    expect(saved.design.coverCaptionPlacement!.x).toBe(20);
    expect(useDoc.temporal.getState().pastStates).toHaveLength(1);
  });
  it('keeps the saved caption visible but exposes no editing in read-only mode',()=>{
    useDoc.getState().doc.design.heroCaptionPlacement={x:15,y:70,widthMm:40};
    act(()=>root.render(<CaptionProof readOnly/>));
    expect(floating()?.textContent).toBe('Exact authored hero caption.');
    expect(host.querySelector('button')).toBeNull();expect(host.querySelector('[data-movable-hero-caption]')).toBeNull();
    act(()=>{floating()!.dispatchEvent(pointer('pointerdown',50,165));window.dispatchEvent(pointer('pointermove',250,365));window.dispatchEvent(pointer('pointerup',250,365));floating()!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));});
    expect(useDoc.getState().doc.design.heroCaptionPlacement).toEqual({x:15,y:70,widthMm:40});
    expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
  });
});
