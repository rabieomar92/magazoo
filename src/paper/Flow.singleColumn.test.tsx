import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../schema/document';
import { Flow } from './Flow';

describe('pre-paginated article columns',()=> {
  it('does not rebalance text around equations into nested columns',()=> {
    const doc=emptyDoc();
    doc.blocks=[{id:'eq',type:'equation',tex:'E=mc^2',caption:'Energy'}];
    const pieces=[{kind:'text' as const,sourceId:'p',text:'Before the equation',cont:false},{kind:'equation' as const,id:'eq'},{kind:'text' as const,sourceId:'after',text:'After the equation',cont:false}];
    const host=document.createElement('div');const root=createRoot(host);
    act(()=>root.render(<Flow doc={doc} pieces={pieces} singleColumn/>));
    expect(host.querySelectorAll('.flow-balanced-row')).toHaveLength(0);
    expect(host.querySelectorAll('.flow-eq')).toHaveLength(1);
    expect(host.querySelectorAll('p[data-source-block-id]')).toHaveLength(2);
    act(()=>root.render(<Flow doc={doc} pieces={pieces}/>));
    expect(host.querySelectorAll('.flow-balanced-row')).toHaveLength(2);
    act(()=>root.unmount());
  });
});
