import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// On `build` (GitHub Pages), assets live under the project subpath
// /research-highlight-builder/. Dev server stays at root.
export default defineConfig(() => {
  const base =
    process.env.VITE_BASE_PATH ||
    (process.env.VERCEL
      ? '/'
      : process.env.GITHUB_ACTIONS
        ? '/research-highlight-builder/'
        : '/');

  return {
    plugins: [react()],
    base,
  };
});
