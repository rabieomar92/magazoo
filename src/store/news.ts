import { emptyDoc, uid, type Doc, type NewsStory } from '../schema/document';
import { isTextOnly } from '../lib/newsLayout';

export const newNewsStory = (): NewsStory => ({ id: uid(), title: 'New brief', text: '', caption: '', source: '', layout: 'compact' });

/** Embedded original illustrations, explicitly labelled as sample artwork. */
function artwork(color: string, variant: number) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850">
  <defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#102f34"/></linearGradient></defs>
  <rect width="1200" height="850" fill="url(#bg)"/>
  <g fill="none" stroke="#d5e8d7" stroke-width="2" opacity=".35">${Array.from({length:10},(_,i)=>`<ellipse cx="600" cy="425" rx="${190+i*27}" ry="${75+i*23}" transform="rotate(${variant*20+i*14} 600 425)"/>`).join('')}</g>
  <circle cx="600" cy="425" r="125" fill="#e9ba6e"/><circle cx="650" cy="385" r="87" fill="#f6dfac"/>
  <g fill="#e6efe8">${[0,1,2,3,4].map(i=>`<circle cx="${185+i*210}" cy="${210+(i%2)*420}" r="13"/>`).join('')}</g></svg>`);
}

export function makeNews(): Doc {
  const d = emptyDoc();
  d.templateId = 'news-briefs';
  d.meta = { masthead: 'News & briefs', categoryLabel: '', title: '', subtitle: '', author: '', affiliation: '', volume: 'School of Physics · 2026' };
  d.blocks = []; d.highlights = []; d.references = [];
  d.design = { ...d.design, sidebar: false, bodyAlign: 'left', margin: 14, gutter: 5, heroHeight: 78,
    fontDisplay: 'Playfair Display', fontBody: 'Helvetica', fontSubtitle: 'Helvetica',
    colors: { hero: '#164f43', accent: '#087647', accentSoft: '#e7eeea', ink: '#182b26' },
    barColor: '#e5e7e6', barTagColor: '#087647', barTagInk: '#ffffff',
    sizes: { ...d.design.sizes, title: 23, subtitle: 11, body: 9.4 } };
  d.footer = { text: 'The Physicist · School of Physics', startNumber: 6, bottomOffset: 9, fontSize: 7 };
  const stories: NewsStory[] = [
    { ...newNewsStory(), layout: 'lead', title: 'Opening the laboratory to new ideas',
      text: 'A laboratory visit can turn an abstract question into something students can see and discuss. Meeting researchers gives visitors a closer look at the tools, teamwork and careful thinking behind an experiment.\n\nA useful demonstration begins with a simple question. What do we want to measure? What might change the result? Students can compare their predictions with observations and ask why the two sometimes differ.\n\nUse this lead story to report a campus visit, a new partnership or a research milestone. Replace this sample copy with the names, date and verified details of your own news.',
      caption: 'Sample science illustration. Replace with a photograph and a descriptive caption.' },
    { ...newNewsStory(), title: 'Small instruments, bigger questions',
      text: 'Good research does not always begin with the largest machine. A carefully designed sensor can reveal a small change in light, temperature or movement that would otherwise go unnoticed.\n\nResearchers test their instruments against known measurements before using them to investigate something new. Repeated checks help the team understand both the signal and the limits of the instrument.\n\nThis compact brief is a place for an equipment update or a short report from your laboratory.',
      caption: 'Sample illustration for a laboratory update.' },
    { ...newNewsStory(), layout: 'aside', title: 'From the campus calendar',
      text: 'A public talk is a chance to connect a research question with everyday life. Start your event brief with the topic, who it is for, and why a visitor might find it interesting.\n\nInclude the confirmed date, time, venue and registration details before publication. A short, clear invitation helps readers decide whether they would like to attend.\n\nThis side column runs beside the brief above it. You can add more briefs, change their order, attach a photograph or start a story on a fresh page.' },
    { ...newNewsStory(), layout: 'lead', breakBefore: true, title: 'Science grows through collaboration',
      text: 'When people with different skills work together, they can approach a question from several directions. One team may design a material, another may measure its properties, and a third may build a model to explain the results.\n\nA partnership becomes useful through the everyday exchange of ideas, methods and evidence. Students also gain opportunities to learn how other laboratories work.\n\nUse this space to introduce a collaboration and explain what the partners hope to achieve. This is sample editorial copy, not a report of an actual event.',
      caption: 'Original sample artwork. Add your team or campus photograph here.' },
  ];
  const palette = ['#337a65','#306879','#74634a'];
  let illustration = 0;
  stories.forEach(story => {
    if (isTextOnly(story.layout)) return;
    const id = uid();
    d.assets[id] = { src: artwork(palette[illustration % palette.length], illustration), naturalWidth:1200, naturalHeight:850 };
    story.assetId = id;
    illustration++;
  });
  d.news = { stories };
  return d;
}
