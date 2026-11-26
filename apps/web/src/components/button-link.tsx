'use client';

import { Button, type ButtonProps } from '@mantine/core';

import { Link } from '@/i18n/navigation';

/**
 * Props of a button that is a link
 */
interface IButtonLinkProps extends ButtonProps {
  /**
   * Address without the language — the current one is added
   *
   * @var {string}
   */
  readonly href: string;
}

/**
 * Mantine button rendered as a language-aware link. It lives in a client component because a server component cannot
 * hand a component (a function) to a client one as a prop — only data crosses that boundary
 *
 * @param {IButtonLinkProps} props
 *
 * @returns {React.JSX.Element}
 */
export function ButtonLink({ href, ...props }: Readonly<IButtonLinkProps>): React.JSX.Element {
  return <Button component={Link} href={href} {...props} />;
}
