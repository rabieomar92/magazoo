import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { makeFrontMatter } from '../../store/frontMatter';
import { useDoc } from '../../store/useDoc';
import { FrontMatterDesign } from './FrontMatterSection';

const numberField = (host: HTMLElement, label: string) => [...host.querySelectorAll('label')].find(
  element => element.querySelector('.field-label')?.textContent?.replace(/\s*\([^)]*\)\s*$/, '').trim() === label,
)?.querySelector<HTMLInputElement>('input[type="number"]');

const editNumber = (input: HTMLInputElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

describe('FrontMatterDesign', () => {
  it('offers an Editorial Board-only top-bar visibility control', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => {
      useDoc.setState({ doc: makeFrontMatter('frontmatter-board') });
      root.render(<FrontMatterDesign />);
    });

    const toggle = [...host.querySelectorAll('label')].find(
      label => label.querySelector('.field-label')?.textContent === 'Show top bar',
    )?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(toggle?.checked).toBe(true);

    act(() => toggle?.click());
    expect(useDoc.getState().doc.design.showTopBar).toBe(false);

    act(() => {
      useDoc.setState({ doc: makeFrontMatter('frontmatter-contents') });
    });
    expect([...host.querySelectorAll('.field-label')].some(
      label => label.textContent === 'Show top bar',
    )).toBe(false);

    act(() => root.unmount());
  });

  it('offers one, two or three columns for the Editorial Board about copy', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => {
      useDoc.setState({ doc: makeFrontMatter('frontmatter-board') });
      root.render(<FrontMatterDesign />);
    });

    const label = [...host.querySelectorAll('.field-label')].find(node => node.textContent === 'About text columns');
    const field = label?.closest('.field');
    const choices = [...(field?.querySelectorAll('button') ?? [])];
    expect(choices.map(button => button.textContent)).toEqual(['1 column','2 columns','3 columns']);
    act(() => choices[1]?.click());
    expect(useDoc.getState().doc.design.frontMatterAboutColumns).toBe(2);

    act(() => root.unmount());
  });

  it('offers bounded Dean-message spacing without exposing it on other front matter', () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    act(() => {
      useDoc.setState({ doc: makeFrontMatter('frontmatter-dean') });
      root.render(<FrontMatterDesign />);
    });
    const category = numberField(host, 'Gap above category');
    const title = numberField(host, 'Gap below title');
    expect(category).toBeTruthy(); expect(title).toBeTruthy();
    editNumber(category!, '8.5'); editNumber(title!, '13');
    expect(useDoc.getState().doc.design.deanCategoryTopGap).toBe(8.5);
    expect(useDoc.getState().doc.design.deanTitleBottomGap).toBe(13);

    act(() => useDoc.setState({ doc: makeFrontMatter('frontmatter-contents') }));
    expect(numberField(host, 'Gap above category')).toBeUndefined();
    expect(numberField(host, 'Gap below title')).toBeUndefined();
    act(() => root.unmount());
  });
});
