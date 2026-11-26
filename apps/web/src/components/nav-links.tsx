'use client';

import { NavLink } from '@mantine/core';
import { IconBriefcase, IconBuildingSkyscraper, IconWorldWww } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { Link, usePathname } from '@/i18n/navigation';

/**
 * Sections of the menu: address and dictionary key
 *
 * @type {readonly { href: string, key: 'vacancies' | 'companies' | 'sources', icon: typeof IconBriefcase }[]}
 */
const SECTIONS = [
  { href: '/vacancies', key: 'vacancies', icon: IconBriefcase },
  { href: '/companies', key: 'companies', icon: IconBuildingSkyscraper },
  { href: '/sources', key: 'sources', icon: IconWorldWww }
] as const;

/**
 * Props of the menu
 */
interface INavLinksProps {
  /**
   * Called after a section is chosen — closes the menu on a phone
   *
   * @var {() => void}
   */
  readonly onNavigate?: () => void;
}

/**
 * Menu of the sections; the section of the current address is highlighted. A client component: it reads the address
 * in the browser with `usePathname`
 *
 * @param {INavLinksProps} props
 *
 * @returns {React.JSX.Element}
 */
export function NavLinks({ onNavigate }: INavLinksProps): React.JSX.Element {
  const t = useTranslations('nav');
  const pathname = usePathname();

  return (
    <>
      {SECTIONS.map(section => (
        <NavLink
          key={section.key}
          component={Link}
          href={section.href}
          label={t(section.key)}
          leftSection={<section.icon size={18} stroke={1.5} />}
          active={pathname.startsWith(section.href)}
          onClick={onNavigate}
        />
      ))}
    </>
  );
}
