import { describe, expect, it, vi } from 'vitest';

import { SectionPlaceholder } from '@/components/section-placeholder';

import SourcesPage, { generateMetadata } from './page';

vi.mock('next-intl/server', () => import('../../../../test/next-intl-server.mock'));

describe('SourcesPage', () => {
  it('names the tab after the section', async () => {
    await expect(generateMetadata()).resolves.toEqual({ title: 'Sources' });
  });

  it('shows the placeholder of the section', () => {
    const page = SourcesPage();

    expect(page.type).toBe(SectionPlaceholder);
    expect(page.props).toEqual({ section: 'sources' });
  });
});
