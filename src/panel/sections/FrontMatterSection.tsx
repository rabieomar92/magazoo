import { useDoc } from '../../store/useDoc';
import { uid, type FrontMatter } from '../../schema/document';
import { emptyFrontMatter } from '../../store/frontMatter';
import { ALL_FONTS, fontOptions } from '../../lib/fonts';
import { LabeledInput, LabeledTextarea, LabeledNumber, LabeledColor, LabeledSelect, Section, RowButtons } from '../Field';
import { ImagePicker } from './HeroSection';
import { BodySection } from './BodySection';

export function FrontMatterContent() {
  const doc = useDoc(s => s.doc);
  const update = useDoc(s => s.update);
  const content = doc.frontMatter ?? emptyFrontMatter();
  const dean = doc.templateId === 'frontmatter-dean';
  const contents = doc.templateId === 'frontmatter-contents';
  const change = (fn: (f: FrontMatter) => void) => update(d => { d.frontMatter ??= emptyFrontMatter(); fn(d.frontMatter); });
  const field = (key: 'aboutTitle' | 'about' | 'noteTitle' | 'note' | 'contact', value: string) => change(f => { f[key] = value; });
  return <>
    <Section title="Publication details">
      <LabeledInput editorTarget="meta-volume" label="Issue / date" value={doc.meta.volume ?? ''} onChange={volume => update(d => { d.meta.volume = volume; })} />
      {dean && <LabeledInput label="Sign-off" value={content.signoff ?? ''} onChange={v => change(f => {f.signoff=v;})} />}
      <LabeledInput editorTarget="meta-photo-credit" label="Feature photo credit" value={doc.meta.photoCredit ?? ''} onChange={v => update(d => {d.meta.photoCredit=v;})} />
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
    <Section title={doc.templateId === 'frontmatter-board' ? 'About the publication' : 'Feature note'} editorTarget="fm-note">
      <LabeledInput label="Heading" value={doc.templateId === 'frontmatter-board' ? content.aboutTitle : content.noteTitle} onChange={v => field(doc.templateId === 'frontmatter-board' ? 'aboutTitle' : 'noteTitle',v)} />
      <LabeledTextarea rows={6} label="Text" value={doc.templateId === 'frontmatter-board' ? content.about : content.note} onChange={v => field(doc.templateId === 'frontmatter-board' ? 'about' : 'note',v)} />
    </Section>
  </>;
}

export function FrontMatterImages() {
  const dean = useDoc(s => s.doc.templateId === 'frontmatter-dean');
  const contents = useDoc(s => s.doc.templateId === 'frontmatter-contents');
  return <>
    {dean && <ImagePicker slot="hero" title="Dean’s portrait" blurb="An optional portrait beside the dean’s name. Upload your own photograph." />}
    <ImagePicker slot="cover" title={dean ? 'Issue / cover image' : 'Feature image'} blurb="Replace the sample science artwork with your own photograph. Zoom and shift adjust its framing." />
    {contents && <ImagePicker slot="hero" title="Second feature image" blurb="Optional supporting photograph below the feature note." />}
  </>;
}

export function FrontMatterDesign() {
  const doc = useDoc(s => s.doc);
  const update = useDoc(s => s.update);
  return <>
    <Section title="Page & typography" editorTarget="design-topbar">
      <p className="hint">A dedicated editorial grid. Longer copy creates continuation pages; line spacing is never stretched to fill a page.</p>
      <LabeledNumber label="Top bar margin" unit="mm" min={0} max={25} value={doc.design.topBarOffset ?? 10} onChange={v => update(d => {d.design.topBarOffset = Math.max(0,Math.min(25,v));})} />
      <LabeledNumber label="Page margin" unit="mm" min={10} max={22} value={doc.design.margin} onChange={v => update(d => {d.design.margin = Math.max(10,Math.min(22,v));})} />
      <LabeledNumber label="Image height" unit="mm" min={25} max={90} value={doc.design.heroHeight} onChange={v => update(d => {d.design.heroHeight = Math.max(25,Math.min(90,v));})} />
      <LabeledSelect label="Display font" value={doc.design.fontDisplay} options={fontOptions(ALL_FONTS)} onChange={v => update(d => {d.design.fontDisplay=v;})} />
      <LabeledSelect label="Body font" value={doc.design.fontBody} options={fontOptions(ALL_FONTS)} onChange={v => update(d => {d.design.fontBody=v; d.design.fontSubtitle=v;})} />
      {(['title','subtitle','body'] as const).map(key => <LabeledNumber key={key} label={`${key[0].toUpperCase()+key.slice(1)} size`} unit="pt" min={key==='title'?20:8} max={key==='title'?48:16} value={doc.design.sizes[key]} onChange={v => update(d=>{d.design.sizes[key]=Math.max(key==='title'?20:8,Math.min(key==='title'?48:16,v));})} />)}
    </Section>
    <Section title="Colour palette">
      <LabeledColor label="Paper" value={doc.design.paperBg ?? '#ffffff'} onChange={v => update(d=>{d.design.paperBg=v;})} />
      <LabeledColor label="Text" value={doc.design.colors.ink} onChange={v => update(d=>{d.design.colors.ink=v;})} />
      <LabeledColor label="Accent" value={doc.design.colors.accent} onChange={v => update(d=>{d.design.colors.accent=v;})} />
      <LabeledColor label="Top bar" value={doc.design.barColor ?? doc.design.colors.accent} onChange={v => update(d=>{d.design.barColor=v;})} />
    </Section>
  </>;
}
