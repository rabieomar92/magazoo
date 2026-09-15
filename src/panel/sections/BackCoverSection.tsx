import type { ReactNode } from 'react';
import { useDoc } from '../../store/useDoc';
import { emptyBackCover } from '../../store/backCover';
import { uid, type BackCoverDesign as BackCoverDesignSettings, type BackCoverSocialLink, type BackCoverSocialPlatform, type BackCoverTextRole, type BackCoverTextStyle } from '../../schema/document';
import { BACK_COVER_TEXT_LABELS, backCoverLayout, backCoverTextStyle, defaultBackCoverDesign } from '../../lib/backCoverDesign';
import { ALL_FONTS, fontOptions } from '../../lib/fonts';
import { LabeledColor, LabeledInput, LabeledNumber, LabeledSelect, RowButtons, Section, SegmentField, Toggle } from '../Field';
import { ImagePicker } from './HeroSection';

const SOCIAL_PLATFORM_OPTIONS: { value: BackCoverSocialPlatform; label: string }[] = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'x', label: 'X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'threads', label: 'Threads' },
  { value: 'bluesky', label: 'Bluesky' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'github', label: 'GitHub' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'discord', label: 'Discord' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'reddit', label: 'Reddit' },
  { value: 'mastodon', label: 'Mastodon' },
  { value: 'twitch', label: 'Twitch' },
  { value: 'website', label: 'Website' },
  { value: 'email', label: 'Email' },
  { value: 'rss', label: 'RSS feed' },
];

const platformLabel = (platform: BackCoverSocialPlatform) =>
  SOCIAL_PLATFORM_OPTIONS.find(option => option.value === platform)?.label ?? 'Website';

/** Convert the original two free-text footer columns into editable rows the
 * first time an older saved back cover is touched. Empty lines are treated as
 * separators, while a following URL is paired with the preceding label. */
function legacySocialLinks(text: string, side: 'left' | 'right'): BackCoverSocialLink[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const links: BackCoverSocialLink[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const label = lines[index];
    const next = lines[index + 1];
    const hasPairedUrl = !!next && (/^(?:https?:\/\/|mailto:|www\.)/i.test(next) || /\.[a-z]{2,}(?:\/|$)/i.test(next));
    const url = hasPairedUrl ? next : label;
    links.push({
      id: `legacy-social-${side}-${links.length + 1}`,
      platform: inferPlatform(`${label} ${url}`),
      label: hasPairedUrl ? label : undefined,
      url,
      side,
    });
    if (hasPairedUrl) index += 1;
  }
  return links;
}

function inferPlatform(value: string): BackCoverSocialPlatform {
  const text = value.toLowerCase();
  if (text.includes('instagram')) return 'instagram';
  if (text.includes('facebook')) return 'facebook';
  if (text.includes('linkedin')) return 'linkedin';
  if (text.includes('youtube') || text.includes('youtu.be')) return 'youtube';
  if (text.includes('tiktok')) return 'tiktok';
  if (text.includes('threads')) return 'threads';
  if (text.includes('bsky') || text.includes('bluesky')) return 'bluesky';
  if (text.includes('whatsapp') || text.includes('wa.me')) return 'whatsapp';
  if (text.includes('github')) return 'github';
  if (text.includes('telegram') || text.includes('t.me')) return 'telegram';
  if (text.includes('discord')) return 'discord';
  if (text.includes('pinterest')) return 'pinterest';
  if (text.includes('reddit')) return 'reddit';
  if (text.includes('mastodon')) return 'mastodon';
  if (text.includes('twitch')) return 'twitch';
  // Check X before the generic @ test: a handle such as "X @name" is not an
  // email address, and the paired x.com URL is the strongest signal.
  if (text.includes('x.com') || /(^|\s)x(?:\s|@|$)/.test(text)) return 'x';
  if (text.includes('mailto:') || /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(text)) return 'email';
  if (text.includes('rss')) return 'rss';
  return 'website';
}

function usableSocialLinks(content: ReturnType<typeof emptyBackCover>): BackCoverSocialLink[] {
  if (Array.isArray(content.socialLinks)) return content.socialLinks;
  return [
    ...legacySocialLinks(content.socialLeft, 'left'),
    ...legacySocialLinks(content.socialRight, 'right'),
  ];
}

/** Copy controls for the fixed back-cover lock-up. Keeping the text in a
 * dedicated object prevents a back-cover edit from changing article metadata. */
