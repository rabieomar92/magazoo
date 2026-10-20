import {act} from 'react';import {createRoot,type Root} from 'react-dom/client';import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {emptyDoc,migrate} from '../schema/document';import {useDoc} from '../store/useDoc';import {GalleryCaptionBox} from './GalleryCaptionBox';import {PreviewReadOnly} from './PreviewReadOnly';
let host:HTMLDivElement,root:Root;
const pointer=(type:string,x:number)=>{const e=new MouseEvent(type,{bubbles:true,button:0,clientX:x});Object.defineProperty(e,'pointerId',{value:1});return e;};
function Proof({readOnly=false}:{readOnly?:boolean}){const doc=useDoc(s=>s.doc),block=doc.blocks[0];return block.type==='figure'?<PreviewReadOnly.Provider value={readOnly}><figcaption><GalleryCaptionBox block={block}><p>{block.caption}</p></GalleryCaptionBox></figcaption></PreviewReadOnly.Provider>:null;}
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(400);vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:800,height:80,right:800,bottom:80,x:0,y:0,toJSON(){}});const doc=emptyDoc();doc.templateId='gallery-1';doc.assets.a={src:'test',naturalWidth:800,naturalHeight:600};doc.blocks=[{type:'figure',id:'photo',assetId:'a',caption:'Keep original caption',span:1}];useDoc.getState().load(doc);useDoc.temporal.getState().clear();host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(()=>{act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();useDoc.getState().load(emptyDoc());});
it('narrows either side in physical mm and saves one undoable edit without changing photo or text',()=>{
 act(()=>root.render(<Proof/>));const handle=host.querySelector<HTMLElement>('.gallery-caption-resize--right')!;
 act(()=>{handle.dispatchEvent(pointer('pointerdown',300));window.dispatchEvent(pointer('pointermove',300-10*96/25.4*2));});
 expect(useDoc.temporal.getState().pastStates).toHaveLength(0);
 act(()=>window.dispatchEvent(pointer('pointerup',220)));
 const b=useDoc.getState().doc.blocks[0];expect(b.type==='figure'&&b.captionInsetRightMm).toBe(10);expect(b.type==='figure'&&b.caption).toBe('Keep original caption');
 expect(useDoc.temporal.getState().pastStates).toHaveLength(1);
 expect(migrate(JSON.parse(JSON.stringify(useDoc.getState().doc))).blocks[0]).toEqual(b);
 act(()=>useDoc.temporal.getState().undo());expect(host.querySelector<HTMLElement>('.g-caption-box')!.style.width).toMatch(/calc\(100% - 0(?:px|mm)\)/);
 act(()=>useDoc.temporal.getState().redo());const restored=useDoc.getState().doc.blocks[0];expect(restored.type==='figure'&&restored.captionInsetRightMm).toBe(10);expect(host.querySelector<HTMLElement>('.g-caption-box')!.style.width).toContain('37.795');
});
it('supports keyboard inset adjustment while leaving the opposite edge unchanged',()=>{
 act(()=>root.render(<Proof/>));act(()=>host.querySelector('.gallery-caption-resize--left')!.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true})));
 const b=useDoc.getState().doc.blocks[0];expect(b.type==='figure'&&b.captionInsetLeftMm).toBe(5);expect(b.type==='figure'&&b.captionInsetRightMm).toBeUndefined();
});
it('cancels a resize and provides no editing controls in the compiled/read-only preview',()=>{
 act(()=>root.render(<Proof/>));act(()=>{host.querySelector('.gallery-caption-resize--left')!.dispatchEvent(pointer('pointerdown',0));window.dispatchEvent(pointer('pointermove',80));window.dispatchEvent(pointer('pointercancel',80));});
 expect(useDoc.temporal.getState().pastStates).toHaveLength(0);expect(host.querySelector<HTMLElement>('.g-caption-box')!.style.marginLeft).toBe('0mm');
 act(()=>root.render(<Proof readOnly/>));expect(host.querySelector('button')).toBeNull();expect(host.textContent).toBe('Keep original caption');
});
