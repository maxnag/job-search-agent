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

  /**
   * The request came from a phone: the menu hides behind the burger at any width and the header is short
   *
   * @var {boolean}
   */
  readonly phone: boolean;
}

/**
 * Width from which a phone would show the menu beside the page — none does: the menu of a phone stays behind the
 * burger even turned sideways
 *
 * @type {number}
 */
const PHONE_NAVBAR_BREAKPOINT_PX = 10_000;

/**
 * Frame of every page: header with the API state, language and theme, the menu of the sections, the content. A client
 * component because the menu opens and closes on a phone (`useDisclosure` keeps that state). A phone is told by the
 * server from its `User-Agent`, so its layout does not change when it is turned
 *
 * @param {IAppLayoutProps} props
 *
 * @returns {React.JSX.Element}
 */
export function AppLayout({ apiStatus, children, phone }: Readonly<IAppLayoutProps>): React.JSX.Element {
  const t = useTranslations();
  const [opened, { toggle, close }] = useDisclosure();

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: phone ? PHONE_NAVBAR_BREAKPOINT_PX : 'sm', collapsed: { mobile: !opened } }}
      padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom={phone ? undefined : 'sm'} size="sm" aria-label={t('nav.menu')} />
            <Title order={4} style={{ whiteSpace: 'nowrap' }}>
              {phone ? t('app.shortTitle') : t('app.title')}
            </Title>
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
