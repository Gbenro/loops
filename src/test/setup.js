import '@testing-library/jest-dom';
import { webcrypto } from 'node:crypto';

// Polyfill Web Crypto API for jsdom / Node environment
if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}
if (typeof window !== 'undefined') {
  if (!window.crypto) {
    Object.defineProperty(window, 'crypto', {
      value: webcrypto,
      writable: true,
      configurable: true,
    });
  } else {
    if (!window.crypto.subtle) {
      Object.defineProperty(window.crypto, 'subtle', {
        value: webcrypto.subtle,
        writable: true,
        configurable: true,
      });
    }
    if (!window.crypto.getRandomValues) {
      Object.defineProperty(window.crypto, 'getRandomValues', {
        value: (arr) => webcrypto.getRandomValues(arr),
        writable: true,
        configurable: true,
      });
    }
  }
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock localStorage
const localStorageMock = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
