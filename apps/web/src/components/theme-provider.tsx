'use client';

import { type MantineColorScheme, MantineProvider } from '@mantine/core';
import { useState } from 'react';

import { theme } from '@/theme';

import { cookieColorSchemeManager } from './cookie-color-scheme-manager';

/**
 * Props of the theme provider
 */
interface IThemeProviderProps {
  /**
   * The theme the layout read from the cookie
   *
   * @var {MantineColorScheme}
   */
  readonly colorScheme: MantineColorScheme;

  /**
   * The page
   *
   * @var {React.ReactNode}
   */
  readonly children: React.ReactNode;
}

/**
 * Mantine with the theme kept in a cookie. A client component: the manager is a set of functions, and a server
 * component cannot hand functions to a client one
 *
 * @param {IThemeProviderProps} props
 *
 * @returns {React.JSX.Element}
 */
export function ThemeProvider({ colorScheme, children }: Readonly<IThemeProviderProps>): React.JSX.Element {
  const [manager] = useState(cookieColorSchemeManager);

  return (
    <MantineProvider theme={theme} defaultColorScheme={colorScheme} colorSchemeManager={manager}>
      {children}
    </MantineProvider>
  );
}
