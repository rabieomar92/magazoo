import {afterEach,describe,expect,it,vi} from 'vitest';
import {registerPublicationPrint} from './nativePrint';
import {PDF_PAGE_SIZES} from './pdfPageSize';
const cleanups:(()=>void)[]=[];
afterEach(()=>{cleanups.splice(0).forEach(cleanup=>cleanup());document.body.innerHTML='';document.head.querySelectorAll('[data-native-test]').forEach(node=>node.remove());});
describe('one publication print path',()=>{
  it('routes Control/Command+P through prepared export, ignoring plain P and key repeat',()=>{
    const shortcut=vi.fn();cleanups.push(registerPublicationPrint({source:()=>null,size:'b5',shortcut}));
    for(const init of [{key:'p',ctrlKey:true},{key:'P',metaKey:true}]){
      const event=new KeyboardEvent('keydown',{...init,cancelable:true});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);
    }
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'p'}));window.dispatchEvent(new KeyboardEvent('keydown',{key:'p',ctrlKey:true,repeat:true}));
    expect(shortcut).toHaveBeenCalledTimes(2);
  });
  it.each(['a4','b5','magazine'] as const)('uses exact native %s sheets for browser-menu print without altering the source or leaking print CSS',size=>{
    const {width,height}=PDF_PAGE_SIZES[size];
    const app=document.createElement('main');app.id='publication-app';app.innerHTML=`<div class="paper-scroll"><div class="pages"><div class="page" data-page-width-mm="${width}" data-page-height-mm="${height}"><h1>Title</h1><p>Unchanged article</p><figcaption>Caption</figcaption><button data-editor-only>Move</button></div></div></div>`;document.body.append(app);
    const source=app.querySelector<HTMLElement>('.pages')!,before=app.outerHTML,head=document.head.innerHTML;
    cleanups.push(registerPublicationPrint({source:()=>source,size,shortcut:()=>{}}));window.dispatchEvent(new Event('beforeprint'));
    const clone=document.querySelector<HTMLElement>('[data-native-print-root]')!;
    expect(clone.querySelector('#publication-app .paper-scroll .pages .page')??clone.querySelector('.paper-scroll .pages .page')).not.toBeNull();
    expect(clone.querySelector('.pdf-export-page')?.textContent).toBe('TitleUnchanged articleCaption');
    expect(clone.querySelector('[data-editor-only]')).toBeNull();
    expect(document.head.textContent).toContain(`size: ${width}mm ${height}mm`);
    expect(document.head.textContent).toContain('visibility:hidden !important');
    expect(document.head.textContent).not.toContain('body > :not([data-native-print-root]) { display:none');
    expect(app.outerHTML).toBe(before);
    window.dispatchEvent(new Event('afterprint'));expect(document.querySelector('[data-native-print-root]')).toBeNull();expect(document.head.innerHTML).toBe(head);expect(app.outerHTML).toBe(before);
  });
  it('prints an instruction rather than a stale or overflowing publication',()=>{
    const source=document.createElement('div');source.innerHTML='<div class="page" data-layout-overflow="true">Do not print clipped content</div>';document.body.append(source);
    cleanups.push(registerPublicationPrint({source:()=>source,size:'a4',shortcut:()=>{}}));window.dispatchEvent(new Event('beforeprint'));
    expect(document.querySelector('[data-native-print-root]')?.textContent).toContain('use Export PDF');
    expect(document.querySelector('[data-native-print-root] .page')).toBeNull();
  });
  it('maintains issue reading order, language, counters and cross-article page breaks',()=>{
    const source=document.createElement('section');source.innerHTML='<article><div class="pages" lang="ms"><div class="page">One<ol class="references"><li>Source one</li></ol></div></div></article><article><div class="pages"><div class="page">Two</div></div></article>';document.body.append(source);const before=source.outerHTML;
    cleanups.push(registerPublicationPrint({source:()=>source,size:'a4',issue:true,shortcut:()=>{}}));window.dispatchEvent(new Event('beforeprint'));
    const sheets=[...document.querySelectorAll<HTMLElement>('[data-native-print-root] .pdf-export-page')];
    expect(sheets).toHaveLength(2);expect(sheets.map(sheet=>sheet.style.breakAfter)).toEqual(['page','auto']);
    expect(sheets[0].closest('[lang]')?.getAttribute('lang')).toBe('ms');expect(sheets[0].querySelector('li')?.getAttribute('data-pdf-ref-index')).toBe('1');
    expect(source.outerHTML).toBe(before);
  });
});
