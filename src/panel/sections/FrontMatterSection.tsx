import { useDoc } from '../../store/useDoc';
import { uid, type FrontMatter } from '../../schema/document';
import { emptyFrontMatter } from '../../store/frontMatter';
import { ALL_FONTS, fontOptions } from '../../lib/fonts';
import { LabeledInput, LabeledTextarea, LabeledNumber, LabeledColor, LabeledSelect, SegmentField, Section, RowButtons, Toggle } from '../Field';
import { ImagePicker } from './HeroSection';
import { BodySection } from './BodySection';
import { SignatureSection } from './SignatureSection';

export function FrontMatterContent() {
  const doc = useDoc(s => s.doc);
  const update = useDoc(s => s.update);
  const content = doc.frontMatter ?? emptyFrontMatter();
  const dean = doc.templateId === 'frontmatter-dean';
  const contents = doc.templateId === 'frontmatter-contents';
  const board = doc.templateId === 'frontmatter-board';
  const change = (fn: (f: FrontMatter) => void) => update(d => { d.frontMatter ??= emptyFrontMatter(); fn(d.frontMatter); });
  const field = (key: 'aboutTitle' | 'about' | 'noteTitle' | 'note' | 'contact', value: string) => change(f => { f[key] = value; });
  return <>
    <Section title={board ? 'Publication contact' : 'Publication details'}>
      {!board && <LabeledInput editorTarget="meta-volume" label="Issue / date" value={doc.meta.volume ?? ''} onChange={volume => update(d => { d.meta.volume = volume; })} />}
      {dean && <LabeledInput label="Sign-off" value={content.signoff ?? ''} onChange={v => change(f => {f.signoff=v;})} />}
      {!board && <LabeledInput editorTarget="meta-photo-credit" label="Feature photo credit" value={doc.meta.photoCredit ?? ''} onChange={v => update(d => {d.meta.photoCredit=v;})} />}
      {board && <LabeledInput editorTarget="fm-contact" label="Publication contact / website" value={content.contact} onChange={v => field('contact',v)} />}
    </Section>
    {dean ? <BodySection allowEquations={false} /> : <Section title={contents ? 'Contents entries' : 'Board roles & names'}>
      <p className="hint">{contents ? 'Enter the printed article page numbers. Entries flow in reading order onto extra pages when needed.' : 'Add one group per role. Put each person on a new line. Sample names are placeholders.'}</p>
      {content.entries.map((entry, index) => <Section key={entry.id} title={`${contents ? 'Entry' : 'Group'} ${index + 1}`} editorTarget={`fm-entry-${entry.id}`}>
        <div className="list-item-head"><span className="hint">{entry.title || 'Untitled'}</span><RowButtons disableUp={index === 0} disableDown={index === content.entries.length - 1}
          onUp={() => change(f => { [f.entries[index-1],f.entries[index]] = [f.entries[index],f.entries[index-1]]; })}
          onDown={() => change(f => { [f.entries[index+1],f.entries[index]] = [f.entries[index],f.entries[index+1]]; })}
          onRemove={() => change(f => { f.entries.splice(index,1); })} /></div>
        {contents && <LabeledInput label="Article page" value={entry.page ?? ''} onChange={v => change(f => { f.entries[index].page = v; })} />}
        <LabeledInput label={contents ? 'Section / article title' : 'Role / group'} value={entry.title} onChange={v => change(f => { f.entries[index].title = v; })} />
        <LabeledTextarea rows={3} label={contents ? 'Description / articles' : 'Names & affiliations'} value={entry.text} onChange={v => change(f => { f.entries[index].text = v; })} />
      </Section>)}
      <button className="add-btn" onClick={() => change(f => { f.entries.push({id:uid(),title:contents ? 'New article' : 'New role',text:'',page:contents ? '1' : undefined}); })}>+ Add {contents ? 'contents entry' : 'board group'}</button>
    </Section>}
    <Section title={doc.templateId === 'frontmatter-board' ? 'About the publication' : dean ? 'In this issue sidebar' : 'Feature note'} editorTarget="fm-note">
      {dean && <p className="hint">This appears with the magazine cover in the right column. Use it for a short editor-in-chief introduction to the issue.</p>}
      <LabeledInput label={dean ? 'Sidebar heading' : 'Heading'} value={doc.templateId === 'frontmatter-board' ? content.aboutTitle : content.noteTitle} onChange={v => field(doc.templateId === 'frontmatter-board' ? 'aboutTitle' : 'noteTitle',v)} />
      <LabeledTextarea rows={6} label={dean ? 'Issue summary' : 'Text'} value={doc.templateId === 'frontmatter-board' ? content.about : content.note} onChange={v => field(doc.templateId === 'frontmatter-board' ? 'about' : 'note',v)} />
    </Section>
  </>;
}

