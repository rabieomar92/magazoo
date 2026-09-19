export const CONTENTS_ID = '__contents__';

export function issueError(status, message) {
  throw Object.assign(new Error(message), { status });
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value, min, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;

/** Keep editor settings across saves, accepting only the supported fields. */
function contentsSettings(plan, ids) {
  const result = {};
  if (plan.contentsDesign !== undefined) {
    if (!object(plan.contentsDesign)) issueError(400, 'Invalid contents design.');
    const design = {};
    const enums = { layout: ['mosaic', 'feature', 'sections'], density: ['auto', 'airy', 'normal', 'dense', 'packed'], titleFont: ['serif', 'sans'], pictures: ['auto', 'all', 'none'], columns: [1, 2] };
    const ranges = { featureHeight: [20, 150], thumbHeight: [8, 90], textScale: [.85, 1.15], tracking: [-.02, .04], gapScale: [.7, 1.3], mosaicSalt: [0, 9999] };
    for (const [key, value] of Object.entries(plan.contentsDesign)) {
      let valid;
      if (['accent', 'headingColor', 'pageColor', 'textColor', 'topBarColor'].includes(key)) valid = typeof value === 'string' && /^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/iu.test(value);
      else if (['showHeroes', 'pageLabels', 'rules', 'paddedNumbers'].includes(key)) valid = typeof value === 'boolean';
      else if (Object.hasOwn(enums, key)) valid = enums[key].includes(value);
      else if (Object.hasOwn(ranges, key)) valid = Number.isFinite(value) && value >= ranges[key][0] && value <= ranges[key][1];
      else continue;
      if (!valid) issueError(400, `Invalid contents design: ${key}.`);
      design[key] = value;
    }
    result.contentsDesign = design;
  }
  if (plan.contentsStyle !== undefined) {
    if (!object(plan.contentsStyle)) issueError(400, 'Invalid contents card settings.');
    const styles = Object.create(null);
    for (const [id, value] of Object.entries(plan.contentsStyle)) {
      if (!ids.has(id)) continue;
      if (!object(value)) issueError(400, 'Invalid contents card settings.');
      const style = {};
      for (const key of ['title', 'deck', 'badge', 'section', 'assetId', 'hero', 'pageLabel', 'frame']) {
        if (!Object.hasOwn(value, key)) continue;
        const field = value[key];
        if (key === 'frame') {
          if (!object(field) || !['scale', 'offsetX', 'offsetY'].every(part => Number.isFinite(field[part])) || field.scale < .5 || field.scale > 3 || Math.abs(field.offsetX) > 50 || Math.abs(field.offsetY) > 50) issueError(400, 'Invalid contents image crop.');
          style.frame = { scale: field.scale, offsetX: field.offsetX, offsetY: field.offsetY };
        } else {
          const valid = key === 'hero' || key === 'pageLabel' ? typeof field === 'boolean'
            : (key === 'assetId' && field === null) || (typeof field === 'string' && field.length <= 10000);
          if (!valid) issueError(400, 'Invalid contents card setting.');
          style[key] = field;
        }
      }
      styles[id] = style;
    }
    result.contentsStyle = styles;
  }
  return result;
}

export function validateIssueVersion(version) {
  if (!integer(version, 0)) issueError(400, 'A valid issue version is required.');
}

/** Validate against the current database membership, never client-supplied IDs. */
export function validateIssuePlan(plan, items) {
  if (!object(plan) || !Array.isArray(plan.order) || !Array.isArray(plan.contentsExcluded)) {
    issueError(400, 'Supply a complete issue arrangement.');
  }
  const ids = new Set(items.map(item => item.id));
  if (plan.order.length !== ids.size + 1 || new Set(plan.order).size !== plan.order.length ||
      plan.order.filter(id => id === CONTENTS_ID).length !== 1 ||
      plan.order.some(id => id !== CONTENTS_ID && !ids.has(id))) {
    issueError(400, 'The arrangement must include every current project file and the contents spread exactly once. Refresh the project if its files changed.');
  }
  if (!integer(plan.startNumber, 0, 99999) || typeof plan.countCovers !== 'boolean' ||
      !['ltr', 'rtl'].includes(plan.direction) ||
      typeof plan.contentsTitle !== 'string' || plan.contentsTitle.length > 500 ||
      typeof plan.contentsSubtitle !== 'string' || plan.contentsSubtitle.length > 2000 ||
      new Set(plan.contentsExcluded).size !== plan.contentsExcluded.length ||
      plan.contentsExcluded.some(id => !ids.has(id))) {
    issueError(400, 'Check the issue numbering, direction and contents settings.');
  }
  return {
    order: [...plan.order], startNumber: plan.startNumber, countCovers: plan.countCovers,
    contentsTitle: plan.contentsTitle, contentsSubtitle: plan.contentsSubtitle,
    direction: plan.direction, contentsExcluded: [...plan.contentsExcluded],
    ...contentsSettings(plan, ids),
  };
}

/** Page counts come from the browser's layout engine; numbering is recomputed here. */
export function validateIssueDocuments(documents, plan, items) {
  if (!Array.isArray(documents) || documents.length !== items.length ||
      documents.some(item => !object(item) || typeof item.id !== 'string') ||
      new Set(documents.map(item => item.id)).size !== documents.length) {
    issueError(400, 'Supply a page count and version for every project file exactly once.');
  }
  const submitted = new Map(documents.map(item => [item.id, item]));
  for (const item of items) {
    const candidate = submitted.get(item.id);
    if (!candidate || !integer(candidate.version, 1) || !integer(candidate.pageCount, 1) ||
        !integer(candidate.startNumber, 0, 99999)) {
      issueError(400, 'Each file needs a valid version, page count and starting page.');
    }
    if (candidate.version !== item.version) {
      issueError(409, 'A project file changed while this issue was being prepared. Refresh and review the arrangement; no page numbers were changed.');
    }
  }
  const sources = new Map(items.map(item => [item.id, item]));
  let cursor = plan.startNumber;
  let contentsStartNumber = cursor;
  let interiorPages = 0;
  const sides = new Map();
  for (const id of plan.order) {
    if (id === CONTENTS_ID) {
      contentsStartNumber = cursor;
      cursor += 2;
      interiorPages += 2;
    } else {
      const candidate = submitted.get(id);
      if (candidate.startNumber !== cursor) {
        issueError(400, 'The page numbers do not match the arrangement. Recalculate the issue before finalizing.');
      }
      const cover = ['magazine-4', 'backcover-1'].includes(sources.get(id).doc.templateId);
      if (!cover) { sides.set(id, interiorPages % 2 === 0 ? 'left' : 'right'); interiorPages += candidate.pageCount; }
      if (plan.countCovers || !cover) cursor += candidate.pageCount;
    }
    if (!Number.isSafeInteger(cursor) || cursor > 100000) {
      issueError(400, 'The issue exceeds the maximum page number of 99999.');
    }
  }
  return { documents: plan.order.filter(id => id !== CONTENTS_ID).map(id => ({ ...submitted.get(id), mastheadSide: sides.get(id) })), contentsStartNumber };
}