export function BackCoverContent() {
  const saved = useDoc(s => s.doc.backCover);
  const content = saved ?? emptyBackCover();
  const update = useDoc(s => s.update);
  const set = <K extends keyof typeof content>(key: K) => (value: typeof content[K]) =>
    update(d => { d.backCover ??= emptyBackCover(); d.backCover[key] = value; });
  return <>
    <Section title="1 · Main brand" editorTarget="backcover-brand">
      <p className="hint">Edit the publication identity. Its alignment, spacing and typography are grouped in Design.</p>
      <LabeledInput editorTarget="backcover-brand" label="Brand name" value={content.brand} onChange={set('brand')} placeholder="THE PHYSICIST" />
      <LabeledInput editorTarget="backcover-tagline" label="Tagline" value={content.tagline} onChange={set('tagline')} placeholder="SCHOOL OF PHYSICS" />
    </Section>
    <Section title="2 · QR & website" editorTarget="backcover-website">
      <LabeledInput editorTarget="backcover-website" label="Website" value={content.website} onChange={set('website')} placeholder="www.physics.usm.my" />
      <LabeledInput editorTarget="backcover-qr-label" label="QR description" value={content.qrLabel} onChange={set('qrLabel')} placeholder="Scan for our website" />
    </Section>
    <Section title="3 · Social links" editorTarget="backcover-social">
      <p className="hint">Add a URL, choose its logo and assign a footer column. The label is optional; when blank, the platform name is used.</p>
      <SocialLinksEditor content={content} links={usableSocialLinks(content)} update={update} />
    </Section>
    <Section title="4 · Footer credits" editorTarget="backcover-footer-text">
      <LabeledInput editorTarget="backcover-imprint" label="Issue mark" value={content.imprint} onChange={set('imprint')} placeholder="ISSUE 01 · 2026" />
      <LabeledInput editorTarget="backcover-footer-text" label="Centre footer text" value={content.footerText} onChange={set('footerText')} placeholder="SCHOOL OF PHYSICS · USM" />
    </Section>
  </>;
}

function SocialLinksEditor({
  content,
  links,
  update,
}: {
  content: ReturnType<typeof emptyBackCover>;
  links: BackCoverSocialLink[];
  update: (fn: (doc: import('../../schema/document').Doc) => void) => void;
}) {
  const writeLinks = (next: BackCoverSocialLink[]) => update(d => {
    d.backCover ??= emptyBackCover();
    d.backCover.socialLinks = next.map(link => ({ ...link }));
  });
  const add = (side: 'left' | 'right') => writeLinks([
    ...links,
    { id: uid(), platform: 'website', label: '', url: '', side },
  ]);
  const patch = (id: string, value: Partial<BackCoverSocialLink>) => {
    const current = links.find(link => link.id === id);
    if (!current) return;
    const nextLink = { ...current, ...value };
    if (value.side && value.side !== current.side) {
      const without = links.filter(link => link.id !== id);
      const lastAtSide = without.reduce((last, link, index) => link.side === value.side ? index : last, -1);
      without.splice(lastAtSide + 1, 0, nextLink);
      writeLinks(without);
      return;
    }
    writeLinks(links.map(link => link.id === id ? nextLink : link));
  };
  const remove = (id: string) => writeLinks(links.filter(link => link.id !== id));
  const move = (id: string, delta: -1 | 1) => {
    const current = links.find(link => link.id === id);
    if (!current) return;
    const indices = links.map((link, index) => link.side === current.side ? index : -1).filter(index => index >= 0);
    const sideIndex = indices.findIndex(index => links[index].id === id);
    const targetSideIndex = sideIndex + delta;
    if (sideIndex < 0 || targetSideIndex < 0 || targetSideIndex >= indices.length) return;
    const index = indices[sideIndex];
    const target = indices[targetSideIndex];
    const next = [...links];
    [next[index], next[target]] = [next[target], next[index]];
    writeLinks(next);
  };

  const renderColumn = (side: 'left' | 'right') => {
    const column = links.filter(link => link.side === side);
    return <div className="back-cover-social-column-editor">
      <div className="back-cover-social-column-head">
        <h3>{side === 'left' ? 'Left column' : 'Right column'}</h3>
        <button type="button" className="add-btn" onClick={() => add(side)}>+ Add link</button>
      </div>
      {column.length === 0 && <p className="hint">No links in this column.</p>}
      {column.map((link, index) => (
        <div className="back-cover-link-editor" key={link.id} id={`editor-target-backcover-social-link-${link.id}`}>
          <div className="back-cover-link-editor-head">
            <strong>{link.label?.trim() || platformLabel(link.platform) || `Link ${index + 1}`}</strong>
            <RowButtons
              onUp={() => move(link.id, -1)}
              onDown={() => move(link.id, 1)}
              disableUp={index === 0}
              disableDown={index === column.length - 1}
              onRemove={() => remove(link.id)}
            />
          </div>
          <LabeledSelect
            editorTarget={`backcover-social-platform-${link.id}`}
            label="Logo"
            value={link.platform}
            options={SOCIAL_PLATFORM_OPTIONS}
            onChange={value => patch(link.id, { platform: value as BackCoverSocialPlatform })}
          />
          <SegmentField
            editorTarget={`backcover-social-side-${link.id}`}
            label="Column"
            value={link.side}
            options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
            onChange={nextSide => patch(link.id, { side: nextSide as 'left' | 'right' })}
          />
          <LabeledInput
            editorTarget={`backcover-social-url-${link.id}`}
            label="URL"
            value={link.url}
            onChange={url => patch(link.id, { url })}
            placeholder="https://example.org/profile"
          />
          <LabeledInput
            editorTarget={`backcover-social-label-${link.id}`}
            label="Label (optional)"
            value={link.label ?? ''}
            onChange={label => patch(link.id, { label })}
            placeholder={platformLabel(link.platform)}
          />
        </div>
      ))}
    </div>;
  };

  return <div className="back-cover-social-editor">
    {links.length === 0 && <p className="hint">No social links yet. Add one to start the footer.</p>}
    {renderColumn('left')}
    {renderColumn('right')}
    {/* Keep the legacy columns available for files that have not yet been
        touched by the structured editor, but do not show a second competing
        editor after socialLinks has been created. */}
    {!content.socialLinks && <p className="hint">Your existing plain-text footer is preserved. Editing or adding a link converts it to the structured logo layout.</p>}
  </div>;
}

