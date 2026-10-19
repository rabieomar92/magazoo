import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Toolbar } from './Toolbar';
import { exportPreviewPdf } from '../lib/pdfExport';
import { useDoc } from '../store/useDoc';
import { useProjectFile } from '../store/projectFiles';
import { usePdfPreferences } from '../store/pdfPreferences';

vi.mock('../lib/pdfExport', () => ({ exportPreviewPdf: vi.fn().mockResolvedValue(undefined) }));

it('keeps the sidebar toggle in the toolbar, with a stable accessible state',()=>{
  const onToggle=vi.fn();
  const before=useDoc.getState().doc;
  act(()=>root.render(<Toolbar onPreviewToolsHost={()=>undefined} onToggleSidebar={onToggle} sidebarCollapsed={false}/>));
  const button=host.querySelector<HTMLButtonElement>('[aria-label="Collapse sidebar"]')!;
  expect(button.closest('.toolbar')).not.toBeNull();
  expect(button.getAttribute('aria-controls')).toBe('editor-panel');
  expect(button.getAttribute('aria-expanded')).toBe('true');
  act(()=>button.click());expect(onToggle).toHaveBeenCalledOnce();
  act(()=>root.render(<Toolbar onPreviewToolsHost={()=>undefined} onToggleSidebar={onToggle} sidebarCollapsed/>));
  expect(host.querySelector('[aria-label="Expand sidebar"]')?.getAttribute('aria-expanded')).toBe('false');
  expect(useDoc.getState().doc).toBe(before);
});

let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.clearAllMocks();
  usePdfPreferences.getState().setSize('a4');
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); usePdfPreferences.getState().setSize('a4'); vi.unstubAllGlobals(); });

it.each(['a4', 'b5', 'jis-b5', 'magazine'])('exports the selected %s sheet without editing or saving the article', async size => {
  const sourceDoc = useDoc.getState().doc;
  const sourceJson = JSON.stringify(sourceDoc);
  const fileState = useProjectFile.getState();
  act(() => root.render(<Toolbar onPreviewToolsHost={() => undefined} />));

  const select = host.querySelector<HTMLSelectElement>('[aria-label="PDF page size"]')!;
  expect([...select.options].map(option => option.textContent)).toEqual([
    'A4 · 210 × 297 mm', 'B5 (ISO) · 176 × 250 mm', 'JIS B5 · 182 × 257 mm', 'Vendor B5 · 182 × 258 mm', 'Magazine · 203 × 267 mm',
  ]);
  expect(select.value).toBe('a4');
  act(() => { select.value = size; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(select.value).toBe(size);

  await act(async () => host.querySelector<HTMLButtonElement>('[aria-label="Export PDF"]')!.click());
  expect(exportPreviewPdf).toHaveBeenCalledExactlyOnceWith(sourceDoc.meta.title, undefined, size,0,false);
  expect(useDoc.getState().doc).toBe(sourceDoc);
  expect(JSON.stringify(useDoc.getState().doc)).toBe(sourceJson);
  expect(useProjectFile.getState()).toBe(fileState);
});

it('remembers the selected paper size across toolbar remounts without saving the document', () => {
  const before = useDoc.getState().doc;
  act(() => root.render(<Toolbar onPreviewToolsHost={() => undefined} />));
  const select = host.querySelector<HTMLSelectElement>('[aria-label="PDF page size"]')!;
  act(() => { select.value = 'magazine'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  act(() => root.render(null));
  act(() => root.render(<Toolbar onPreviewToolsHost={() => undefined} />));
  expect(host.querySelector<HTMLSelectElement>('[aria-label="PDF page size"]')!.value).toBe('magazine');
  expect(useDoc.getState().doc).toBe(before);
  expect(exportPreviewPdf).not.toHaveBeenCalled();
});

it('uses the prepared PDF export for the browser print shortcut',async()=>{
  act(()=>root.render(<Toolbar onPreviewToolsHost={()=>undefined}/>));
  await act(async()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'p',ctrlKey:true,cancelable:true})));
  expect(exportPreviewPdf).toHaveBeenCalledExactlyOnceWith(useDoc.getState().doc.meta.title,undefined,'a4',0,false);
});
