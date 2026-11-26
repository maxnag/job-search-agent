'use client';

import { AppShell, Burger, Group, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useTranslations } from 'next-intl';
import { Suspense } from 'react';

import { ColorSchemeToggle } from './color-scheme-toggle';
import { LocaleSwitcher } from './locale-switcher';
import { NavLinks } from './nav-links';

/**
 * Props of the frame of every page
 */
interface IAppLayoutProps {
  /**
   * State of the API, rendered on the server and handed in ready — a client component cannot await the API itself
   *
   * @var {React.ReactNode}
   */
  readonly apiStatus: React.ReactNode;

  /**
   * Content of the page
   *
   * @var {React.ReactNode}
   */
  readonly children: React.ReactNode;
}

/**
 * Frame of every page: header with the API state, language and theme, the menu of the sections, the content. A client
 * component because the menu opens and closes on a phone (`useDisclosure` keeps that state)
 *
 * @param {IAppLayoutProps} props
 *
 * @returns {React.JSX.Element}
 */
export function AppLayout({ apiStatus, children }: IAppLayoutProps): React.JSX.Element {
  const t = useTranslations();
  const [opened, { toggle, close }] = useDisclosure();

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label={t('nav.menu')} />
            <Title order={4}>{t('app.title')}</Title>
          </Group>
          <Group gap="sm" wrap="nowrap">
            {apiStatus}
            <Suspense>
              <LocaleSwitcher />
            </Suspense>
            <ColorSchemeToggle />
          </Group>
        </Group>
      </AppShell.Header>
      <AppShell.Navbar p="xs">
        <NavLinks onNavigate={close} />
      </AppShell.Navbar>
      <AppShell.Main>{children}</AppShell.Main>
    </AppShell>
  );
}
