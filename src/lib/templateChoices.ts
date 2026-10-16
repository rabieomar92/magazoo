import type { TemplateId } from '../schema/document';
import type { TemplateMeta } from '../store/presets';

/** Related image-first compositions share one place in the chooser. The saved
 * renderer IDs stay intact: opening a document never converts its layout. */
export const IMAGE_LED_COMPOSITIONS = [
  { id: 'paper-3', name: 'Editorial', description: 'Image-led story with a flexible hero' },
  { id: 'paper-4', name: 'Immersive bleed', description: 'Tall image with an inset headline' },
  { id: 'paper-5', name: 'Panoramic bleed', description: 'Wide image with a full-width headline' },
] as const;

export type ImageLedTemplateId = typeof IMAGE_LED_COMPOSITIONS[number]['id'];

export function isImageLedTemplate(id: TemplateId): id is ImageLedTemplateId {
  return IMAGE_LED_COMPOSITIONS.some(composition => composition.id === id);
}

export function templateChoiceId(id: TemplateId): TemplateId {
  return isImageLedTemplate(id) ? 'paper-3' : id;
}

export function templateChoices(templates: readonly TemplateMeta[]): TemplateMeta[] {
  return templates.filter(template => template.id !== 'paper-4' && template.id !== 'paper-5')
    .map(template => template.id === 'paper-3'
      ? { ...template, name: 'Image-led Feature', kind: '3 compositions' }
      : template);
}

export function templateDisplayName(id: TemplateId, templates: readonly TemplateMeta[]): string {
  const composition = IMAGE_LED_COMPOSITIONS.find(item => item.id === id);
  return composition ? `Image-led Feature — ${composition.name}`
    : templates.find(template => template.id === id)?.name ?? id;
}
