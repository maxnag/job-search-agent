import { describe, expect, it, vi } from 'vitest';

import { SectionPlaceholder } from '@/components/section-placeholder';

import CompaniesPage, { generateMetadata } from './page';

vi.mock('next-intl/server', () => import('../../../../test/next-intl-server.mock'));

describe('CompaniesPage', () => {
  it('names the tab after the section', async () => {
    await expect(generateMetadata()).resolves.toEqual({ title: 'Companies' });
  });

  it('shows the placeholder of the section', () => {
    const page = CompaniesPage();

    expect(page.type).toBe(SectionPlaceholder);
    expect(page.props).toEqual({ section: 'companies' });
  });
});
