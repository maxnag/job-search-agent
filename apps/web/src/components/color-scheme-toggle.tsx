'use client';

import { SegmentedControl, VisuallyHidden, useMantineColorScheme } from '@mantine/core';
import { useMounted } from '@mantine/hooks';
import { IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

/**
 * Themes in the order of the switch
 *
 * @type {readonly { value: 'light' | 'dark' | 'auto', icon: typeof IconSun }[]}
 */
const SCHEMES = [
  { value: 'light', icon: IconSun },
  { value: 'dark', icon: IconMoon },
  { value: 'auto', icon: IconDeviceDesktop }
] as const;

/**
 * Switch of the theme: light, dark or the system one. The chosen theme lives in the browser storage, which the server
 * cannot read — so the switch renders only after the page is mounted, otherwise the server and the browser would draw
 * different HTML (a hydration mismatch)
 *
 * @returns {React.JSX.Element | null}
 */
export function ColorSchemeToggle(): React.JSX.Element | null {
  const t = useTranslations('colorScheme');
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const mounted = useMounted();

  if (!mounted) {
    return null;
  }

  return (
    <SegmentedControl
      size="xs"
      aria-label={t('label')}
      value={colorScheme}
      onChange={value => setColorScheme(value)}
      data={SCHEMES.map(scheme => ({
        value: scheme.value,
        label: (
          <>
            <scheme.icon size={14} stroke={1.5} />
            <VisuallyHidden>{t(scheme.value)}</VisuallyHidden>
          </>
        )
      }))}
    />
  );
}
