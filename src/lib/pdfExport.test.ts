import { describe, expect, it, vi } from 'vitest';
import { clonePages, cssImageUrls, PDF_EXPORT_CSS, waitForStablePreview } from './pdfExport';

describe('PDF export layout contract', () => {
  it('preserves grid and flex page layouts', () => {
    const source=document.createElement('div');
    source.innerHTML='<div class="page gallery" style="display:grid"></div><div class="page" style="display:flex"></div>';
    document.body.append(source);
    const target=document.implementation.createHTMLDocument('print');
    clonePages(source,target);
    expect(Array.from(target.querySelectorAll<HTMLElement>('.page')).map(p=>p.style.display)).toEqual(['grid','flex']);
    source.remove();
  });
  it('keeps fractional column dimensions rather than rounded offset sizes', () => {
    const source = document.createElement('div');
    source.innerHTML = '<div class="page"><div style="column-count:2;column-fill:auto;box-sizing:border-box;width:472.4375px;height:728.5625px;padding:2px">Text</div></div>';
    const columns = source.querySelector('.page > div')!;
    Object.defineProperty(columns, 'offsetWidth', { value: 472 });
    Object.defineProperty(columns, 'offsetHeight', { value: 729 });
    document.body.append(source);
    const target = document.implementation.createHTMLDocument('print');
    clonePages(source, target);
    const cloned = target.querySelector<HTMLElement>('.page > div')!;
    expect(cloned.style.width).toBe('472.4375px');
    expect(cloned.style.height).toBe('728.5625px');
    expect(cloned.style.boxSizing).toBe('border-box');
    source.remove();
  });
  it('preserves the exact border box and restores preview zoom', () => {
    const source=document.createElement('div');
    source.style.setProperty('transform','scale(0.64)','important');
    source.innerHTML='<div class="page"><div style="column-count:2;column-fill:auto;transform:none;width:344.906px;height:200.123px">Content</div></div>';
    const column=source.querySelector<HTMLElement>('.page > div')!;
    Object.defineProperty(column,'offsetHeight',{value:200});
    column.getBoundingClientRect=()=>{
      expect(source.style.transform).toBe('none');
      return {width:344.90625,height:200.125} as DOMRect;
    };
    document.body.append(source);
    const target=document.implementation.createHTMLDocument('print');
    clonePages(source,target);
    const result=target.querySelector<HTMLElement>('.page > div')!;
    expect(result.style.width).toBe('344.90625px');
    expect(result.style.height).toBe('200.125px');
    expect(result.style.boxSizing).toBe('border-box');
    expect(source.style.transform).toBe('scale(0.64)');
    expect(source.style.getPropertyPriority('transform')).toBe('important');
    source.remove();
  });
  it('does not convert balanced auto-height text bands into fixed-height columns',()=>{
    const source=document.createElement('div');
    source.innerHTML='<div class="page"><div style="column-count:2;column-fill:balance">Text</div></div>';
    const column=source.querySelector<HTMLElement>('.page > div')!;
    Object.defineProperty(column,'offsetHeight',{value:345});
    column.getBoundingClientRect=()=>({width:672.75,height:344.90625} as DOMRect);
    document.body.append(source);
    const target=document.implementation.createHTMLDocument('print');clonePages(source,target);
    const result=target.querySelector<HTMLElement>('.page > div')!;
    expect(result.style.height).toBe('');expect(result.style.columnFill).toBe('balance');source.remove();
  });
  it('prints only visible sheets and retains Arabic and drop-cap settings',()=>{
    const source=document.createElement('div');
    source.className='pages pages--spread pages--rtl drop-caps-off';source.lang='ar';
    source.innerHTML='<div class="page news-page">First</div><div class="page news-page">Second</div><div class="news-measure"><div class="page">Hidden measure</div></div>';
    document.body.append(source);
    const target=document.implementation.createHTMLDocument('print');
    clonePages(source,target);
    const pages=target.querySelector('.pages')!;
    expect(pages.children.length).toBe(2);
    expect(pages.textContent).toBe('FirstSecond');
    expect(pages.getAttribute('lang')).toBe('ar');
    expect(pages.classList.contains('pages--rtl')).toBe(true);
    expect(pages.classList.contains('drop-caps-off')).toBe(true);
    expect(pages.classList.contains('pages--spread')).toBe(false);
    source.remove();
  });
  it('prints the live page DOM instead of raster snapshots', () => {
    expect(PDF_EXPORT_CSS).toContain('.pdf-export-pages');
    expect(PDF_EXPORT_CSS).toContain('.pdf-export-page');
    expect(PDF_EXPORT_CSS).not.toContain('.pdf-page-snapshot');
  });

  it('maps every page to exact portrait A4 geometry', () => {
    expect(PDF_EXPORT_CSS).toContain('width: 210mm !important');
    expect(PDF_EXPORT_CSS).toContain('height: 297mm !important');
  });

  it('finds CSS background resources used by gallery and magazine pages', () => {
    expect(
      cssImageUrls(
        'linear-gradient(#000, #fff), url("data:image/png;base64,abc"), url( /photo.webp )',
      ),
    ).toEqual(['data:image/png;base64,abc', '/photo.webp']);
  });
});

describe('PDF preview readiness',()=>{
  it('waits for pending edits and a full quiet layout interval',async()=>{
    vi.useFakeTimers();
    const container=document.createElement('div');container.className='paper-scroll';container.dataset.previewPending='true';
    const source=document.createElement('div');container.append(source);document.body.append(container);
    try{
      const done=vi.fn();const ready=waitForStablePreview(source).then(done);
      await vi.advanceTimersByTimeAsync(1500);expect(done).not.toHaveBeenCalled();
      delete container.dataset.previewPending;
      await vi.advanceTimersByTimeAsync(800);source.textContent='latest edit';
      await vi.advanceTimersByTimeAsync(800);expect(done).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(600);await ready;expect(done).toHaveBeenCalledOnce();
    }finally{container.remove();vi.useRealTimers();}
  });
  it('fails clearly when the preview is removed during preparation',async()=>{
    vi.useFakeTimers();const source=document.createElement('div');document.body.append(source);
    try{
      const check=expect(waitForStablePreview(source)).rejects.toThrow('preview changed');source.remove();
      await vi.advanceTimersByTimeAsync(100);await check;
    }finally{source.remove();vi.useRealTimers();}
  });
});
