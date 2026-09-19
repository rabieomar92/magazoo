import { create } from 'zustand';
import type { Doc } from '../schema/document';

export interface NewsProofIssue {
  storyId: string;
  message: string;
  blocking: boolean;
}
export interface NewsProof {
  doc: Doc;
  pages: number;
  placements: { storyId: string; page: number; continued: boolean }[];
  issues: NewsProofIssue[];
}

/** Ephemeral measurements for the issue desk; never part of a saved document. */
export const useNewsProof = create<{ proof: NewsProof | null }>(() => ({ proof: null }));
