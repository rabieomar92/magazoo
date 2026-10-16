import { describe, expect, it } from 'vitest';
import { TEMPLATE_META, presetFor } from '../store/presets';
import { IMAGE_LED_COMPOSITIONS, isImageLedTemplate, templateChoiceId, templateChoices, templateDisplayName } from './templateChoices';

describe('consolidated image-led layout choices', () => {
  it('shows one family entry without removing supported document templates', () => {
    const before = JSON.stringify(TEMPLATE_META);
    const choices = templateChoices(TEMPLATE_META);
    expect(choices.filter(choice => isImageLedTemplate(choice.id)).map(choice => choice.id)).toEqual(['paper-3']);
    expect(choices.find(choice => choice.id === 'paper-3')).toMatchObject({ name: 'Image-led Feature', kind: '3 compositions' });
    expect(choices.filter(choice => !isImageLedTemplate(choice.id))).toEqual(TEMPLATE_META.filter(choice => !isImageLedTemplate(choice.id)));
    expect(JSON.stringify(TEMPLATE_META)).toBe(before);
  });

  it.each(IMAGE_LED_COMPOSITIONS)('keeps $id as its existing renderer and preset', composition => {
    expect(templateChoiceId(composition.id)).toBe('paper-3');
    expect(presetFor(composition.id).templateId).toBe(composition.id);
    expect(templateDisplayName(composition.id, TEMPLATE_META)).toBe(`Image-led Feature — ${composition.name}`);
  });

  it('keeps unrelated choices and names unchanged', () => {
    expect(templateChoiceId('paper-8')).toBe('paper-8');
    expect(templateDisplayName('paper-8', TEMPLATE_META)).toBe('Article 8');
    expect(isImageLedTemplate('paper-8')).toBe(false);
  });
});
