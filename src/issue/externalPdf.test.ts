import { expect, it, vi } from 'vitest';

const getDocument = vi.hoisted(() => vi.fn());
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument }));
import { importIssuePdf } from './externalPdf';

it('passes PDF bytes directly instead of fetching a data URL blocked by production CSP', async () => {
  getDocument.mockReturnValue({ promise: Promise.resolve({ numPages: 21 }), destroy: vi.fn() });
  const bytes = new TextEncoder().encode('%PDF-1.7\n');
  const file = { size: bytes.length, name: 'test.pdf', arrayBuffer: async () => bytes.buffer } as File;
  await expect(importIssuePdf(file)).rejects.toThrow('Import up to 20 pages');
  expect([...getDocument.mock.calls[0][0].data]).toEqual([...bytes]);
  expect(getDocument.mock.calls[0][0]).not.toHaveProperty('url');
});

it('identifies worker delivery failures without blaming the uploaded PDF', async () => {
  getDocument.mockImplementationOnce(() => ({ promise: Promise.reject(new Error('Setting up fake worker failed: Failed to fetch dynamically imported module')), destroy: vi.fn() }));
  const bytes = new TextEncoder().encode('%PDF-1.7\n');
  const file = { size: bytes.length, name: 'test.pdf', arrayBuffer: async () => bytes.buffer } as File;
  await expect(importIssuePdf(file)).rejects.toThrow('website loading problem, not a damaged PDF');
});