export function FrontMatterImages() {
  const doc = useDoc(s => s.doc);
  const update = useDoc(s => s.update);
  const dean = useDoc(s => s.doc.templateId === 'frontmatter-dean');
  const contents = useDoc(s => s.doc.templateId === 'frontmatter-contents');
  const board = useDoc(s => s.doc.templateId === 'frontmatter-board');
  const aboutParagraphs = (doc.frontMatter?.about ?? '').split(/\n\s*\n/u);
  const logoPosition = Math.max(0,Math.min(aboutParagraphs.length,doc.frontMatter?.logoAfterParagraph ?? Math.max(0,aboutParagraphs.length-1)));
  const logoWrap = doc.frontMatter?.logoWrap ?? 'end';
  return <>
    {dean && <ImagePicker slot="hero" title="Dean’s portrait" blurb="An optional portrait beside the dean’s name. Upload your own photograph." thumbAspectRatio="20 / 27" />}
    <ImagePicker slot="cover" title={dean ? 'Magazine front cover' : board ? 'Bleed hero image' : 'Feature image'} fit={dean ? 'contain' : 'cover'} blurb={dean ? 'Shown beneath “In this issue” in the right column. At 1× the complete cover is visible.' : board ? 'The main editorial photograph runs to both page edges. Zoom and shift adjust its framing.' : 'Replace the sample science artwork with your own photograph. Zoom and shift adjust its framing.'} />
    {dean && <SignatureSection />}
    {contents && <ImagePicker slot="hero" title="Second feature image" blurb="Optional supporting photograph below the feature note." />}
    {board && <ImagePicker slot="frontmatter-logo" title="School of Physics logo" blurb="Upload the official School of Physics logo. It flows with the About text instead of being pinned to the page, so copy can reflow naturally through one, two or three columns." fit="contain" thumbAspectRatio="3 / 1" />}
    {board && <Section title="Logo in text flow" editorTarget="image-logo">
      <p className="hint">The logo participates in the About copy like an editorial image. It moves naturally when copy or column count changes; it is never pinned to a page coordinate.</p>
      <LabeledSelect label="Position in copy" value={String(logoPosition)}
        options={[
          {value:'0',label:'Before paragraph 1'},
          ...aboutParagraphs.map((_,index)=>({value:String(index+1),label:index===aboutParagraphs.length-1 ? `After paragraph ${index+1} · end` : `After paragraph ${index+1}`})),
        ]}
        onChange={value=>update(d=>{d.frontMatter ??= emptyFrontMatter(); d.frontMatter.logoAfterParagraph=Number(value);})} />
      <LabeledNumber label="Logo width" unit="mm" min={8} max={40} step={1} value={doc.frontMatter?.logoWidth ?? 18}
        onChange={value => update(d=>{d.frontMatter ??= emptyFrontMatter(); d.frontMatter.logoWidth=Math.max(8,Math.min(40,value));})} />
      <SegmentField<'block'|'start'|'end'> label="Text wrapping" value={logoWrap}
        options={[{value:'block',label:'Above & below'},{value:'start',label:'Wrap · start'},{value:'end',label:'Wrap · end'}]}
        onChange={value=>update(d=>{d.frontMatter ??= emptyFrontMatter(); d.frontMatter.logoWrap=value;})} />
      {logoWrap === 'block' && <SegmentField<'start'|'center'|'end'> label="Block alignment" value={doc.frontMatter?.logoAlign ?? 'center'}
        options={[{value:'start',label:'Start'},{value:'center',label:'Centre'},{value:'end',label:'End'}]}
        onChange={value=>update(d=>{d.frontMatter ??= emptyFrontMatter(); d.frontMatter.logoAlign=value;})} />}
      <p className="hint">Start and end follow the reading direction, so the same setting remains correct in Arabic.</p>
    </Section>}
  </>;
}

