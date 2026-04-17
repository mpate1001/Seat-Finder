import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Fails the production build if VITE_SHEET_URL is missing (D-18). The service
// module's module-load guard covers the runtime case; this plugin converts that
// into a hard CI failure before the bundle ships.
function requireSheetUrl(): Plugin {
  return {
    name: 'require-sheet-url',
    configResolved(config: ResolvedConfig) {
      if (config.command === 'build' && !process.env.VITE_SHEET_URL) {
        throw new Error(
          'Build failed: VITE_SHEET_URL env var is required for production build. ' +
          'Set it in your hosting platform (Vercel/Netlify/etc.) or local shell before running `npm run build`.'
        );
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), requireSheetUrl()],
});
