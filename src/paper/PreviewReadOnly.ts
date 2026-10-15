import { createContext, useContext } from 'react';

/** Reading and printing must never create edits, including layout effects. */
export const PreviewReadOnly = createContext(false);
export const usePreviewReadOnly = () => useContext(PreviewReadOnly);

/** Reflowing an output proof must not persist automatic anchor corrections.
 * Deliberate dragging/editing remains enabled independently of this flag. */
export const PreviewPreserveSourceAnchors = createContext(false);
export const usePreserveSourceAnchors = () => useContext(PreviewPreserveSourceAnchors);
