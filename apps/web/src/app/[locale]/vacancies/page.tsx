import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { SectionPlaceholder } from '@/components/section-placeholder';

/**
 * Title of the browser tab
 *
 * @returns {Promise<Metadata>}
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pages.vacancies');

  return { title: t('title') };
}

/**
 * Section vacancies — empty until its phase
 *
 * @returns {React.JSX.Element}
 */
export default function VacanciesPage(): React.JSX.Element {
  return <SectionPlaceholder section="vacancies" />;
}
