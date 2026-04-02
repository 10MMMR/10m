import "@testing-library/jest-dom";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== "undefined") {
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverMock,
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: {},
  });
}

Object.defineProperty(globalThis.crypto, "randomUUID", {
  writable: true,
  value: jest.fn(() => "test-uuid"),
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});
