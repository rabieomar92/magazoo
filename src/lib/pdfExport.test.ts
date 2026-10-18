import { describe, expect, it, vi } from 'vitest';
import { clonePages, cssImageUrls, PDF_EXPORT_CSS, pdfExportCss, waitForStablePreview,waitForPreviewResources, waitForStyles } from './pdfExport';

describe('print stylesheet readiness', () => {
  it('accepts styles that completed before listeners were installed', async () => {
    const target = document.implementation.createHTMLDocument('print');
    const link = target.createElement('link'); link.rel = 'stylesheet'; link.href = '/fonts.css';
    Object.defineProperty(link, 'sheet', { value: {} }); target.head.append(link);
    await expect(waitForStyles(target)).resolves.toBeUndefined();
  });
  it('detects cached styles becoming available without a load event', async () => {
    vi.useFakeTimers();
    try {
      const target = document.implementation.createHTMLDocument('print');
      const link = target.createElement('link'); link.rel = 'stylesheet'; link.href = '/cached.css'; target.head.append(link);
      const pending = waitForStyles(target);
      Object.defineProperty(link, 'sheet', { value: {} });
      await vi.advanceTimersByTimeAsync(50);
      await expect(pending).resolves.toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
  it('reports which stylesheet failed and cleans up its timers', async () => {
    const target = document.implementation.createHTMLDocument('print');
    const link = target.createElement('link'); link.rel = 'stylesheet'; link.href = 'https://example.test/assets/missing.css'; target.head.append(link);
    const pending = waitForStyles(target); link.dispatchEvent(new Event('error'));
    await expect(pending).rejects.toThrow('/assets/missing.css');
  });
});

describe('PDF export layout contract', () => {
  it('retains ancestor selectors, language and custom properties without copying editor UI or zoom boxes',()=>{
    const shell=document.createElement('main');shell.id='editor-context';shell.className='workspace';shell.style.setProperty('--publication-font','Arial');
    shell.innerHTML='<aside>Editor controls</aside><div class="paper-scroll" lang="ms"><div class="pages-frame" style="transform:scale(.6)"><div class="pages"><div class="page"><h1 class="title">Exact title</h1></div></div></div></div>';
    document.body.append(shell);
    const source=shell.querySelector<HTMLElement>('.pages')!,before=shell.outerHTML;
    const target=document.implementation.createHTMLDocument('print');
    clonePages(source,target);
    expect(target.querySelector('#editor-context .paper-scroll .pages-frame .pages .title')?.textContent).toBe('Exact title');
    expect(target.querySelector('#editor-context')?.getAttribute('style')).toContain('--publication-font: Arial');
    expect(target.querySelector('.paper-scroll')?.getAttribute('lang')).toBe('ms');
    expect(target.querySelector('aside')).toBeNull();
    for(const context of target.querySelectorAll<HTMLElement>('.pdf-export-context')){expect(context.style.display).toBe('contents');expect(context.style.transform).toBe('none');}
    expect(shell.outerHTML).toBe(before);shell.remove();
  });
  it('requires the author to finish the canvas border draft before exporting',async()=>{
    const source=document.createElement('div');source.innerHTML='<figure data-outline-editing="true"></figure>';
    await expect(waitForPreviewResources(source)).rejects.toThrow('Apply or cancel the image border');
  });
  it('requires the author to finish moving an image before exporting',async()=>{
    const source=document.createElement('div');source.innerHTML='<figure data-dragging="true"></figure>';
    await expect(waitForPreviewResources(source)).rejects.toThrow('Finish moving the image');
  });
  it('removes canvas-only move controls after cloning without changing publication text',()=>{
    const source=document.createElement('div');source.className='pages';
    source.innerHTML='<div class="page"><figure><button data-editor-only="true">Move image</button><figcaption>Exact caption</figcaption></figure><p>Exact article</p></div>';
    const target=document.implementation.createHTMLDocument('print');clonePages(source,target);
    expect(target.querySelector('[data-editor-only]')).toBeNull();
    expect(target.querySelector('.page')!.textContent).toBe('Exact captionExact article');
    expect(source.querySelector('button')).not.toBeNull();
  });
  it('retains inherited document language so contour hyphenation cannot change during printing',()=>{
    const owner=document.createElement('section');owner.lang='ms';owner.innerHTML='<div class="pages"><div class="page">Bahasa Melayu</div></div>';document.body.append(owner);
    const target=document.implementation.createHTMLDocument('print');
    clonePages(owner.firstElementChild as HTMLElement,target);
    expect(target.querySelector<HTMLElement>('.pages')!.lang).toBe('ms');
    owner.remove();
  });
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

  it('defaults to an A4 output sheet without overriding measured page heights', () => {
    expect(PDF_EXPORT_CSS).toContain('@page { size: 210mm 297mm; margin: 0; }');
    expect(PDF_EXPORT_CSS).toContain('width: 210mm !important');
    expect(PDF_EXPORT_CSS).not.toContain('height: 297mm !important');
  });

  it.each([
    ['a4', 210, 297], ['b5', 176, 250], ['magazine', 203, 267],
  ] as const)('sets the %s print document to the selected exact sheet size, without a conflicting A4 rule', (size, width, height) => {
    const css = pdfExportCss(size);
    expect(css).toContain(`@page { size: ${width}mm ${height}mm; margin: 0; }`);
    expect(css).toContain(`width: ${width}mm !important`);
    expect(css).not.toContain('size: A4');
    if (size !== 'a4') expect(css).not.toContain('width: 210mm');
    expect(css).not.toContain('height: 297mm');
  });

  it('clones native Magazine dimensions and columns without touching the article or its preview zoom', () => {
    const source = document.createElement('div');
    source.className = 'pages pages--spread'; source.style.transform = 'scale(0.6)';
    source.innerHTML = '<div class="page" data-page-width-mm="203" data-page-height-mm="267"><div style="column-count:2;column-fill:auto;width:260.5px;height:700.25px">Native text</div><svg><path d="M0 0L2 2" /></svg></div>';
    const column = source.querySelector<HTMLElement>('.page > div')!;
    Object.defineProperty(column, 'offsetHeight', { value: 700 });
    document.body.append(source);
    const before = source.outerHTML;
    try {
      const output = document.implementation.createHTMLDocument();
      clonePages(source, output);
      const cloned = output.querySelector<HTMLElement>('.page')!;
      expect(cloned.style.width).toBe('203mm'); expect(cloned.style.height).toBe('267mm');
      const container = output.querySelector<HTMLElement>('.pdf-export-pages')!;
      expect(container.style.width).toBe('203mm');
      expect(container.style.minWidth).toBe('203mm'); expect(container.style.transform).toBe('none');
      const clonedColumn = cloned.querySelector<HTMLElement>('div')!;
      expect(clonedColumn.style.width).toBe('260.5px'); expect(clonedColumn.style.height).toBe('700.25px');
      expect(cloned.textContent).toBe('Native text'); expect(cloned.querySelector('svg path')).not.toBeNull();
      expect(cloned.querySelector('canvas')).toBeNull(); expect(source.outerHTML).toBe(before);
    } finally { source.remove(); }
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
  it('refuses to export a caption that has no image-free position',async()=>{
    vi.useFakeTimers();const source=document.createElement('div');source.innerHTML='<div class="page"><figcaption data-caption-unplaced="true">No safe slot</figcaption></div>';document.body.append(source);
    try{
      const check=expect(waitForPreviewResources(source)).rejects.toThrow('Some content does not fit');
      await vi.advanceTimersByTimeAsync(2000);await check;
    }finally{source.remove();vi.useRealTimers();}
  });
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