export function BackCoverImages() {
  return <>
    <ImagePicker
      slot="backcover-qr"
      title="QR code"
      blurb="Upload a real, scannable square QR image. The template will preserve the complete code without cropping."
      fit="contain"
      thumbAspectRatio="1 / 1"
    />
    <ImagePicker
      slot="backcover-logo"
      title="Centre logo (optional)"
      blurb="Upload a transparent publication or School of Physics logo. Without one, the editable text lock-up is shown instead."
      fit="contain"
      thumbAspectRatio="3 / 1"
    />
  </>;
}

function DesignGroup({ number, title, summary, children, open = false }: {
  number: number;
  title: string;
  summary: string;
  children: ReactNode;
  open?: boolean;
}) {
  return <details className="back-cover-design-group" open={open}>
    <summary>{number} · {title}<span>{summary}</span></summary>
    <div className="back-cover-design-fields">{children}</div>
  </details>;
}

const WEIGHT_OPTIONS = [
  { value: '300', label: 'Light' },
  { value: '400', label: 'Regular' },
  { value: '500', label: 'Medium' },
  { value: '600', label: 'Semibold' },
  { value: '700', label: 'Bold' },
  { value: '800', label: 'Extra bold' },
  { value: '900', label: 'Black' },
];

function BackCoverTextEditor({ role }: { role: BackCoverTextRole }) {
  const design = useDoc(s => s.doc.design);
  const update = useDoc(s => s.update);
  const style = backCoverTextStyle(design, role);
  const label = BACK_COVER_TEXT_LABELS[role];
  const set = (patch: BackCoverTextStyle) => update(d => {
    d.design.backCover ??= {};
    d.design.backCover.text ??= {};
    d.design.backCover.text[role] = { ...d.design.backCover.text[role], ...patch };
  });
  const reset = () => update(d => {
    if (d.design.backCover?.text) delete d.design.backCover.text[role];
  });
  const usePalette = () => update(d => {
    if (d.design.backCover?.text?.[role]) delete d.design.backCover.text[role].color;
  });
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

  return <details className="back-cover-text-editor" id={`editor-target-backcover-style-${role}`}>
    <summary>{label}<span>{style.fontFamily} · {style.fontSize} pt</span></summary>
    <div className="back-cover-text-fields">
      <Toggle label="Show object" checked={style.visible} onChange={visible => set({ visible })} />
      <LabeledSelect label="Font" value={style.fontFamily} options={fontOptions(ALL_FONTS)} onChange={fontFamily => set({ fontFamily })} />
      <LabeledNumber label="Size" unit="pt" value={style.fontSize} min={4.5} max={72} step={.5} onChange={fontSize => set({ fontSize: clamp(fontSize, 4.5, 72) })} />
      <LabeledSelect label="Weight" value={String(style.fontWeight)} options={WEIGHT_OPTIONS} onChange={value => set({ fontWeight: Number(value) })} />
      <Toggle label="Italic" checked={style.italic} onChange={italic => set({ italic })} />
      <LabeledNumber label="Line height" unit="×" value={style.lineHeight} min={.75} max={2.5} step={.05} onChange={lineHeight => set({ lineHeight: clamp(lineHeight, .75, 2.5) })} />
      {design.textDirection === 'rtl'
        ? <p className="hint">Arabic uses natural letter spacing so joined characters remain correct. Your Latin value is kept.</p>
        : <LabeledNumber label="Letter spacing" unit="em" value={style.letterSpacing} min={-.15} max={.5} step={.005} onChange={letterSpacing => set({ letterSpacing: clamp(letterSpacing, -.15, .5) })} />}
      <LabeledNumber label="Space above" unit="mm" value={style.spaceBefore} min={-12} max={40} step={.5} onChange={spaceBefore => set({ spaceBefore: clamp(spaceBefore, -12, 40) })} />
      <p className="hint">Negative spacing moves this object closer to the one above while keeping the reading-order hierarchy.</p>
      <LabeledColor label="Colour" value={style.color} onChange={color => set({ color })} />
      <div className="back-cover-reset-row">
        <button type="button" className="add-btn" onClick={usePalette}>Use palette colour</button>
        <button type="button" className="add-btn" onClick={reset}>Reset this object</button>
      </div>
    </div>
  </details>;
}

