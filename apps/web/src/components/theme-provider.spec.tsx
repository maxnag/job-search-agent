import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import en from '../../messages/en.json';
import { ColorSchemeToggle } from './color-scheme-toggle';
import { ThemeProvider } from './theme-provider';

/**
 * The theme switch inside the provider, as the layout nests them
 *
 * @param {'light' | 'dark' | 'auto'} colorScheme
 *
 * @returns {React.JSX.Element}
 */
function themed(colorScheme: 'light' | 'dark' | 'auto'): React.JSX.Element {
  return (
    <ThemeProvider colorScheme={colorScheme}>
      <NextIntlClientProvider locale="en" messages={en}>
        <ColorSchemeToggle />
      </NextIntlClientProvider>
    </ThemeProvider>
  );
}

describe('ThemeProvider', () => {
  afterEach(() => {
    document.cookie = 'jsa-color-scheme=; path=/; max-age=0';
  });

  it('draws the switch on the server already, set to the theme the layout read', () => {
    const html = renderToString(themed('dark'));

    expect(html).toContain('aria-label="Theme"');
    expect(/<input[^>]*value="dark"[^>]*>/.exec(html)?.[0]).toContain('checked');
    expect(/<input[^>]*value="auto"[^>]*>/.exec(html)?.[0]).not.toContain('checked');
  });

  it('keeps the chosen theme in the prefixed cookie, not in the browser storage', async () => {
    render(themed('auto'));

    await userEvent.click(screen.getByRole('radio', { name: 'Dark' }));

    expect(document.cookie).toContain('jsa-color-scheme=dark');
    expect(localStorage.getItem('mantine-color-scheme-value')).toBeNull();
    expect(document.documentElement.getAttribute('data-mantine-color-scheme')).toBe('dark');
  });
});
