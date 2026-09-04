import type { CSSProperties } from 'react';
import type { Doc } from '../schema/document';
import type { Piece } from '../lib/paginate';
import { grid } from '../lib/geometry';
import { Sidebar } from './Sidebar';
import { Flow } from './Flow';
import { TagBar } from './TagBar';
import { PlacedImages } from './PlacedImages';

interface Props {
  doc: Doc;
  vars: CSSProperties;
  pieces: Piece[];
  /** Absolute sheet index across the whole document (sheet 1 = 0). Odd sheets
   *  mirror the bar, so it alternates left/right/left/right down the run. */
  pageIndex: number;
  allowShortLastColumn?: boolean;
}

/** A continuation sheet: no hero/header, just the taller body box. Every page
 *  after page 1 shares this geometry, so one component renders them all. */
export function ContPage({ doc, vars, pieces, pageIndex, allowShortLastColumn = false }: Props) {
  const { railEvery } = grid(doc.design);
  const body = (
    <div data-flow-host className={`body-cols body-cols--p2${railEvery ? ' body-cols--railed' : ''}`}>
      {/* No header/hero above a continuation page's body, and nothing sits
          below it either — both edges are free for a bled figure to reach. */}
      <Flow
        pieces={pieces}
        doc={doc}
        allowTopBleed
        allowBottomBleed
        allowShortLastColumn={allowShortLastColumn}
      />
    </div>
  );

  return (
    <div className="page" style={vars}>
      <TagBar doc={doc} pageIndex={pageIndex} fullBleed />
      {railEvery ? (
        <div className="body-row">
          {body}
          <Sidebar doc={doc} />
        </div>
      ) : (
        body
      )}
      <PlacedImages doc={doc} pageIndex={pageIndex} />
    </div>
  );
}
