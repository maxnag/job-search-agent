import { createNavigation } from 'next-intl/navigation';

import { routing } from './routing';

/**
 * Link and router that keep the language segment of the address
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
