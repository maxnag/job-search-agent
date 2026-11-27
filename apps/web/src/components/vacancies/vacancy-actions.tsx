'use client';

import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { IconSend, IconStar, IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useActionState, useOptimistic } from 'react';

import { VacancyActionKindEnum } from '@job-agent/shared';

import { recordAction } from '@/app/[locale]/vacancies/actions';
import type { IVacancyActionState } from '@/vacancies/vacancy-action-state.interface';

/**
 * The buttons in the order of the Telegram card, each with its icon and colour
 *
 * @type {readonly { kind: VacancyActionKindEnum, icon: typeof IconStar, color: string }[]}
 */
const BUTTONS: readonly { kind: VacancyActionKindEnum; icon: typeof IconStar; color: string }[] = [
  { kind: VacancyActionKindEnum.INTERESTED, icon: IconStar, color: 'blue' },
  { kind: VacancyActionKindEnum.SKIPPED, icon: IconX, color: 'gray' },
  { kind: VacancyActionKindEnum.APPLIED, icon: IconSend, color: 'teal' }
];

/**
 * Border of the latest choice — red, so it catches the eye in either theme
 *
 * @type {string}
 */
const CHOSEN_BORDER = '2px solid var(--mantine-color-red-filled)';

/**
 * Props of the buttons of a vacancy
 */
interface IVacancyActionsProps {
  /**
   * The vacancy
   *
   * @var {number}
   */
  readonly vacancyId: number;

  /**
   * The latest choice about it, if any
   *
   * @var {VacancyActionKindEnum | null}
   */
  readonly current: VacancyActionKindEnum | null;
}

/**
 * Interested / Skip / Applied of a vacancy — the same choice as the buttons under its Telegram card. The latest
 * choice carries a red border, at once on a press (optimistic) while the Server Action stores it; if the API
 * fails, the border goes back and a note says the choice was not saved. A press on the choice already made stores
 * nothing new
 *
 * @param {IVacancyActionsProps} props
 *
 * @returns {React.JSX.Element}
 */
export function VacancyActions({ vacancyId, current }: Readonly<IVacancyActionsProps>): React.JSX.Element {
  const t = useTranslations('vacancies.actions');
  const tEnums = useTranslations('enums.action');
  const [optimistic, setOptimistic] = useOptimistic(current);
  const [state, formAction, isPending] = useActionState(
    async (previous: IVacancyActionState, form: FormData): Promise<IVacancyActionState> => {
      setOptimistic(form.get('kind') as VacancyActionKindEnum);

      return recordAction(previous, form);
    },
    { kind: current, failed: false }
  );

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        {t('label')}
      </Text>
      <form action={formAction}>
        <input type="hidden" name="vacancyId" value={vacancyId} />
        <Group gap="xs">
          {BUTTONS.map(({ kind, icon: Icon, color }) => (
            <Button
              key={kind}
              type="submit"
              name="kind"
              value={kind}
              color={color}
              variant="light"
              style={{ border: optimistic === kind ? CHOSEN_BORDER : '2px solid transparent' }}
              leftSection={<Icon size={16} />}
              aria-pressed={optimistic === kind}
              disabled={isPending}>
              {tEnums(kind)}
            </Button>
          ))}
        </Group>
      </form>
      {state.failed && !isPending ? (
        <Alert color="red" variant="light" p="xs">
          {t('failed')}
        </Alert>
      ) : null}
    </Stack>
  );
}
