import {
  defaultSubtitleGap,
  emptyDoc,
  uid,
  type Doc,
  type TemplateFamily,
  type TemplateId,
} from '../schema/document';
import { sampleDoc } from '../sample';
import { makeGallery1, makeGallery2, makeGallery3, makeGallery4 } from './gallery';

/**
 * Template registry. Two families (paper / magazine), each with several presets.
 * A preset is a self-contained Doc (content + design tokens + any placeholder
 * asset). `switchTemplate` loads one so the canvas fills instantly.
 */

export interface TemplateMeta {
  id: TemplateId;
  family: TemplateFamily;
  name: string;
  kind: string;
}

// ---- Shared placeholder photos (SVG data URLs, no external files) -----------

const svg = (inner: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">${inner}</svg>`,
  );

const stars = (pts: [number, number, number][]) =>
  pts
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="0.8"/>`)
    .join('');

/** Twilight mountaintop observatory. */
const PHOTO_OBSERVATORY = svg(
  `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0b1a3a"/><stop offset="0.45" stop-color="#5b2a63"/>
    <stop offset="0.72" stop-color="#c2603f"/><stop offset="1" stop-color="#f2a65a"/></linearGradient></defs>
   <rect width="1600" height="900" fill="url(#s)"/>
   ${stars([[180, 120, 2.4], [640, 150, 2], [1120, 130, 2.6], [1340, 90, 1.7], [1500, 180, 2]])}
   <polygon points="0,900 300,560 560,700 820,470 1040,640 1320,430 1600,660 1600,900" fill="#241033" opacity="0.9"/>
   <polygon points="0,900 240,660 520,780 900,560 1180,760 1600,600 1600,900" fill="#120720"/>
   <g transform="translate(1080 470)"><rect x="-8" y="42" width="120" height="60" fill="#0a0413"/>
   <path d="M -14 44 A 60 52 0 0 1 118 44 Z" fill="#1c0f2e"/>
   <rect x="34" y="-6" width="10" height="54" fill="#0a0413" transform="rotate(-24 39 20)"/></g>`,
);

/** Particle-collision tracks radiating from a bright vertex. */
const PHOTO_COLLIDER = svg(
  `<rect width="1600" height="900" fill="#04070f"/>
   ${stars([[200, 120, 1.4], [1400, 160, 1.6], [760, 90, 1.3], [1180, 720, 1.4]])}
   <g fill="none" stroke-width="3" opacity="0.9">
     <path d="M800 450 C 700 300, 500 260, 300 180" stroke="#22d3ee"/>
     <path d="M800 450 C 940 320, 1180 300, 1420 210" stroke="#38bdf8"/>
     <path d="M800 450 C 720 600, 560 720, 320 820" stroke="#818cf8"/>
     <path d="M800 450 C 900 640, 1120 740, 1360 830" stroke="#67e8f9"/>
     <path d="M800 450 C 800 300, 820 200, 840 90" stroke="#e0f2fe"/>
     <path d="M800 450 C 640 460, 420 470, 200 460" stroke="#22d3ee" opacity="0.6"/>
     <path d="M800 450 C 980 470, 1220 470, 1460 455" stroke="#38bdf8" opacity="0.6"/>
   </g>
   <circle cx="800" cy="450" r="46" fill="#22d3ee" opacity="0.25"/>
   <circle cx="800" cy="450" r="16" fill="#e0f2fe"/>`,
);

/** Black hole with a glowing accretion ring. */
const PHOTO_BLACKHOLE = svg(
  `<defs><radialGradient id="b" cx="50%" cy="50%" r="50%">
    <stop offset="0" stop-color="#1a0f04"/><stop offset="1" stop-color="#03040a"/></radialGradient></defs>
   <rect width="1600" height="900" fill="url(#b)"/>
   ${stars([[160, 140, 1.6], [1440, 120, 1.8], [520, 720, 1.4], [1180, 760, 1.5], [900, 120, 1.3], [300, 420, 1.2]])}
   <g transform="translate(800 450)">
     <ellipse rx="330" ry="96" fill="none" stroke="#f59e0b" stroke-width="26" opacity="0.28"/>
     <ellipse rx="300" ry="82" fill="none" stroke="#fbbf24" stroke-width="14" opacity="0.55"/>
     <ellipse rx="272" ry="70" fill="none" stroke="#fde68a" stroke-width="6" opacity="0.9"/>
     <circle r="150" fill="#03040a"/>
     <circle r="150" fill="none" stroke="#fcd34d" stroke-width="3" opacity="0.5"/>
   </g>`,
);

/** Diamond-anvil cell squeezing a hydrogen cage — paper-2's hero. */
const PHOTO_LATTICE = svg(
  `<defs><linearGradient id="l" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0f1030"/><stop offset="1" stop-color="#2b1e5c"/></linearGradient></defs>
   <rect width="1600" height="900" fill="url(#l)"/>
   <g stroke="#8b9cf7" stroke-width="2" opacity="0.45">
     ${[0, 1, 2, 3, 4]
       .flatMap((r) =>
         [0, 1, 2, 3, 4, 5, 6, 7].map((c) => {
           const x = 220 + c * 165 + (r % 2) * 82;
           const y = 150 + r * 150;
           return `<line x1="${x}" y1="${y}" x2="${x + 165}" y2="${y}"/><line x1="${x}" y1="${y}" x2="${x + 82}" y2="${y + 150}"/>`;
         }),
       )
       .join('')}
   </g>
   <g fill="#c7d2fe">
     ${[0, 1, 2, 3, 4]
       .flatMap((r) =>
         [0, 1, 2, 3, 4, 5, 6, 7].map((c) => {
           const x = 220 + c * 165 + (r % 2) * 82;
           const y = 150 + r * 150;
           return `<circle cx="${x}" cy="${y}" r="9"/>`;
         }),
       )
       .join('')}
   </g>
   <g transform="translate(800 450)">
     <polygon points="-300,-420 300,-420 90,-70 -90,-70" fill="#e0e7ff" opacity="0.16"/>
     <polygon points="-300,420 300,420 90,70 -90,70" fill="#e0e7ff" opacity="0.16"/>
     <circle r="86" fill="#fbbf24" opacity="0.22"/>
     <circle r="34" fill="#fde68a"/>
   </g>`,
);

/** Wide canvas (2400×1700 ≈ gatefold spread) for magazine-3, whose cover photo is
 *  split across two facing sheets. */
const svgWide = (inner: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1700">${inner}</svg>`,
  );

