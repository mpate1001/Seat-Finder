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
//
// Method coverage: `putImageData` + `drawImage` + `getImageData` +
// `imageSmoothingEnabled`/`imageSmoothingQuality` — the surface the OCR
// preprocessing pipeline (upscale + binarize) touches. All are no-ops that
// return zero-filled ImageData — tests never assert on rendered pixels.
if (typeof globalThis.OffscreenCanvas === 'undefined') {
  class OffscreenCanvasPolyfill {
    width: number;
    height: number;
    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
    }
    getContext(_contextId: string): {
      putImageData: (data: ImageData, dx: number, dy: number) => void;
      drawImage: (...args: unknown[]) => void;
      getImageData: (x: number, y: number, w: number, h: number) => ImageData;
      imageSmoothingEnabled: boolean;
      imageSmoothingQuality: string;
    } | null {
      return {
        putImageData: () => {
          /* no-op for test polyfill */
        },
        drawImage: () => {
          /* no-op for test polyfill */
        },
        getImageData: (_x: number, _y: number, w: number, h: number) =>
          ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4),
            colorSpace: 'srgb',
          }) as ImageData,
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
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
