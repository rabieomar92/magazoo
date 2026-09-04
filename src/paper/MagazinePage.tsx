import type { CSSProperties } from 'react';
import type { Doc } from '../schema/document';
import type { Piece } from '../lib/paginate';
import { Flow } from './Flow';
import { MagazineHead, MagTopBar } from './MagazineHead';
import { PlacedImages } from './PlacedImages';

interface Props {
  doc: Doc;
  vars: CSSProperties;
  pieces: Piece[];
  /** The first content sheet carries the hero photo + pull-quote header. */
  lead: boolean;
  /** Draw the hero header on the lead sheet. False for magazine-3, whose gatefold
   *  cover already carries the photo — the lead sheet is columns + drop cap only. */
  head?: boolean;
  /** Absolute physical sheet index (sheet 1 = 0). */
  pageIndex: number;
  allowShortLastColumn?: boolean;
}

/** Magazine page 2+: a 2-column justified spread. The lead sheet opens with the
 *  hero photo, location tag and pull-quote; later sheets are columns only. */
export function MagazinePage({
  doc,
  vars,
  pieces,
  lead,
  head = true,
  pageIndex,
  allowShortLastColumn = false,
}: Props) {
  return (
    <div className="page mag-page" style={vars}>
      <MagTopBar doc={doc} pageIndex={pageIndex} />
      {lead && head && <MagazineHead doc={doc} />}
      <div data-flow-host className={`mag-cols ${lead ? 'mag-cols--p1' : 'mag-cols--p2'}`}>
        <Flow
          pieces={pieces}
          doc={doc}
          allowTopBleed={!lead || !head}
          allowBottomBleed
          allowShortLastColumn={allowShortLastColumn}
        />
      </div>
      <PlacedImages doc={doc} pageIndex={pageIndex} />
    </div>
  );
}