/** Black hole + accretion ring on a starfield, drawn wide for the gatefold. */
const PHOTO_COSMOS_WIDE = svgWide(
  `<defs><radialGradient id="cw" cx="50%" cy="46%" r="62%">
    <stop offset="0" stop-color="#241634"/><stop offset="0.6" stop-color="#0a0a1a"/><stop offset="1" stop-color="#03040a"/></radialGradient></defs>
   <rect width="2400" height="1700" fill="url(#cw)"/>
   ${stars([
     [180, 200, 2.4], [520, 140, 1.8], [900, 240, 2.2], [1500, 160, 2], [1980, 220, 2.6],
     [2260, 380, 1.7], [140, 700, 1.6], [420, 1200, 2], [860, 1500, 1.8], [1360, 1440, 2.2],
     [1820, 1300, 1.6], [2180, 1120, 2], [2320, 760, 1.5], [700, 900, 1.3], [1700, 980, 1.4],
   ])}
   <g transform="translate(1200 850)">
     <ellipse rx="520" ry="150" fill="none" stroke="#f59e0b" stroke-width="34" opacity="0.28"/>
     <ellipse rx="470" ry="128" fill="none" stroke="#fbbf24" stroke-width="18" opacity="0.55"/>
     <ellipse rx="430" ry="110" fill="none" stroke="#fde68a" stroke-width="8" opacity="0.9"/>
     <circle r="230" fill="#03040a"/>
     <circle r="230" fill="none" stroke="#fcd34d" stroke-width="4" opacity="0.5"/>
   </g>`,
);

