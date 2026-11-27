'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { VacancyActionKindEnum } from '@job-agent/shared';

import { recordVacancyAction } from '@/server/a-p-i-client';
import { APIClientError } from '@/server/a-p-i-client.error';
import type { IVacancyActionState } from '@/vacancies/vacancy-action-state.interface';

/**
 * A press as the form sends it
 */
const pressSchema = z.object({
  vacancyId: z.coerce.number().int().positive(),
  kind: z.enum(VacancyActionKindEnum)
});

/**
 * Server Action of the buttons of a vacancy: the press goes to the API, which stores it as a Telegram button does and
 * ticks it under the Telegram messages of the vacancy. The list and the card render anew with the choice. A failure
 * leaves the choice as it was and says so
 *
 * @param {IVacancyActionState} previous
 * @param {FormData} form
 *
 * @throws {Error} If something other than the API fails
 *
 * @returns {Promise<IVacancyActionState>}
 */
export async function recordAction(previous: IVacancyActionState, form: FormData): Promise<IVacancyActionState> {
  const press = pressSchema.safeParse({ vacancyId: form.get('vacancyId'), kind: form.get('kind') });

  if (!press.success) {
    return { kind: previous.kind, failed: true };
  }

  try {
    const answer = await recordVacancyAction(press.data.vacancyId, press.data.kind);

    revalidatePath('/[locale]/vacancies', 'layout');

    return { kind: answer.kind, failed: false };
  } catch (error) {
    if (error instanceof APIClientError) {
      console.warn({ message: 'Vacancy action not saved', code: error.code, vacancyId: press.data.vacancyId });

      return { kind: previous.kind, failed: true };
    }

    throw error;
  }
}
