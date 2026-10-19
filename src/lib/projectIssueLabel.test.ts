import {describe,it,expect} from 'vitest';
import {withProjectIssueLabel} from './projectIssueLabel';
import {TEMPLATES,presetFor} from '../store/presets';
describe('project issue label',()=>{
 it.each(TEMPLATES.map(template=>template.id))('%s defaults to the project name without mutating the source',id=>{
  const doc=presetFor(id),before=JSON.stringify(doc);
  expect(withProjectIssueLabel(doc,'FIRST ISSUE, 2026').meta.volume).toBe('FIRST ISSUE, 2026');
  expect(JSON.stringify(doc)).toBe(before);
 });
 it('follows a renamed project but preserves explicit custom and blank labels',()=>{
  const doc=presetFor('paper-8');doc.meta.volumeMode='project';doc.meta.volume='Old project';
  expect(withProjectIssueLabel(doc,'New project').meta.volume).toBe('New project');
  doc.meta.volumeMode='custom';doc.meta.volume='Custom issue';expect(withProjectIssueLabel(doc,'New').meta.volume).toBe('Custom issue');
  doc.meta.volume='';expect(withProjectIssueLabel(doc,'New').meta.volume).toBe('');
 });
 it('leaves local documents alone',()=>{const doc=presetFor('paper-8');expect(withProjectIssueLabel(doc)).toBe(doc);});
});
