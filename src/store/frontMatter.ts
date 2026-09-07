import { emptyDoc, uid, type Doc, type TemplateId, type FrontMatter } from '../schema/document';

export const emptyFrontMatter = (): FrontMatter => ({
  entries: [], aboutTitle: 'About the magazine', about: '',
  noteTitle: 'In this issue', note: '', contact: '', signoff: 'With best wishes,', pageStart: 1,
});

/** Original, embedded placeholder artwork: no remote image dependency. */
const scienceArt = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="900" viewBox="0 0 1400 900">
  <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#102e38"/><stop offset="1" stop-color="#071518"/></linearGradient>
  <radialGradient id="orb"><stop stop-color="#dfe8c7"/><stop offset=".5" stop-color="#68b6a4"/><stop offset="1" stop-color="#173f48"/></radialGradient></defs>
  <rect width="1400" height="900" fill="url(#bg)"/>
  <g fill="none" stroke="#63a99c" opacity=".35">${Array.from({length:12},(_,i)=>`<ellipse cx="700" cy="450" rx="${140+i*35}" ry="${60+i*22}" transform="rotate(${i*15} 700 450)"/>`).join('')}</g>
  <g fill="url(#orb)">${[[340,370,130],[780,270,95],[1080,570,180],[650,600,65]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
  <g fill="#e6bf74">${[[205,205],[520,160],[590,440],[910,700],[1220,290]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="5"/>`).join('')}</g></svg>`);

export function makeFrontMatter(id: TemplateId): Doc {
  const d = emptyDoc();
  d.templateId = id;
  d.highlights = []; d.blocks = []; d.images = [];
  d.design.sidebar = false;
  d.design.bodyCols = 2;
  d.design.bodyAlign = 'left';
  d.design.margin = 14;
  d.design.gutter = 6;
  d.design.heroHeight = 62;
  d.design.fontDisplay = 'Playfair Display';
  d.design.fontBody = 'Helvetica';
  d.design.fontSubtitle = 'Helvetica';
  d.design.sizes = { title: 34, subtitle: 11, author: 10, affiliation: 9, categoryLabel: 8, body: 10 };
  d.design.colors = { hero: '#143a40', ink: '#182d33', accent: '#ae792e', accentSoft: '#eee6d7' };
  d.design.paperBg = '#fcfbf8';
  d.design.barColor = '#143a40';
  d.meta.masthead = 'The Physicist';
  d.meta.volume = 'Issue 01 · 2026';
  d.frontMatter = emptyFrontMatter();
  d.frontMatter.contact = 'School of Physics · Universiti Sains Malaysia';
  d.assets['frontmatter-art'] = { src: scienceArt, naturalWidth: 1400, naturalHeight: 900 };
  d.cover = { assetId: 'frontmatter-art', offsetX: 0, offsetY: 0, scale: 1 };
  if (id === 'frontmatter-dean') {
    d.meta.categoryLabel = 'From the dean';
    d.meta.title = 'A future shaped\nby curiosity';
    d.meta.subtitle = 'A message to our students, colleagues and friends.';
    d.meta.author = 'Professor [Dean’s name]';
    d.meta.affiliation = 'Dean · School of Physics';
    d.frontMatter.noteTitle = 'Inside this issue';
    d.frontMatter.note = 'Meet the people asking new questions, building new instruments and opening new possibilities for science.';
    d.frontMatter.pageStart = 3;
    d.blocks = [
      'Dear readers,',
      'Every discovery begins with a question. In our classrooms and laboratories, curiosity connects people across subjects, generations and borders. This magazine celebrates that shared spirit of enquiry.',
      'Within these pages, you will meet students and researchers who are turning ideas into experiments. Their work reminds us that progress is rarely the achievement of one person. It grows through collaboration, patience and the willingness to learn from an unexpected result.',
      'Our responsibility as a school extends beyond the laboratory. We want young people to see science as something they can participate in, and our wider community to understand why research matters. Clear, honest communication is an essential part of that work.',
      'This issue is also an invitation. Ask questions, explore a subject outside your own field and share what you learn. The next useful idea may begin in a conversation between people who see the world differently.',
      'To our colleagues, students, alumni and partners: thank you for the care and energy you bring to our community. Together, we can create a place where ambitious ideas are welcomed and knowledge is shared generously.',
      'I hope these stories leave you informed, encouraged and curious about what comes next.',
    ].map(text => ({ id: uid(), type: 'paragraph', text }));
  } else if (id === 'frontmatter-contents') {
    d.meta.categoryLabel = 'The issue at a glance';
    d.meta.title = 'Contents';
    d.meta.subtitle = 'Ideas, discoveries and the people behind them.';
    d.frontMatter.noteTitle = 'On the cover';
    d.frontMatter.note = 'Small structures. Extraordinary possibilities. Discover the science of materials, from the laboratory to everyday life.';
    d.frontMatter.entries = [
      ['03', 'From the dean', 'A future shaped by curiosity'],
      ['04', 'People', 'Meet the minds behind the discoveries'],
      ['08', 'Research highlights', 'Fresh perspectives from across the School of Physics'],
      ['10', 'Seeing the invisible', 'How tiny particles reveal the hidden world of materials'],
      ['14', 'Light at work', 'New ways to sense, communicate and explore'],
      ['18', 'The next generation', 'Student voices and ideas worth sharing'],
      ['22', 'In the laboratory', 'A closer look at the tools that make discovery possible'],
      ['26', 'Beyond the campus', 'Bringing science into our communities'],
      ['30', 'Perspectives', 'What comes next for physics?'],
    ].map(([page,title,text]) => ({id:uid(),page,title,text}));
  } else {
    d.meta.categoryLabel = 'The people behind the pages';
    d.meta.title = 'Editorial board';
    d.meta.subtitle = 'A shared commitment to clear, thoughtful science communication.';
    d.design.colors.accent = '#dfb574';
    d.design.colors.ink = '#f0efea';
    d.design.paperBg = '#172c30';
    d.design.barColor = '#dfb574';
    d.frontMatter.about = 'The Physicist brings research, education and the people of our physics community into focus. We make complex ideas approachable without losing the wonder of discovery.\n\nPublished by the School of Physics, Universiti Sains Malaysia.\n\nThis is a sample masthead. Replace the roles, names and publication details with your own.';
    d.frontMatter.entries = [
      ['Patron', 'Professor [Name]\nDean, School of Physics'],
      ['Editor-in-chief', 'Dr. [Name]'],
      ['Managing editor', '[Name]'],
      ['Research editors', 'Dr. [Name]\nDr. [Name]\nDr. [Name]'],
      ['Contributing editors', '[Name]\n[Name]\n[Name]'],
      ['Design & photography', '[Name]\n[Name]'],
      ['Editorial advisers', 'Professor [Name]\nProfessor [Name]'],
      ['Contact the team', 'Replace with your editorial email\nand publication website'],
    ].map(([title,text]) => ({id:uid(),title,text}));
  }
  return d;
}
