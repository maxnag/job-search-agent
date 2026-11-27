'use client';

import { SegmentedControl, VisuallyHidden, useMantineColorScheme } from '@mantine/core';
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
 * Switch of the theme: light, dark or the system one. The chosen theme lives in a cookie the server reads, so the
 * switch is drawn on the server with the right value and stays in place while the page loads
 *
 * @returns {React.JSX.Element}
 */
export function ColorSchemeToggle(): React.JSX.Element {
  const t = useTranslations('colorScheme');
  const { colorScheme, setColorScheme } = useMantineColorScheme();

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
