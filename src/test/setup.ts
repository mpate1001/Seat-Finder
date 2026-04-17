import '@testing-library/jest-dom';

// jsdom does not implement matchMedia. Stub it to always return "does not match"
// so prefers-reduced-motion checks behave like a normal desktop browser.
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// jsdom does not implement OffscreenCanvas (used by src/setup/ocr.ts to wrap
// ImageData for Tesseract v7, which rejects raw ImageData in its ImageLike
// union). The setup-tooling tests mock tesseract.js so the fake worker never
// reads canvas pixels — a minimal shape-matching polyfill is sufficient. In
// the browser, the native OffscreenCanvas is used.
if (typeof globalThis.OffscreenCanvas === 'undefined') {
  class OffscreenCanvasPolyfill {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext(_contextId: string): { putImageData: (data: ImageData, dx: number, dy: number) => void } | null {
      return {
        putImageData: () => {
          /* no-op for test polyfill */
        },
      };
    }
  }
  (globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = OffscreenCanvasPolyfill;
}

// jsdom does not implement ResizeObserver (used by react-zoom-pan-pinch to
// track viewport size). LivePreview renders a real <TransformWrapper/> in
// its test, which invokes `new ResizeObserver(...)` during mount. A stub
// observer that never fires observations is sufficient — none of the
// review-UI tests assert on viewport-resize behavior.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverPolyfill {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverPolyfill;
}
