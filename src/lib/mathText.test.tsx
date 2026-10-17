import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {mathTextChildren} from './mathText';
import {jsx,Fragment} from './mathJsx/jsx-runtime';
import {runsToHtml,mathAwareWords,splitRichTextAt} from './richtext';
import {Page1} from '../paper/Page1';
import {presetFor} from '../store/presets';
import {cssVars} from './geometry';

describe('math in every printed text leaf',()=>{
  it.each(['$E = mc^2$','$$E = mc^2$$','\\(E = mc^2\\)','\\[E = mc^2\\]'])('never splits a formula %s into stacked title words or page fragments',formula=>{
    expect(mathAwareWords('Physics '+formula+' today')).toEqual(['Physics',formula,'today']);
    expect(splitRichTextAt('Before '+formula+' after',10)).toEqual({head:'Before '+formula,tail:' after'});
  });
  it.each(['$E=mc^2$','$$E=mc^2$$','\\(E=mc^2\\)','\\[E=mc^2\\]'])('renders %s consistently in raw and rich text',source=>{
    expect(renderToStaticMarkup(<>{mathTextChildren('Before '+source+' after')}</>)).toContain('class="katex"');
    expect(runsToHtml('Before '+source+' after')).toContain('class="katex"');
  });
  it('keeps plain text, unmatched delimiters and unsafe text literal',()=>{
    expect(mathTextChildren('Plain title')).toBe('Plain title');
    expect(mathTextChildren('Cost $5')).toBe('Cost $5');
    expect(renderToStaticMarkup(<>{mathTextChildren('<script>bad</script> $x$')}</>)).toContain('&lt;script&gt;');
  });
  it('handles fragments but never rewrites attributes or input values',()=>{
    expect(renderToStaticMarkup(jsx(Fragment,{children:'$x^2$'}))).toContain('class="katex"');
    expect(renderToStaticMarkup(jsx('input',{value:'$x$',readOnly:true}))).toContain('value="$x$"');
    expect(renderToStaticMarkup(jsx('a',{href:'https://example.com/$x$',children:'$x$'}))).toContain('href="https://example.com/$x$"');
  });
  it('renders metadata equations before article measurement without changing source',()=>{
    const doc=presetFor('paper-1');for(const key of ['title','subtitle','author','affiliation','categoryLabel'] as const)doc.meta[key]='$E=mc^2$';
    const before=JSON.stringify(doc),host=document.createElement('div');host.innerHTML=renderToStaticMarkup(<Page1 doc={doc} vars={cssVars(doc.design)} pieces={[]}/>);
    for(const target of ['meta-title','meta-subtitle','meta-author','meta-affiliation','meta-category'])expect(host.querySelector(`[data-editor-target="${target}"] .katex`),target).not.toBeNull();
    expect(JSON.stringify(doc)).toBe(before);
  });
});
