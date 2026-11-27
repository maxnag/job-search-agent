import { Badge, Group, List, ListItem, Text, Tooltip } from '@mantine/core';
import { useTranslations } from 'next-intl';

import { VacancyMatchVerdictEnum } from '@job-agent/shared';

/**
 * Colour of the badge of each verdict
 *
 * @type {Readonly<Record<VacancyMatchVerdictEnum, string>>}
 */
export const VERDICT_COLORS: Readonly<Record<VacancyMatchVerdictEnum, string>> = {
  [VacancyMatchVerdictEnum.FIT]: 'teal',
  [VacancyMatchVerdictEnum.ALMOST]: 'yellow',
  [VacancyMatchVerdictEnum.NO_FIT]: 'gray'
};

/**
 * Props of the verdict badges
 */
interface IVerdictBadgesProps {
  /**
   * Verdict per profile, with what lowered it
   *
   * @var {readonly { profile: string, verdict: VacancyMatchVerdictEnum, findings: readonly string[] }[]}
   */
  readonly verdicts: readonly {
    readonly profile: string;
    readonly verdict: VacancyMatchVerdictEnum;
    readonly findings: readonly string[];
  }[];
}

/**
 * The verdicts of a vacancy, one badge per profile; the badge tells what lowered the verdict on hover, or on a tap on
 * a phone
 *
 * @param {IVerdictBadgesProps} props
 *
 * @returns {React.JSX.Element}
 */
export function VerdictBadges({ verdicts }: Readonly<IVerdictBadgesProps>): React.JSX.Element {
  const t = useTranslations('enums.verdict');
  const tCard = useTranslations('vacancies.card');

  return (
    <Group gap={4} wrap="wrap">
      {verdicts.map(({ profile, verdict, findings }) => (
        <Tooltip
          key={profile}
          multiline
          w={320}
          withArrow
          events={{ hover: true, focus: true, touch: true }}
          label={
            findings.length === 0 ? (
              <Text size="xs">{tCard('cleanFit')}</Text>
            ) : (
              <List size="xs" spacing={2}>
                {findings.map(finding => (
                  <ListItem key={finding}>{finding}</ListItem>
                ))}
              </List>
            )
          }>
          <Badge color={VERDICT_COLORS[verdict]} variant="light" size="sm" tt="none" style={{ cursor: 'help' }}>
            {profile}: {t(verdict)}
          </Badge>
        </Tooltip>
      ))}
    </Group>
  );
}
