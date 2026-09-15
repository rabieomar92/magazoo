import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { cssVars } from '../lib/geometry';
import { makeBackCover } from '../store/backCover';
import { BackCoverPage } from './BackCoverPage';

describe('back-cover template', () => {
  it('renders a single trim-to-trim sheet without running furniture', () => {
    const doc = makeBackCover();
    const html = renderToStaticMarkup(<BackCoverPage doc={doc} vars={cssVars(doc.design, doc.templateId)} />);

    expect(html).toContain('class="page back-cover-page"');
    expect(html).toContain('class="back-cover-qr back-cover-qr--empty"');
    expect(html).toContain('THE PHYSICIST');
    expect(html).toContain('SCHOOL OF PHYSICS · USM');
    expect(html).toContain('class="back-cover-imprint"');
    expect(html).toContain('data-platform="facebook"');
    expect(html).toContain('data-platform="x"');
    expect(html).toContain('data-platform="linkedin"');
    expect(html).not.toContain('tag-bar');
    expect(html).not.toContain('page-folio');
    expect(html).not.toContain('Page 1');
  });

  it('keeps uploaded QR and logo as real images and preserves custom footer copy', () => {
    const doc = makeBackCover();
    doc.design.backCoverQrSize = 34;
    doc.design.backCoverLogoWidth = 46;
    doc.design.backCoverLogoHeight = 22;
    doc.design.backCoverSocialIconSize = 8;
    doc.assets.qr = { src: 'data:image/png;base64,qr', naturalWidth: 512, naturalHeight: 512 };
    doc.assets.logo = { src: 'data:image/png;base64,logo', naturalWidth: 600, naturalHeight: 180 };
    doc.backCover!.qr.assetId = 'qr';
    doc.backCover!.logo.assetId = 'logo';
    doc.backCover!.footerText = 'THE PHYSICIST · USM';
    const html = renderToStaticMarkup(<BackCoverPage doc={doc} vars={cssVars(doc.design, doc.templateId)} />);

    expect(html).toContain('src="data:image/png;base64,qr"');
    expect(html).toContain('src="data:image/png;base64,logo"');
    expect(html).toContain('data-editor-target="backcover-footer-text"');
    expect(html).toContain('THE PHYSICIST · USM');
    expect(html).toContain('--back-qr-size:34mm');
    expect(html).toContain('--back-logo-width:46mm');
    expect(html).toContain('--back-logo-height:22mm');
    expect(html).toContain('--back-social-icon-size:8mm');
    expect(html).toMatch(/<svg[^>]+viewBox="0 0 448 512"/);
  });

  it('keeps legacy plain-text social columns visible when no structured links exist', () => {
    const doc = makeBackCover();
    delete doc.backCover!.socialLinks;
    doc.backCover!.socialLeft = 'Research page\nexample.org/research';
    const html = renderToStaticMarkup(<BackCoverPage doc={doc} vars={cssVars(doc.design, doc.templateId)} />);
    expect(html).toContain('Research page');
    expect(html).toContain('example.org/research');
    expect(html).not.toContain('back-cover-social-links');
  });

  it('renders every selectable platform as a real inline SVG mark', () => {
    const doc = makeBackCover();
    const platforms = ['facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok', 'threads', 'bluesky', 'whatsapp', 'github', 'telegram', 'discord', 'pinterest', 'reddit', 'mastodon', 'twitch', 'website', 'email', 'rss'] as const;
    doc.backCover!.socialLinks = platforms.map((platform, index) => ({
      id: `platform-${platform}`,
      platform,
      url: `example.org/${platform}`,
      side: index % 2 === 0 ? 'left' : 'right',
    }));
    const html = renderToStaticMarkup(<BackCoverPage doc={doc} vars={cssVars(doc.design, doc.templateId)} />);

    expect((html.match(/class="back-cover-social-icon /g) ?? [])).toHaveLength(platforms.length);
    expect((html.match(/<svg /g) ?? [])).toHaveLength(platforms.length);
    for (const platform of platforms) expect(html).toContain(`data-platform="${platform}"`);
  });

  it('renders every nested placement, sizing, colour and typography setting as print-safe CSS variables', () => {
    const doc = makeBackCover();
    doc.design.backCover = {
      brandTop: 96.5,
      brandWidth: 121,
      brandAlign: 'end',
      sideInset: 19,
      bottomInset: 17.5,
      footerGap: 9.5,
      qrSize: 38,
      qrGap: 4.5,
      logoWidth: 54,
      logoHeight: 23,
      socialIconSize: 8.5,
      socialItemGap: 3.5,
      socialTextGap: 2.25,
      socialIconColor: '#1a2b3c',
      ruleColor: '#445566',
      ruleWidth: 43,
      ruleThickness: .8,
      ruleTopGap: 6,
      ruleBottomGap: 5,
      text: {
        brand: {
          fontFamily: 'Playfair Display',
          fontSize: 34,
          fontWeight: 600,
          italic: true,
          letterSpacing: .075,
          lineHeight: 1.2,
          color: '#654321',
          spaceBefore: -2.5,
        },
      },
    };

    const html = renderToStaticMarkup(<BackCoverPage doc={doc} vars={cssVars(doc.design, doc.templateId)} />);

    for (const css of [
      '--back-brand-top:96.5mm', '--back-brand-width:121mm', '--back-brand-align:end', '--back-brand-items:flex-end',
      '--back-side-inset:19mm', '--back-social-bottom:17.5mm', '--back-footer-gap:9.5mm',
      '--back-qr-size:38mm', '--back-qr-gap:4.5mm', '--back-logo-width:54mm', '--back-logo-height:23mm',
      '--back-social-icon-size:8.5mm', '--back-social-item-gap:3.5mm', '--back-social-text-gap:2.25mm',
      '--back-rule-width:43mm', '--back-rule-thickness:0.8mm', '--back-rule-top-gap:6mm', '--back-rule-bottom-gap:5mm',
      '--back-rule-color:#445566', '--back-social-icon-color:#1a2b3c',
      '--back-brand-size:34pt', '--back-brand-weight:600', '--back-brand-style:italic', '--back-brand-tracking:0.075em',
      '--back-brand-leading:1.2', '--back-brand-color:#654321', '--back-brand-space:-2.5mm',
    ]) expect(html).toContain(css);
  });

  it('does not render optional objects when their visibility controls are off', () => {
    const doc = makeBackCover();
    doc.assets.qr = { src: 'data:image/png;base64,qr', naturalWidth: 512, naturalHeight: 512 };
    doc.assets.logo = { src: 'data:image/png;base64,logo', naturalWidth: 600, naturalHeight: 180 };
    doc.backCover!.qr.assetId = 'qr';
    doc.backCover!.logo.assetId = 'logo';
    doc.design.backCover = {
      showQr: false,
      showCentreLogo: false,
      showSocial: true,
      showImprint: false,
      ruleVisible: false,
      text: {
        brand: { visible: false },
        tagline: { visible: false },
        website: { visible: false },
        qrLabel: { visible: false },
        socialLabel: { visible: false },
        socialUrl: { visible: false },
        footerText: { visible: false },
        imprint: { visible: false },
      },
    };

    const html = renderToStaticMarkup(<BackCoverPage doc={doc} vars={cssVars(doc.design, doc.templateId)} />);

    expect(html).not.toContain('class="back-cover-qr');
    expect(html).not.toContain('class="back-cover-logo-frame"');
    expect(html).not.toContain('class="back-cover-logo-symbol"');
    expect(html).not.toContain('class="back-cover-rule"');
    expect(html).not.toContain('class="back-cover-footer-text"');
    expect(html).not.toContain('class="back-cover-imprint"');
    expect(html).not.toContain('class="back-cover-social-label"');
    expect(html).not.toContain('class="back-cover-social-url"');
    expect(html).not.toMatch(/<h[12]/);
    expect(html).not.toContain('class="back-cover-website"');
    expect(html).not.toContain('class="back-cover-qr-label"');
  });
});