const svgPortrait = (inner: string) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="2000">${inner}</svg>`,
  );

/** An organic microscopy-inspired portrait for the dedicated cover preset. */
const PHOTO_MICROSCAPE = svgPortrait(
  `<defs>
    <radialGradient id="m0" cx="54%" cy="48%" r="72%">
      <stop offset="0" stop-color="#b8a34d"/><stop offset="0.48" stop-color="#5f6225"/>
      <stop offset="1" stop-color="#171d0e"/>
    </radialGradient>
    <radialGradient id="m1" cx="42%" cy="36%" r="64%">
      <stop offset="0" stop-color="#e2c76b"/><stop offset="0.58" stop-color="#8f6c29"/>
      <stop offset="1" stop-color="#3d2b19"/>
    </radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="34"/></filter>
    <filter id="soft"><feGaussianBlur stdDeviation="8"/></filter>
  </defs>
  <rect width="1400" height="2000" fill="url(#m0)"/>
  <g opacity=".45" filter="url(#blur)" fill="#dfcf77">
    <circle cx="180" cy="520" r="180"/><circle cx="1220" cy="300" r="230"/>
    <circle cx="1120" cy="1470" r="260"/><circle cx="240" cy="1740" r="210"/>
  </g>
  <g transform="translate(770 1080) rotate(-11)">
    <ellipse rx="430" ry="510" fill="url(#m1)" stroke="#f0d27b" stroke-width="18"/>
    <ellipse rx="330" ry="405" fill="#8a6c31" opacity=".38"/>
    <g fill="#3f2b18" opacity=".86">
      <circle cx="-155" cy="-205" r="40"/><circle cx="95" cy="-268" r="54"/>
      <circle cx="175" cy="-70" r="34"/><circle cx="-90" cy="52" r="62"/>
      <circle cx="165" cy="190" r="48"/><circle cx="-170" cy="275" r="38"/>
    </g>
    <g fill="none" stroke="#2b2114" stroke-width="13" stroke-linecap="round">
      <path d="M-310-280 C-520-430-610-650-690-790"/><path d="M300-250 C500-400 610-560 700-720"/>
      <path d="M-390-40 C-620-70-770-10-930 80"/><path d="M390 35 C650 75 790 180 930 350"/>
      <path d="M-330 330 C-510 500-590 680-650 850"/><path d="M310 360 C470 560 500 740 520 900"/>
    </g>
    <g fill="#f4df92" opacity=".8" filter="url(#soft)">
      <circle cx="-210" cy="-335" r="28"/><circle cx="235" cy="-310" r="22"/>
      <circle cx="-260" cy="155" r="24"/><circle cx="230" cy="290" r="31"/>
    </g>
  </g>
  <path d="M0 1690 C330 1580 560 1740 820 1670 C1080 1600 1220 1510 1400 1570 L1400 2000 L0 2000Z" fill="#11170d" opacity=".6"/>`,
);

const paras = (texts: string[]): Doc['blocks'] =>
  texts.map((text) => ({ id: uid(), type: 'paragraph' as const, text }));

// ---- Paper family (academic research highlight) ----------------------------

function makePaper1(): Doc {
  return { ...sampleDoc(), templateId: 'paper-1' };
}

function makePaper2(): Doc {
  const d = emptyDoc();
  const photoId = uid();
  d.templateId = 'paper-2';
  d.meta = {
    categoryLabel: 'Research Highlight · Condensed Matter',
    title: 'Superconductivity near room temperature in a hydride lattice',
    subtitle: 'A pressure-stabilised Im-3m phase carries current without resistance close to 294 K',
    author: 'N. Farid, L. Chandra & P. M. Wong',
    affiliation: 'Universiti Sains Malaysia',
    masthead: 'Research Highlights',
    heroCaption: 'The hydrogen cage at 180 GPa, resolved by synchrotron diffraction.',
  };
  d.design = {
    ...d.design,
    // 3 body columns + the highlights rail = the 4-column grid the sheet-1 split
    // is drawn against: header on 1–2, hero on 3–4.
    bodyCols: 3,
    // A 43mm column plus justify is a river of spaces.
    bodyAlign: 'left',
    sidebar: true,
    highlightsPlacement: 'page1',
    margin: 12,
    heroHeight: 112,
    // The header is two columns (~90mm), not the full sheet: 30pt puts a word
    // like "Superconductivity" wider than the measure, and Chrome won't
    // hyphenate that one, so it sails under the hero.
    sizes: { ...d.design.sizes, title: 24, subtitle: 11 },
    colors: { hero: '#1e1b4b', accent: '#4338ca', accentSoft: '#e5e4fb', ink: '#111418' },
    barColor: '#111418',
    barTagColor: '#bfbfbf',
    barTagInk: '#111418',
  };
  d.hero = { assetId: photoId, offsetX: 0, offsetY: 0, scale: 1 };
  d.assets = { [photoId]: { src: PHOTO_LATTICE, naturalWidth: 1600, naturalHeight: 900 } };
  d.blocks = paras([
    'A superconductor expels magnetic fields and carries current with zero resistance, but until recently only far below room temperature. Compressed hydrogen-rich compounds change the picture: light hydrogen atoms vibrate fast, coupling strongly to electrons and driving pairing at unprecedented temperatures.',
    'Our sample is a rare-earth polyhydride squeezed to 180 gigapascals in a diamond anvil cell. X-ray diffraction confirms a body-centred cubic hydrogen cage, and a sharp resistance drop marks a transition at 294 kelvin — a degree below a warm room.',
    'The Meissner effect and the shift of the transition under an applied field together rule out artefacts, pointing to genuine phonon-mediated superconductivity. The remaining challenge is pressure: recovering the phase at ambient conditions would turn a laboratory marvel into a technology.',
    'Pressure is generated between two brilliant-cut diamonds whose tips are polished to a flat some thirty micrometres across. The sample sits in a rhenium gasket no thicker than a sheet of paper, together with a ruby chip whose fluorescence reads out the pressure to within a few gigapascals.',
    'Measuring resistance through that assembly is its own craft. Four electrodes are sputtered directly onto the diamond culet and insulated from the gasket, so the current path runs through the sample and nothing else. A false contact would mimic exactly the signal the experiment is looking for, which is why every run is repeated on a fresh loading.',
    'What makes the hydride family compelling is that the pairing needs no exotic mechanism. Hydrogen is the lightest element, its lattice vibrations are the fastest available, and conventional electron-phonon theory predicts the transition temperatures we observe without adjustment. The physics is textbook; the pressure is not.',
    'Densities of states computed for the Im-3m phase place the Fermi level on a broad hydrogen-derived peak, and the calculated coupling constant reproduces the measured onset within a few kelvin. That agreement is the strongest argument that the cage, and not some surface artefact, carries the current.',
    'Ambient-pressure recovery remains the open problem. Chemical pre-compression — substituting a larger rare-earth ion to squeeze the hydrogen sublattice without an anvil — is the most promising route, and the one the group is now pursuing.',
  ]);
  d.highlights = [
    'Zero-resistance transition observed at 294 K under 180 GPa pressure.',
    'Body-centred cubic hydrogen cage confirmed by synchrotron diffraction.',
    'Field-dependent transition rules out non-superconducting artefacts.',
  ];
  d.references = [
    { id: uid(), authors: 'Farid, N. et al.', title: 'Near-ambient superconductivity in a rare-earth polyhydride', journal: 'Nature', year: '2025', doi: '10.1038/s41586-025-00000-0' },
  ];
  return d;
}

// ---- Magazine family (editorial spread) ------------------------------------

interface MagInput {
  id: TemplateId;
  photo: string;
  accent: string;
  accentSoft: string;
  categoryLabel: string;
  title: string;
  subtitle: string;
  author: string;
  affiliation: string;
  volume: string;
  location: string;
  photoCredit: string;
  pullQuote: string;
  pullQuoteBy: string;
  body: string[];
}

function makeMagazine(m: MagInput): Doc {
  const d = emptyDoc();
  const photoId = uid();
  const coverId = uid();
  d.templateId = m.id;
  d.meta = {
    masthead: 'KUANTA',
    categoryLabel: m.categoryLabel,
    title: m.title,
    subtitle: m.subtitle,
    author: m.author,
    affiliation: m.affiliation,
    volume: m.volume,
    location: m.location,
    photoCredit: m.photoCredit,
    pullQuote: m.pullQuote,
    pullQuoteBy: m.pullQuoteBy,
  };
  // Design defaults that the Design panel can then tune (columns/align/gutter/
  // body size/fonts/colors all feed the magazine CSS via CSS vars).
  d.design = {
    ...d.design,
    subtitleGap: defaultSubtitleGap(m.id),
    // These photo-cover presets deliberately begin with light heading copy.
    // Clearing either override in Design restores live theme-Ink inheritance.
    ...(m.id === 'magazine-1' || m.id === 'magazine-3' ? {
      subtitleColor: '#eef2f7',
      authorColor: '#cbd5e1',
    } : {}),
    bodyCols: 2,
    gutter: 8,
    bodyAlign: 'justify',
    fontDisplay: 'Playfair Display', // serif elements (quote, lede, drop cap)
    sizes: {
      ...d.design.sizes,
      body: 10.5,
      ...(m.id === 'magazine-1' ? { subtitle: 13, author: 8.5 } : {}),
      ...(m.id === 'magazine-3' ? { subtitle: 14, author: 8.5 } : {}),
    },
    colors: { hero: '#0b1220', accent: m.accent, accentSoft: m.accentSoft, ink: '#14181f' },
  };
  d.hero = { assetId: photoId, offsetX: 0, offsetY: 0, scale: 1 };
  // Cover (page 1) starts from the same photo but is its own asset, so replacing
  // one image never touches the other.
  d.cover = { assetId: coverId, offsetX: 0, offsetY: 0, scale: 1 };
  d.assets = {
    [photoId]: { src: m.photo, naturalWidth: 1600, naturalHeight: 900 },
    [coverId]: { src: m.photo, naturalWidth: 1600, naturalHeight: 900 },
  };
  d.blocks = paras(m.body);
  d.highlights = [];
  d.references = [];
  return d;
}

const makeMagazine1 = (): Doc => {
  const d = makeMagazine({
    id: 'magazine-1',
    photo: PHOTO_OBSERVATORY,
    accent: '#e11d2e',
    accentSoft: '#fde7ea',
    categoryLabel: 'COVER STORY',
    title: 'UNRAVELING SECRETS OF THE UNIVERSE',
    subtitle:
      'At a freezing four thousand meters, a giant mirror captures light that has traveled billions of years to reach our eyes.',
    author: 'DR. ARIA PRATAMA',
    affiliation: 'KUANTA — Astrophysics Section',
    volume: 'VOL. IX · NO.2 · MARCH 2026',
    location: 'MAUNA OBSERVATORY · 4,200 M ASL',
    photoCredit: 'L. HAKIM',
    pullQuote:
      'Every photon falling onto this mirror is a courier from the past—a message sent long before Earth existed.',
    pullQuoteBy: '— DR. ARIA PRATAMA, FEB 2026',
    body: [
      'The temperature at the summit touches minus twelve as the giant dome slowly opens. Inside, an eight-meter mirror waits—polished to a smoothness of a millionth of a millimeter, enough to capture starlight older than Earth.',
      'Four thousand two hundred meters above sea level, the air is so thin and dry that stars no longer twinkle. Here astronomers hunt ancient photons: light particles that departed distant galaxies long before our Sun was lit.',
      'Every clear night is a narrow window into the deep past. The further the observed object, the older its light—so looking into space is truly looking back along cosmic history to its earliest edges.',
      'The data flowing from the detector is not an ordinary image, but a spectrum: a rainbow broken into bright and dark lines. From this pattern, physicists read the composition, temperature, and speed of celestial bodies receding with cosmic expansion.',
      'As astronomical dawn approaches, the eastern sky begins to glow purple. The dome slowly closes, preserving its silence. But inside cold servers at the foot of the mountain, the newly recorded universe begins to be unraveled—one photon, one clue, one chapter of a story that started fourteen billion years ago.',
    ],
  });
  // Highlights ride the flow's tail as a full-width band under the article.
  d.design.highlightsPlacement = 'below';
  d.highlights = [
    'Eight-meter mirror polished to a millionth of a millimeter to capture ancient photons.',
    'At 4,200 m ASL, dry air eliminates star twinkling—ideal for hunting distant galaxy light.',
    'Light spectra break into bright-dark lines, revealing composition, temperature, and speed.',
  ];
  return d;
};

/** magazine-2 splits one photo across sheets 1–2, and its sheet 1 carries the
 *  quote + a highlights box in the foot, so unlike the other magazines it ships
 *  with highlights filled in. */
const makeMagazine2 = (): Doc => {
  const d = makeMagazine({
    id: 'magazine-2',
    photo: PHOTO_COLLIDER,
    accent: '#0891b2',
    accentSoft: '#cffafe',
    categoryLabel: 'FRONTIER SCIENCE',
    title: 'COLLISIONS AT THE HEART OF MATTER',
    subtitle:
      'In a twenty-seven kilometer circular tunnel, protons are accelerated to near light speed and smashed together—unveiling the building blocks of reality.',
    author: 'DR. SINTA HALIM',
    affiliation: 'KUANTA — Particle Physics Section',
    volume: 'VOL. IX · NO.3 · APRIL 2026',
    location: 'ACCELERATOR FACILITY · 27 KM TUNNEL',
    photoCredit: 'B. NUGROHO',
    pullQuote:
      'In a flash lasting a fraction of a trillionth of a second, energy condenses into particles never seen before.',
    pullQuoteBy: '— DR. SINTA HALIM, MAR 2026',
    // Sized to the two columns beside the photo strip: the article closes on
    // sheet 1 so the spread stays two sheets — article + photo — as designed.
    body: [
      'One hundred meters underground, two proton beams speed in opposite directions inside a vacuum pipe emptier than interplanetary space. Superconducting magnets as cold as minus two hundred seventy-one degrees bend their paths into a perfect ring.',
      'When the two beams collide, the impact energy instantly condenses into a shower of particles. Here theory is tested: every scattered fragment is recorded by a building-tall detector, layer by layer, to reconstruct what actually occurred.',
      'Most collisions merely repeat known physics. But once in billions of events, a rare pattern emerges—the signature of a heavy particle vanishing instantly, leaving clues about the field that imparts mass to all matter.',
      'Analyzing it is not the work of a single night. Software filters millions of collisions per second, discarding the mundane and saving the promising. From this sea of data, the fundamental map of matter is redrawn.',
    ],
  });
  // The photo strip leaves a narrow text box on sheet 1; left-aligned, since a
  // column that narrow plus justify is a river of spaces.
  d.design.bodyAlign = 'left';
  d.design.sizes = { ...d.design.sizes, title: 34, subtitle: 11 };
  d.highlights = [
    'Two proton beams collide at 13 TeV collision energy inside a 27 km ring.',
    'Detectors record collision tracks layer by layer, millions of times per second.',
    'One-in-a-billion rare patterns provide clues about the mass-giving field.',
  ];
  return d;
};

const makeMagazine3 = (): Doc => {
  const d = makeMagazine({
    id: 'magazine-3',
    photo: PHOTO_BLACKHOLE,
    accent: '#d97706',
    accentSoft: '#fef0d9',
    categoryLabel: 'FEATURE REPORT',
    title: 'ECHOES FROM A BLACK HOLE',
    subtitle:
      'Two dark giants spiraled and merged, shaking space-time—and their waves reached Earth as a whisper as faint as a thousandth of a proton diameter.',
    author: 'DR. AGUS RIYANTO',
    affiliation: 'KUANTA — Cosmology Section',
    volume: 'VOL. IX · NO.4 · MAY 2026',
    location: 'GRAVITATIONAL WAVE DETECTOR · 4 KM ARMS',
    photoCredit: 'M. FAUZI',
    pullQuote:
      'For the first time, humanity is not merely gazing at the universe—we are listening to it.',
    pullQuoteBy: '— DR. AGUS RIYANTO, APR 2026',
    body: [
      'One point three billion years ago, in a distant corner of the universe, two black holes chased each other in a deadly dance. Each ten times heavier than the Sun, they spiraled faster and faster until finally merging in a fraction of a second.',
      'The event released more energy than all the starlight in the cosmos combined—yet not a single bit as light. It all flowed as gravitational waves: ripples in the fabric of space-time itself.',
      'The waves traveled for over a billion years, stretching and compressing every galaxy they passed bit by bit. When they finally swept over Earth, they shifted detector mirrors by a thousandth of a proton width.',
      'Capturing so tiny a shift required near-impossible precision: two four-kilometer laser arms isolated from traffic vibrations, earthquakes, and distant ocean waves.',
      'The signal lasted less than a fifth of a second—a rising chirp that fell silent. Yet in that chirp was recorded the birth of a new science: an astronomy that listens to the pulse of the universe.',
    ],
  });
  // Gatefold: the cover photo is split across the two facing sheets, so it wants
  // a wide image rather than the 16:9 hero.
  const coverId = d.cover?.assetId;
  if (coverId) d.assets[coverId] = { src: PHOTO_COSMOS_WIDE, naturalWidth: 2400, naturalHeight: 1700 };
  return d;
};

/** A single-sheet front cover. Body paragraphs are repurposed as the three
 * editable teaser cards at the foot instead of flowing onto article pages. */
const makeMagazine4 = (): Doc => {
  const d = makeMagazine({
    id: 'magazine-4',
    photo: PHOTO_MICROSCAPE,
    accent: '#f59e0b',
    accentSoft: '#fef3c7',
    categoryLabel: 'MICROBIOLOGY',
    title: 'THE HIDDEN ARCHITECTS OF LIFE',
    subtitle: 'Inside the microscopic communities that quietly shape every living system.',
    author: 'DR. MAYA ISKANDAR',
    affiliation: 'RESEARCH · SCIENCE FOR A BETTER FUTURE',
    volume: '',
    location: 'SPECIAL COVER STORY',
    photoCredit: 'IMAGING SCIENCE UNIT',
    pullQuote: '',
    pullQuoteBy: '',
    body: [
      'QUANTUM POWER\nNew instruments reveal how energy moves at nature’s smallest scales.',
      'MICROBES AT WORK\nThe cooperative networks sustaining soil, oceans, and human health.',
      'DETECTING THE INVISIBLE\nA new generation of sensors turns faint signals into clear evidence.',
    ],
  });
  const heroId = d.hero.assetId;
  const coverId = d.cover?.assetId;
  if (heroId) d.assets[heroId] = { src: PHOTO_MICROSCAPE, naturalWidth: 1400, naturalHeight: 2000 };
  if (coverId) d.assets[coverId] = { src: PHOTO_MICROSCAPE, naturalWidth: 1400, naturalHeight: 2000 };
  d.design = {
    ...d.design,
    bodyAlign: 'left',
    sidebar: false,
    highlightsPlacement: 'page1',
    fontDisplay: 'Avenir Next',
    fontBody: 'Avenir Next',
    fontCategory: 'Avenir Next',
    fontSubtitle: 'Avenir Next',
    fontAuthor: 'Avenir Next',
    fontAffiliation: 'Avenir Next',
    frontCover: {
      alignment: 'left',
      storyTop: 15,
      storyWidth: 88,
      overlayOpacity: 0.68,
      kickerBackground: '#f59e0b',
      teaserBackground: '#071006',
      teaserBackgroundOpacity: 0.45,
    },
    margin: 11,
    gutter: 5,
    sizes: {
      ...d.design.sizes,
      categoryLabel: 8,
      title: 43,
      subtitle: 11,
      author: 8,
      affiliation: 7.5,
      body: 7.5,
    },
    colors: {
      hero: '#252d16',
      accent: '#f59e0b',
      accentSoft: '#fef3c7',
      ink: '#f8fafc',
    },
  };
  d.highlights = [];
  d.references = [];
  d.images = [];
  return d;
};

// ---- Registry --------------------------------------------------------------

export const TEMPLATES: (TemplateMeta & { make: () => Doc })[] = [
  { id: 'paper-1', family: 'paper', name: 'Paper 1', kind: 'Academic Journal', make: makePaper1 },
  { id: 'paper-2', family: 'paper', name: 'Paper 2', kind: 'Physics Letter', make: makePaper2 },
  { id: 'magazine-1', family: 'magazine', name: 'Magazine 1', kind: 'Modern Editorial', make: makeMagazine1 },
  { id: 'magazine-2', family: 'magazine', name: 'Magazine 2', kind: 'Particle Feature', make: makeMagazine2 },
  { id: 'magazine-3', family: 'magazine', name: 'Magazine 3', kind: 'Cosmos Gatefold', make: makeMagazine3 },
  { id: 'magazine-4', family: 'magazine', name: 'Magazine Cover', kind: 'Front Page Only', make: makeMagazine4 },
  { id: 'gallery-1', family: 'gallery', name: 'Gallery 1', kind: 'Photo Spread', make: makeGallery1 },
  { id: 'gallery-2', family: 'gallery', name: 'Gallery 2', kind: 'Centre Fold', make: makeGallery2 },
  { id: 'gallery-3', family: 'gallery', name: 'Gallery 3', kind: 'Mosaic Band', make: makeGallery3 },
  { id: 'gallery-4', family: 'gallery', name: 'Gallery 4', kind: 'Long Read', make: makeGallery4 },
];

export const TEMPLATE_META: TemplateMeta[] = TEMPLATES.map(({ id, family, name, kind }) => ({
  id,
  family,
  name,
  kind,
}));

/** Fresh preset Doc for a template id (fresh so ids/assets aren't shared). */
export function presetFor(id: TemplateId): Doc {
  return (TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]).make();
}
