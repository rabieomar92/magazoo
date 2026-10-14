import { describe, expect, it } from 'vitest';
import { checkWriting } from './writingCheck';

describe('private bilingual writing checks',()=>{
  it('checks English agreement, articles, repeated words and punctuation with source offsets',()=>{
    const text='They is studying a electron ,and the the atom could of moved!!';
    const result=checkWriting(text,'en');
    expect(result.language).toBe('en');
    expect(result.issues.map(i=>text.slice(i.start,i.end))).toEqual(expect.arrayContaining(['They is','a electron',' ,',',','the the','could of','!!']));
    expect(result.issues.find(i=>i.suggestion==='an electron')).toBeTruthy();
  });
  it('detects Bahasa Melayu and distinguishes passive prefixes from location words',()=>{
    const text='Cahaya ini di gunakan untuk mengkaji zarah yang ada dimakmal.';
    const result=checkWriting(text);
    expect(result.language).toBe('ms');
    expect(result.issues.map(i=>i.suggestion).filter(Boolean)).toEqual(['digunakan','di makmal']);
    expect(checkWriting('Alat ini digunakan di makmal untuk mengkaji zarah.','ms').issues).toEqual([]);
  });
  it('supports manual language choice for mixed and short passages',()=>{
    expect(checkWriting('di ukur','ms').issues[0].suggestion).toBe('diukur');
    expect(checkWriting('They is here.','en').issues).toHaveLength(1);
    expect(checkWriting('They is here.','ms').issues).toHaveLength(0);
  });
  it('does not treat Malay reduplication as duplicated English words',()=>{
    expect(checkWriting('Kanak-kanak dan guru-guru melihat alat ini.','ms').issues).toEqual([]);
  });
  it('ignores URLs, email, maths, code and valid rich formatting without creating spacing errors',()=>{
    const text='Read **this** and __that__. Try $E = mc^2$ now. Visit https://example.com/a,b or me@example.com. Use `a  a` here.';
    expect(checkWriting(text).issues).toEqual([]);
  });
  it('detects unmatched formatting and brackets',()=>{
    expect(checkWriting('Read **this (carefully.').issues.map(i=>i.kind)).toEqual(['formatting','punctuation']);
  });
  it('counts abbreviations and decimal values without inflating sentence totals',()=>{
    const result=checkWriting('Dr. Lim measured 2.5 metres. Prof. Ali checked the result.');
    expect(result.sentences).toBe(2);
  });
  it('counts each newline and paragraph, including unfinished lines',()=>{
    const result=checkWriting('First line\nSecond line\n\nThird line.');
    expect(result.words).toBe(6);expect(result.sentences).toBe(3);expect(result.average).toBe(2);
  });
  it('reports sentence length without assigning a reading age or penalising scientific words',()=>{
    const result=checkWriting('Photosynthesis transforms sunlight into chemical energy.');
    expect(result.shortPercent).toBe(100);expect(result.longSentences).toBe(0);expect(result).not.toHaveProperty('grade');
  });
  it('offers long-sentence guidance in both languages and keeps punctuation offsets after markup',()=>{
    for(const language of ['en','ms'] as const){
      const result=checkWriting(Array(32).fill('word').join(' ')+'.',language);
      expect(result.longSentences).toBe(1);expect(result.average).toBe(32);
    }
    const text='**Hello**,world.';const issue=checkWriting(text).issues[0];
    expect(text.slice(issue.start,issue.end)).toBe(',');
  });
  it('handles empty text and literal newline escapes without spurious word-space errors',()=>{
    expect(checkWriting('').average).toBe(0);
    expect(checkWriting('Light travels.\\nSound travels.').issues).toEqual([]);
  });
});
