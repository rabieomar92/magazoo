import { createContext, useContext } from 'react';

/** Reading and printing must never create edits, including layout effects. */
export const PreviewReadOnly = createContext(false);
export const usePreviewReadOnly = () => useContext(PreviewReadOnly);
