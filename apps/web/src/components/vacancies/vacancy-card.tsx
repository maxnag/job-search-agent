import { Anchor, Badge, Card, Group, List, ListItem, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { getFormatter, getTranslations } from 'next-intl/server';

import { VacancyMatchVerdictEnum } from '@job-agent/shared';

import type { VacancyCardType } from '@/server/schemas/vacancy-card.schema';

import { VacancyActions } from './vacancy-actions';
import { VERDICT_COLORS } from './verdict-badges';

/**
 * Props of the card of a vacancy
 */
interface IVacancyCardProps {
  /**
   * The vacancy
   *
   * @var {VacancyCardType}
   */
  readonly vacancy: VacancyCardType;
}

/**
 * Everything known about a vacancy: where and what, the extraction, the verdicts with the findings of the rules, the
 * owner's choices and the buttons. The text of the page comes from an LLM and the web — it is shown as text only
 *
 * @param {IVacancyCardProps} props
 *
 * @returns {Promise<React.JSX.Element>}
 */
export async function VacancyCard({ vacancy }: Readonly<IVacancyCardProps>): Promise<React.JSX.Element> {
  const [t, tEnums, format] = await Promise.all([getTranslations('vacancies.card'), getTranslations('enums'), getFormatter()]);
  const date = (value: string): string => format.dateTime(new Date(value), 'dateTime');
  const place = [vacancy.country, vacancy.city].filter(Boolean).join(', ');
  const { extraction } = vacancy;
  const lastAction = vacancy.actions.at(-1)?.kind ?? null;

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Title order={2}>{vacancy.title}</Title>
        <Group gap="xs">
          <Text fw={500}>{vacancy.company}</Text>
          {place ? <Text c="dimmed">· {place}</Text> : null}
          {vacancy.workMode ? <Badge variant="light">{tEnums(`workMode.${vacancy.workMode}`)}</Badge> : null}
          {vacancy.level ? <Badge variant="light">{tEnums(`level.${vacancy.level}`)}</Badge> : null}
          <Badge variant="outline" color="gray" tt="none">
            {tEnums(`stage.${vacancy.stage}`)}
          </Badge>
        </Group>
        <Group gap="md">
          <Anchor href={vacancy.url} target="_blank" rel="noopener noreferrer" size="sm">
            <Group gap={4} component="span">
              {t('original')} <IconExternalLink size={14} />
            </Group>
          </Anchor>
          {vacancy.textURL ? (
            <Anchor href={vacancy.textURL} target="_blank" rel="noopener noreferrer" size="sm">
              <Group gap={4} component="span">
                {t('atsText')} <IconExternalLink size={14} />
              </Group>
            </Anchor>
          ) : null}
        </Group>
        <Text size="xs" c="dimmed">
          {t('source')}: {vacancy.source} · {t('firstSeenAt')}: {date(vacancy.firstSeenAt)} · {t('lastSeenAt')}: {date(vacancy.lastSeenAt)}
          {vacancy.closedAt ? ` · ${t('closedAt')}: ${date(vacancy.closedAt)}` : ''}
        </Text>
      </Stack>

      <VacancyActions vacancyId={vacancy.vacancyId} current={lastAction} />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder padding="md">
          <Stack gap="sm">
            <Title order={4}>{t('summary')}</Title>
            {vacancy.skipReason ? <Text c="orange">{t('skipReason', { reason: vacancy.skipReason })}</Text> : null}
            {extraction ? (
              <>
                <Text style={{ whiteSpace: 'pre-wrap' }}>{extraction.summary}</Text>
                {extraction.programmingLanguages.length > 0 ? (
                  <Text size="sm">
                    <Text span fw={500}>
                      {t('languages')}:{' '}
                    </Text>
                    {extraction.programmingLanguages
                      .map(language => (language.required ? `${language.name} (${t('required')})` : language.name))
                      .join(', ')}
                  </Text>
                ) : null}
                {extraction.frameworks.length > 0 ? (
                  <Text size="sm">
                    <Text span fw={500}>
                      {t('frameworks')}:{' '}
                    </Text>
                    {extraction.frameworks.join(', ')}
                  </Text>
                ) : null}
                {extraction.yearsRequired === null ? null : (
                  <Text size="sm">
                    <Text span fw={500}>
                      {t('years')}:{' '}
                    </Text>
                    {extraction.yearsRequired}
                  </Text>
                )}
                <Text size="sm">
                  <Text span fw={500}>
                    {t('hebrew')}:{' '}
                  </Text>
                  {tEnums(`hebrew.${extraction.hebrew}`)}
                </Text>
              </>
            ) : (
              <Text c="dimmed">{t('noExtraction')}</Text>
            )}
          </Stack>
        </Card>

        <Stack gap="md">
          <Card withBorder padding="md">
            <Stack gap="sm">
              <Title order={4}>{t('verdicts')}</Title>
              {vacancy.matches.length === 0 ? <Text c="dimmed">{t('noVerdicts')}</Text> : null}
              {vacancy.matches.map(match => {
                const findings = match.findings.filter(finding => finding.effect !== VacancyMatchVerdictEnum.FIT);

                return (
                  <Stack key={match.profile} gap={4}>
                    <Group gap="xs">
                      <Text fw={500}>{match.profile}</Text>
                      <Badge color={VERDICT_COLORS[match.verdict]} variant="light" tt="none">
                        {tEnums(`verdict.${match.verdict}`)}
                      </Badge>
                      {match.notifiedAt ? (
                        <Text size="xs" c="dimmed">
                          {t('cardSent', { at: date(match.notifiedAt) })}
                        </Text>
                      ) : null}
                    </Group>
                    {findings.length === 0 ? (
                      <Text size="sm" c="dimmed">
                        {t('cleanFit')}
                      </Text>
                    ) : (
                      <List size="sm" spacing={2}>
                        {findings.map(finding => (
                          <ListItem key={`${finding.rule}:${finding.message}`}>{finding.message}</ListItem>
                        ))}
                      </List>
                    )}
                  </Stack>
                );
              })}
            </Stack>
          </Card>

          <Card withBorder padding="md">
            <Stack gap="sm">
              <Title order={4}>{t('history')}</Title>
              {vacancy.actions.length === 0 ? (
                <Text c="dimmed">{t('noHistory')}</Text>
              ) : (
                <List size="sm" spacing={2}>
                  {vacancy.actions.map(action => (
                    <ListItem key={action.at}>
                      {tEnums(`lastAction.${action.kind}`)} — {date(action.at)}
                    </ListItem>
                  ))}
                </List>
              )}
            </Stack>
          </Card>
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}
