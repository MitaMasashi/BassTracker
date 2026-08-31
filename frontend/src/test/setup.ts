import "@testing-library/jest-dom/vitest";

// jsdomはResizeObserverとCanvas 2Dコンテキストを実装していない
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

HTMLCanvasElement.prototype.getContext = () => null;
