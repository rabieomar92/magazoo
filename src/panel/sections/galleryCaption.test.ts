import { expect, it } from 'vitest';
import { splitCaption, joinCaption } from '../../lib/galleryCaption';
it('preserves spaces while typing caption titles and descriptions', () => {
  for (const title of ['Light ', 'Light on a chip', '  عنوان الصورة  ', 'two  spaces']) {
    expect(splitCaption(joinCaption(title, 'Description '))).toEqual({title,desc:'Description '});
  }
});