export function FrontMatterDesign() {
  const doc = useDoc(s => s.doc);
  const update = useDoc(s => s.update);
  const board = doc.templateId === 'frontmatter-board';
  const dean = doc.templateId === 'frontmatter-dean';
  return <>
    <Section title="Page & typography" editorTarget="design-topbar">
      <p className="hint">{board ? 'The photograph reaches the top and both side trim edges. The masthead floats over it without creating a gap.' : 'A dedicated editorial grid. Longer copy creates continuation pages; line spacing is never stretched to fill a page.'}</p>
      {board && <Toggle
        label="Show top bar"
        checked={doc.design.showTopBar !== false}
        onChange={visible => update(d => { d.design.showTopBar = visible; })}
      />}
      {board && <SegmentField<1 | 2 | 3>
        label="About text columns"
        value={doc.design.frontMatterAboutColumns ?? 3}
        options={[
          { value: 1, label: '1 column' },
          { value: 2, label: '2 columns' },
          { value: 3, label: '3 columns' },
        ]}
        onChange={columns => update(d => { d.design.frontMatterAboutColumns = columns; })}
      />}
      {board && <p className="hint">Choose fewer columns for longer lines and easier reading. The editorial roles keep their separate compact grid.</p>}
      {dean && <>
        <LabeledNumber label="Gap above category" unit="mm" min={0} max={40} step={0.5} value={doc.design.deanCategoryTopGap ?? 0}
          onChange={value=>update(d=>{d.design.deanCategoryTopGap=Math.max(0,Math.min(40,value));})} />
        <LabeledNumber label="Gap below title" unit="mm" min={0} max={35} step={0.5} value={doc.design.deanTitleBottomGap ?? (doc.meta.subtitle ? 4 : 8)}
          onChange={value=>update(d=>{d.design.deanTitleBottomGap=Math.max(0,Math.min(35,value));})} />
        <p className="hint">These controls preserve the category, headline and identity hierarchy while allowing vertical adjustment.</p>
      </>}
      <LabeledNumber label="Top bar margin" unit="mm" min={0} max={25} value={doc.design.topBarOffset ?? 10} onChange={v => update(d => {d.design.topBarOffset = Math.max(0,Math.min(25,v));})} />
      <LabeledNumber label="Page margin" unit="mm" min={10} max={22} value={doc.design.margin} onChange={v => update(d => {d.design.margin = Math.max(10,Math.min(22,v));})} />
      {!dean && <LabeledNumber label={board ? 'Bleed image height' : 'Image height'} unit="mm" min={25} max={board ? 180 : 90} value={doc.design.heroHeight} onChange={v => update(d => {d.design.heroHeight = Math.max(25,Math.min(board ? 180 : 90,v));})} />}
      <SegmentField<'left' | 'right'>
        label="Masthead & footer side"
        value={doc.design.barSide ?? 'left'}
        options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
        onChange={v => update(d => { d.design.barSide = v; })}
      />
      <p className="hint">The masthead and page number start on this side; the footer text sits opposite. Both alternate sides on later pages.</p>
      <LabeledSelect label="Display font" value={doc.design.fontDisplay} options={fontOptions(ALL_FONTS)} onChange={v => update(d => {d.design.fontDisplay=v;})} />
      <LabeledSelect label="Body font" value={doc.design.fontBody} options={fontOptions(ALL_FONTS)} onChange={v => update(d => {d.design.fontBody=v; d.design.fontSubtitle=v;})} />
      {(['title','subtitle','body'] as const).map(key => {
        const min = board ? (key === 'title' ? 12 : key === 'subtitle' ? 6 : 5.5) : (key === 'title' ? 20 : 8);
        const max = board ? (key === 'title' ? 32 : key === 'subtitle' ? 14 : 11) : (key === 'title' ? 48 : 16);
        return <LabeledNumber key={key} label={`${key[0].toUpperCase()+key.slice(1)} size`} unit="pt" min={min} max={max} step={0.1} value={doc.design.sizes[key]} onChange={v => update(d=>{d.design.sizes[key]=Math.max(min,Math.min(max,v));})} />;
      })}
    </Section>
    <Section title="Colour palette">
      <LabeledColor label="Paper" value={doc.design.paperBg ?? '#ffffff'} onChange={v => update(d=>{d.design.paperBg=v;})} />
      <LabeledColor label="Text" value={doc.design.colors.ink} onChange={v => update(d=>{d.design.colors.ink=v;})} />
      <LabeledColor label="Accent" value={doc.design.colors.accent} onChange={v => update(d=>{d.design.colors.accent=v;})} />
      <LabeledColor label="Top bar" value={doc.design.barColor ?? doc.design.colors.accent} onChange={v => update(d=>{d.design.barColor=v;})} />
      <LabeledColor label="Masthead background" value={doc.design.barTagColor ?? '#bfbfbf'} onChange={v => update(d=>{d.design.barTagColor=v;})} />
      <LabeledColor label="Masthead text" value={doc.design.barTagInk ?? '#111418'} onChange={v => update(d=>{d.design.barTagInk=v;})} />
    </Section>
  </>;
}
