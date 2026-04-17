// Test-time stub for `virtual:pwa-register/react`. The real module is injected
// by vite-plugin-pwa at build/dev time and does not exist on disk — so Vitest's
// import-analysis cannot resolve it. vitest.config.ts aliases the virtual
// specifier to this file; tests override it via vi.mock(...) to drive the
// UpdateToast render tree deterministically.
//
// This module is NEVER loaded at runtime — Vite's plugin replaces the
// virtual specifier in production/dev builds before this file would apply.

export interface RegisterSWOptions {
  immediate?: boolean;
  onRegisteredSW?: (swScriptUrl: string, registration?: ServiceWorkerRegistration) => void;
  onRegisterError?: (error: unknown) => void;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
}

export function useRegisterSW(_options?: RegisterSWOptions): {
  needRefresh: [boolean, (value: boolean) => void];
  offlineReady: [boolean, (value: boolean) => void];
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
} {
  // This fallback body is only reached if vitest forgets to vi.mock the module.
  // Return defaults so tests at least fail with a clear assertion, not a crash.
  return {
    needRefresh: [false, () => {}],
    offlineReady: [false, () => {}],
    updateServiceWorker: async () => {},
  };
}
