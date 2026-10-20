import {it,expect} from 'vitest';
import {photoPanelPosition} from './photoPanelPosition';
it('docks outside a photograph so its bottom polygon handle remains reachable',()=>{
 expect(photoPanelPosition({left:850,right:1206,top:161,bottom:798},360,240,1707,960)).toEqual({left:1218,top:161});
});
it('uses the other side or above when right-side space is unavailable',()=>{
 expect(photoPanelPosition({left:500,right:900,top:300,bottom:700},360,200,960,800)).toEqual({left:128,top:300});
 expect(photoPanelPosition({left:20,right:600,top:300,bottom:700},360,200,632,800)).toEqual({left:20,top:88});
});
