import { revalidatePath } from 'next/cache';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VacancyActionKindEnum } from '@job-agent/shared';

import { recordVacancyAction } from '@/server/a-p-i-client';
import { APIClientError } from '@/server/a-p-i-client.error';
import { APIErrorCodeEnum } from '@/server/a-p-i-error-code.enum';

import { recordAction } from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/server/a-p-i-client', () => ({ recordVacancyAction: vi.fn() }));

/**
 * The form of a press
 *
 * @param {Record<string, string>} fields
 *
 * @returns {FormData}
 */
function press(fields: Record<string, string>): FormData {
  const form = new FormData();

  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value);
  }

  return form;
}

describe('recordAction', () => {
  const BEFORE = { kind: VacancyActionKindEnum.SKIPPED, failed: false };

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.mocked(recordVacancyAction).mockReset();
    vi.mocked(revalidatePath).mockReset();
  });

  it('sends the press to the API and renders the vacancies anew with the stored choice', async () => {
    vi.mocked(recordVacancyAction).mockResolvedValue({ kind: VacancyActionKindEnum.APPLIED, recorded: true });

    await expect(recordAction(BEFORE, press({ vacancyId: '7', kind: 'applied' }))).resolves.toEqual({
      kind: VacancyActionKindEnum.APPLIED,
      failed: false
    });
    expect(recordVacancyAction).toHaveBeenCalledWith(7, VacancyActionKindEnum.APPLIED);
    expect(revalidatePath).toHaveBeenCalledWith('/[locale]/vacancies', 'layout');
  });

  it('keeps the choice as it was and says so when the API fails', async () => {
    vi.mocked(recordVacancyAction).mockRejectedValue(new APIClientError(APIErrorCodeEnum.API_UNAVAILABLE, 'down'));

    await expect(recordAction(BEFORE, press({ vacancyId: '7', kind: 'applied' }))).resolves.toEqual({ ...BEFORE, failed: true });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown choice', { vacancyId: '7', kind: 'maybe' }],
    ['a vacancy that is no number', { vacancyId: 'seven', kind: 'applied' }]
  ])('sends nothing for %s', async (_case, fields) => {
    await expect(recordAction(BEFORE, press(fields))).resolves.toEqual({ ...BEFORE, failed: true });
    expect(recordVacancyAction).not.toHaveBeenCalled();
  });

  it('does not swallow an error that is not about the API', async () => {
    vi.mocked(recordVacancyAction).mockRejectedValue(new RangeError('bug'));

    await expect(recordAction(BEFORE, press({ vacancyId: '7', kind: 'applied' }))).rejects.toThrow(RangeError);
  });
});
