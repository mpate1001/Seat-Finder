import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // vite-plugin-pwa injects `virtual:pwa-register/react` at build/dev time,
      // but Vitest's import-analysis cannot resolve a virtual specifier that
      // has no on-disk counterpart. Alias it to a stub so the import resolves;
      // tests then override with vi.mock('virtual:pwa-register/react', ...).
      'virtual:pwa-register/react': resolve(
        __dirname,
        'src/test/pwa-register-react-stub.ts',
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