export function BackCoverDesign() {
  const design = useDoc(s => s.doc.design);
  const update = useDoc(s => s.update);
  const layout = backCoverLayout(design);
  const set = <K extends keyof BackCoverDesignSettings>(key: K, value: BackCoverDesignSettings[K]) => update(d => {
    d.design.backCover ??= {};
    d.design.backCover[key] = value;
  });
  const bounded = <K extends keyof BackCoverDesignSettings>(key: K, min: number, max: number) => (value: number) =>
    set(key, Math.max(min, Math.min(max, value)) as BackCoverDesignSettings[K]);

  return <Section title="Back-cover design" editorTarget="backcover-layout">
    <p className="hint back-cover-design-intro">Edit one group at a time. All movement is bounded and remains inside the established QR → brand → footer hierarchy.</p>

    <DesignGroup number={1} title="Page & composition" summary="Position and width of the main lock-up" open>
      <SegmentField
        editorTarget="backcover-brand-alignment"
        label="Brand position"
        value={layout.brandAlign}
        options={[{ value: 'start', label: 'Start' }, { value: 'center', label: 'Centre' }, { value: 'end', label: 'End' }]}
        onChange={value => set('brandAlign', value)}
      />
      <p className="hint">Start and End mirror automatically for Arabic.</p>
      <LabeledNumber editorTarget="backcover-brand-top" label="Brand group from top" unit="mm" value={layout.brandTop} min={28} max={170} step={1} onChange={bounded('brandTop', 28, 170)} />
      <LabeledNumber editorTarget="backcover-brand-width" label="Brand group width" unit="mm" value={layout.brandWidth} min={45} max={150} step={1} onChange={bounded('brandWidth', 45, 150)} />
    </DesignGroup>

    <DesignGroup number={2} title="Centre brand & QR" summary="QR, divider and their measured spacing">
      <Toggle editorTarget="backcover-show-qr" label="Show QR code" checked={layout.showQr} onChange={value => set('showQr', value)} />
      <LabeledNumber editorTarget="backcover-qr-size" label="QR code size" unit="mm" value={layout.qrSize} min={12} max={55} step={1} onChange={bounded('qrSize', 12, 55)} />
      <LabeledNumber editorTarget="backcover-qr-gap" label="Space below QR" unit="mm" value={layout.qrGap} min={0} max={20} step={.5} onChange={bounded('qrGap', 0, 20)} />
      <Toggle editorTarget="backcover-show-rule" label="Show divider" checked={layout.ruleVisible} onChange={value => set('ruleVisible', value)} />
      <LabeledNumber editorTarget="backcover-rule-width" label="Divider width" unit="mm" value={layout.ruleWidth} min={0} max={80} step={.5} onChange={bounded('ruleWidth', 0, 80)} />
      <LabeledNumber editorTarget="backcover-rule-thickness" label="Divider thickness" unit="mm" value={layout.ruleThickness} min={0} max={2} step={.05} onChange={bounded('ruleThickness', 0, 2)} />
      <LabeledNumber label="Space above divider" unit="mm" value={layout.ruleTopGap} min={0} max={20} step={.5} onChange={bounded('ruleTopGap', 0, 20)} />
      <LabeledNumber label="Space below divider" unit="mm" value={layout.ruleBottomGap} min={0} max={20} step={.5} onChange={bounded('ruleBottomGap', 0, 20)} />
      <p className="hint">Set divider width or thickness to 0 to remove it, or use the visibility switch.</p>
    </DesignGroup>

    <DesignGroup number={3} title="Footer & social layout" summary="Visibility, safe margins, logos and column rhythm">
      <Toggle editorTarget="backcover-show-social" label="Show social links" checked={layout.showSocial} onChange={value => set('showSocial', value)} />
      <Toggle editorTarget="backcover-show-centre-logo" label="Show centre logo" checked={layout.showCentreLogo} onChange={value => set('showCentreLogo', value)} />
      <Toggle editorTarget="backcover-show-imprint" label="Show issue mark" checked={layout.showImprint} onChange={value => set('showImprint', value)} />
      <LabeledNumber editorTarget="backcover-side-inset" label="Footer side safe margin" unit="mm" value={layout.sideInset} min={6} max={35} step={1} onChange={bounded('sideInset', 6, 35)} />
      <LabeledNumber editorTarget="backcover-social-bottom" label="Bottom safe margin" unit="mm" value={layout.bottomInset} min={6} max={42} step={1} onChange={bounded('bottomInset', 6, 42)} />
      <LabeledNumber label="Footer column gap" unit="mm" value={layout.footerGap} min={2} max={22} step={.5} onChange={bounded('footerGap', 2, 22)} />
      <LabeledNumber editorTarget="backcover-logo-width" label="Centre logo width" unit="mm" value={layout.logoWidth} min={10} max={80} step={1} onChange={bounded('logoWidth', 10, 80)} />
      <LabeledNumber editorTarget="backcover-logo-height" label="Centre logo height" unit="mm" value={layout.logoHeight} min={5} max={42} step={1} onChange={bounded('logoHeight', 5, 42)} />
      <LabeledNumber editorTarget="backcover-social-icon-size" label="Social logo size" unit="mm" value={layout.socialIconSize} min={3} max={14} step={.5} onChange={bounded('socialIconSize', 3, 14)} />
      <LabeledNumber label="Space between social rows" unit="mm" value={layout.socialItemGap} min={0} max={10} step={.5} onChange={bounded('socialItemGap', 0, 10)} />
      <LabeledNumber label="Logo-to-text gap" unit="mm" value={layout.socialTextGap} min={0} max={8} step={.5} onChange={bounded('socialTextGap', 0, 8)} />
      <p className="hint">Keep social lists concise. Very large logos or many rows can overcrowd a fixed back cover.</p>
    </DesignGroup>

    <DesignGroup number={4} title="Typography" summary="Independent styles, visibility and hierarchical spacing">
      {(Object.keys(BACK_COVER_TEXT_LABELS) as BackCoverTextRole[]).map(role => <BackCoverTextEditor role={role} key={role} />)}
    </DesignGroup>

    <DesignGroup number={5} title="Colours & reset" summary="Page palette and object accents">
      <LabeledColor editorTarget="design-paper" label="Page colour" value={design.paperBg ?? '#f5b719'} onChange={value => update(d => { d.design.paperBg = value; })} />
      <LabeledColor editorTarget="design-ink" label="Default text colour" value={design.colors.ink} onChange={value => update(d => { d.design.colors.ink = value; })} />
      <LabeledColor editorTarget="design-accent" label="Default accent colour" value={design.colors.accent} onChange={value => update(d => { d.design.colors.accent = value; })} />
      <LabeledColor label="Muted text colour" value={design.backCover?.mutedColor ?? design.colors.ink} onChange={value => set('mutedColor', value)} />
      <LabeledColor label="Social-logo colour" value={design.backCover?.socialIconColor ?? design.colors.accent} onChange={value => set('socialIconColor', value)} />
      <LabeledColor label="Divider colour" value={design.backCover?.ruleColor ?? design.colors.accent} onChange={value => set('ruleColor', value)} />
      <button type="button" className="add-btn back-cover-reset-design" onClick={() => update(d => {
        d.design.backCover = defaultBackCoverDesign();
      })}>Reset back-cover layout & typography</button>
      <p className="hint">Reset changes design controls only. It never deletes your wording, images or social links.</p>
    </DesignGroup>
  </Section>;
}
