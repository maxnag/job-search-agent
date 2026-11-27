import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.mock('server-only', () => ({}));

/**
 * The hooks of the App Router need a mounted router; a spec sets the address through `usePathname` and
 * `useSearchParams`, everything else of `next/navigation` stays real
 */
vi.mock(import('next/navigation'), async importOriginal => ({
  ...(await importOriginal()),
  usePathname: vi.fn(() => '/en/vacancies'),
  useSearchParams: vi.fn(() => new URLSearchParams() as never)
}));

/**
 * jsdom has no layout: Mantine asks for media queries and watches element sizes, so both get a stub that never
 * fires and never matches — but the empty query, which a browser matches always (mantine-datatable asks it for a
 * column without a media query)
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: query === '',
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
});

/**
 * Size observer that observes nothing
 */
class ResizeObserverStub {
  /**
   * @returns {void}
   */
  observe(): void {}

  /**
   * @returns {void}
   */
  unobserve(): void {}

  /**
   * @returns {void}
   */
  disconnect(): void {}
}

window.ResizeObserver = ResizeObserverStub;

window.HTMLElement.prototype.scrollIntoView = vi.fn();

window.HTMLElement.prototype.scrollTo = vi.fn();

afterEach(() => {
  cleanup();
});
