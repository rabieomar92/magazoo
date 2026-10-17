import {afterEach,describe,expect,it,vi} from 'vitest';
import {compositePrintHeroFades,verticalFadeStops} from './pdfHeroFade';
afterEach(()=>{document.body.innerHTML='';document.head.innerHTML='';vi.restoreAllMocks();});
describe('stable PDF photo fades',()=>{
  it('parses computed RGB colors without splitting their commas',()=>{
    expect(verticalFadeStops('linear-gradient(0deg, rgba(0, 0, 0, 0) 50%, rgb(0, 0, 0) 99.5%, rgb(0, 0, 0) 100%)')).toEqual({bottomUp:true,stops:[{color:'rgba(0, 0, 0, 0)',offset:.5},{color:'rgb(0, 0, 0)',offset:.995},{color:'rgb(0, 0, 0)',offset:1}]});
  });
  it.each(['to bottom','180deg'])('supports the top-hero %s direction',direction=>{
    expect(verticalFadeStops(`linear-gradient(${direction}, transparent, rgb(255, 255, 255))`)).toEqual({bottomUp:false,stops:[{color:'transparent',offset:0},{color:'rgb(255, 255, 255)',offset:1}]});
  });
  it.each(['none','radial-gradient(black, white)','linear-gradient(90deg, black, white)','linear-gradient(to top, black 80%, white 10%)'])('does not guess unsupported author gradient %s',css=>expect(verticalFadeStops(css)).toBeNull());
  function setup(){
    document.body.innerHTML='<div class="page"><figure class="article-hero article-hero--fade"><img src="original.png"><figcaption>Selectable caption</figcaption></figure><p>Searchable article text</p></div>';
    const frame=document.querySelector<HTMLElement>('figure')!,image=document.querySelector('img')!;
    vi.spyOn(window,'getComputedStyle').mockImplementation((element,pseudo)=>({
      backgroundImage:pseudo==='::after'?'linear-gradient(0deg, transparent 50%, rgb(0, 0, 0) 99.5%, rgb(0, 0, 0) 100%)':'none',
      backgroundColor:'rgb(0, 0, 0)',display:'block',content:'""',opacity:'1',borderRadius:'0px',transform:'none',objectFit:'fill',clipPath:'none',
      width:element===image?'500px':'400.125px',height:'200.25px',left:'-20.5px',top:pseudo==='::after'?'0px':'-10.25px',bottom:'0px',
    } as CSSStyleDeclaration));
    const gradient={addColorStop:vi.fn()};const context={scale:vi.fn(),fillRect:vi.fn(),drawImage:vi.fn(),createLinearGradient:vi.fn(()=>gradient),fillStyle:''};
    vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const png=vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue('data:image/png;base64,test');
    Object.defineProperty(image,'decode',{configurable:true,value:vi.fn(async()=>{})});
    return {frame,image,context,gradient,png};
  }
  it('flattens only the photo and fade at print resolution, preserving crop, pan and live caption DOM',async()=>{
    const {frame,image,context,gradient}=setup();const caption=frame.querySelector('figcaption');
    expect(await compositePrintHeroFades(document)).toBe(1);
    expect(context.drawImage).toHaveBeenCalledWith(image,-20.5,-10.25,500,200.25);
    expect(context.createLinearGradient).toHaveBeenCalledWith(0,200.25,0,0);
    expect(gradient.addColorStop).toHaveBeenCalledWith(.995,'rgb(0, 0, 0)');
    expect(frame.dataset.pdfPhotoFade).toBe('true');expect(image.src).toContain('data:image/png');
    expect(image.style.width).toBe('100%');expect(image.style.left).toBe('0px');
    expect(frame.querySelector('figcaption')).toBe(caption);expect(document.querySelector('p')!.textContent).toBe('Searchable article text');
    expect(document.head.textContent).toContain('[data-pdf-photo-fade]::after');
    expect(await compositePrintHeroFades(document)).toBe(0);
  });
  it('does not overwrite page artwork revealed through free panning',async()=>{
    const {image,png}=setup();const artwork=document.createElement('img');artwork.className='page-artwork';document.querySelector('.page')!.prepend(artwork);
    expect(await compositePrintHeroFades(document)).toBe(0);expect(image.getAttribute('src')).toBe('original.png');expect(png).not.toHaveBeenCalled();
  });
  it('fails safely if remote image permissions would produce a blank photo',async()=>{
    const {png}=setup();png.mockImplementation(()=>{throw new Error('tainted canvas');});
    await expect(compositePrintHeroFades(document)).rejects.toThrow('Import the photo directly');
  });
});
