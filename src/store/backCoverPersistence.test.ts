import { afterEach, describe, expect, it } from 'vitest';
import { migrate } from '../schema/document';
import { defaultBackCoverDesign } from '../lib/backCoverDesign';
import { serializeDocument } from '../lib/serializeDocument';
import { makeBackCover } from './backCover';
import { useDoc } from './useDoc';

const backCoverDesign = (design: ReturnType<typeof makeBackCover>['design']) =>
  Object.fromEntries(
    Object.entries(design).filter(([key]) => key.startsWith('backCover')),
  );

afterEach(() => {
  useDoc.getState().load(makeBackCover());
  useDoc.temporal.getState().clear();
});

describe('back-cover persistence', () => {
  it('keeps customized copy, artwork, links and every back-cover design setting after save and reopen', async () => {
    const doc = makeBackCover();
    doc.backCover = {
      ...doc.backCover!,
      qr: { assetId: 'qr', offsetX: -13.5, offsetY: 8.25, scale: 1.75 },
      logo: { assetId: 'logo', offsetX: 17, offsetY: -6, scale: 2.2 },
      qrLabel: 'Scan  for  the full issue',
      brand: 'مجلة الفيزياء',
      tagline: 'Research · Teaching · Community',
      website: 'https://physics.example.edu/issues/2026',
      socialLeft: 'Legacy left copy',
      socialRight: 'Legacy right copy',
      socialLinks: [
        { id: 'facebook-row', platform: 'facebook', label: 'School Facebook', url: 'https://facebook.com/example', side: 'left' },
        { id: 'youtube-row', platform: 'youtube', label: 'Watch us', url: 'https://youtube.com/@example', side: 'right' },
      ],
      footerText: 'SCHOOL OF PHYSICS · USM',
      imprint: 'VOL. 12 · NO. 3 · 2026',
    };
    Object.assign(doc.design, {
      backCoverBrandTop: 96.5,
      backCoverSideInset: 18.25,
      backCoverSocialBottom: 21.5,
      backCoverQrSize: 41,
      backCoverLogoWidth: 63,
      backCoverLogoHeight: 27,
      backCoverSocialIconSize: 9.5,
      backCover: {
        ...defaultBackCoverDesign(),
        brandTop: 103,
        brandWidth: 126,
        brandAlign: 'end',
        showQr: false,
        mutedColor: '#334455',
        socialIconColor: '#556677',
        ruleColor: '#778899',
        text: {
          brand: { fontFamily: 'Playfair Display', fontSize: 38, letterSpacing: -.06, spaceBefore: -3 },
          socialUrl: { visible: false, fontSize: 6, color: '#abcdef' },
        },
      },
    });
    doc.assets.qr = { src: 'data:image/png;base64,qr', naturalWidth: 512, naturalHeight: 512 };
    doc.assets.logo = { src: 'data:image/png;base64,logo', naturalWidth: 900, naturalHeight: 240 };
    doc.assets.orphan = { src: 'data:image/png;base64,unused', naturalWidth: 10, naturalHeight: 10 };

    const reopened = migrate(JSON.parse(await serializeDocument(doc)));

    expect(reopened.backCover).toEqual(doc.backCover);
    expect(backCoverDesign(reopened.design)).toEqual(backCoverDesign(doc.design));
    expect(reopened.assets.qr).toEqual(doc.assets.qr);
    expect(reopened.assets.logo).toEqual(doc.assets.logo);
    expect(reopened.assets.orphan).toBeUndefined();
    expect(doc.assets.orphan).toBeDefined();
  });

  it('does not discard back-cover edits when an editor previews another template and returns', () => {
    const doc = makeBackCover();
    doc.backCover!.brand = 'CUSTOM PUBLICATION';
    doc.backCover!.socialLinks = [
      { id: 'instagram-row', platform: 'instagram', label: 'Magazine', url: 'https://instagram.com/example', side: 'right' },
    ];
    doc.design.backCoverBrandTop = 111;
    doc.design.backCoverLogoWidth = 71;
    doc.design.backCover = {
      ...defaultBackCoverDesign(),
      brandTop: 119,
      showSocial: false,
      text: { footerText: { fontSize: 9, italic: true, spaceBefore: -2 } },
    };
    const contentBefore = structuredClone(doc.backCover);
    const designBefore = backCoverDesign(doc.design);

    useDoc.getState().load(doc);
    useDoc.getState().switchTemplate('paper-1');
    useDoc.getState().switchTemplate('backcover-1');

    expect(useDoc.getState().doc.backCover).toEqual(contentBefore);
    expect(backCoverDesign(useDoc.getState().doc.design)).toEqual(designBefore);
  });
});
