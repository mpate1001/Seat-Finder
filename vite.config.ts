import { defineConfig, type Plugin, type ResolvedConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

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
  plugins: [
    react(),
    requireSheetUrl(),
    VitePWA({
      // D-05: we drive the update toast — plugin never auto-reloads.
      registerType: 'prompt',

      // Anything in public/ is already copied to dist/; we just list extras the
      // plugin should inject into <link> tags (apple touch icon lives here).
      includeAssets: ['apple-touch-icon.png'],

      manifest: {
        name: 'Seat Finder — Mahek & Saumya',
        short_name: 'Seat Finder',
        description: "Find your table at Mahek & Saumya's wedding reception.",
        theme_color: '#2b2d42',
        background_color: '#edf2f4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/pwa-192.png',          sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png',          sizes: '512x512', type: 'image/png' },
          { src: '/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // Precache ONLY the app shell — no floor-plan images (they go via runtime rules).
        globPatterns: ['**/*.{js,css,html,svg,ico,woff2}'],
        // - floor-plan/** → runtime CacheFirst rule below.
        // - SetupApp-*.js/.css → route-obscurity admin chunk; OpenCV+Tesseract WASM
        //   bundle blows past the 2 MiB precache limit and is useless to guests who
        //   never visit /setup (D-01, D-02). Workbox's StaleWhileRevalidate runtime
        //   rule catches it on first admin visit. Excluding here keeps the PWA
        //   precache manifest under the default 2 MiB cap and prevents the build
        //   from failing.
        // - detect.worker-*.js → the Hough detection worker shipped as part of the
        //   Phase 5 UI-responsiveness hotfix. Same reasoning as SetupApp-*: admin-
        //   only, carries the opencv payload, and is lazy-loaded only when the
        //   admin clicks Detect.
        globIgnores: [
          '**/floor-plan/**',
          '**/SetupApp-*.{js,css}',
          '**/detect.worker-*.js',
        ],

        // SPA navigation fallback — but never for the Sheets host.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          new RegExp('^https://docs\\.google\\.com/'),
        ],

        runtimeCaching: [
          // Floor plan image variants — long-lived, rarely change.
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/floor-plan/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'floor-plan-images-v1',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Dynamic script/style chunks that slip past precache (belt-and-suspenders).
          {
            urlPattern: ({ request }) =>
              request.destination === 'script' || request.destination === 'style',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'static-assets-v1' },
          },
          // Google Sheets CSV — NEVER cache at the SW layer. App-layer localStorage owns this.
          {
            urlPattern: ({ url }) => url.hostname.endsWith('docs.google.com'),
            handler: 'NetworkOnly',
          },
        ],

        cleanupOutdatedCaches: true,
      },

      // D-17: enable SW in dev so we can test the update flow without a full build.
      // Dev SW is non-caching — safe with Vite HMR.
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
    }),
  ],
});
