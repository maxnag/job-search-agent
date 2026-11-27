'use client';

import { Badge, Button, CloseButton, Group, MultiSelect, Select, SimpleGrid, Switch, TextInput } from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconFilterOff, IconSearch } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { SeniorityLevelEnum, VacancyLastActionEnum, VacancyMatchVerdictEnum, VacancyStageEnum, WorkModeEnum } from '@job-agent/shared';

import type { VacancyFilterOptionsType } from '@/server/schemas/vacancy-filter-options.schema';
import { VACANCY_PERIODS, VACANCY_SEARCH_DEFAULTS, type VacancySearchType } from '@/vacancies/vacancy-search.schema';

/**
 * Pause after the last key press before a text filter is applied, in milliseconds
 *
 * @type {number}
 */
const TEXT_DELAY_MS = 400;

/**
 * Entries of the city select: `IL, Tel Aviv` — the country first, so the list reads grouped by country. The value is
 * the city alone, as the address and the API take it; a city name met in two countries is offered once
 *
 * @param {VacancyFilterOptionsType['cities']} cities
 *
 * @returns {{ value: string, label: string }[]}
 */
function cityOptions(cities: VacancyFilterOptionsType['cities']): { value: string; label: string }[] {
  const seen = new Set<string>();

  return cities.flatMap(({ country, city }) => {
    if (seen.has(city)) {
      return [];
    }

    seen.add(city);

    return [{ value: city, label: country ? `${country}, ${city}` : city }];
  });
}

/**
 * Props of the filters of the list
 */
interface IVacancyFiltersProps {
  /**
   * Filters of the page shown now
   *
   * @var {VacancySearchType}
   */
  readonly search: VacancySearchType;

  /**
   * Values the selects offer
   *
   * @var {VacancyFilterOptionsType}
   */
  readonly options: VacancyFilterOptionsType;

  /**
   * Open the list with some filters changed
   *
   * @var {(changes: Partial<VacancySearchType>) => void}
   */
  readonly onChange: (changes: Partial<VacancySearchType>) => void;

  /**
   * Small fields, two or more to a row — the filters of a phone
   *
   * @var {boolean}
   */
  readonly compact: boolean;
}

/**
 * Props of a text filter
 */
interface IDebouncedTextProps {
  /**
   * Size of the field
   *
   * @var {'xs' | 'sm'}
   */
  readonly size: 'xs' | 'sm';

  /**
   * Label
   *
   * @var {string}
   */
  readonly label: string;

  /**
   * Hint inside the empty field
   *
   * @var {string}
   */
  readonly placeholder: string;

  /**
   * The value in the address
   *
   * @var {string | undefined}
   */
  readonly value: string | undefined;

  /**
   * Apply a new value; undefined clears the filter
   *
   * @var {(value: string | undefined) => void}
   */
  readonly onApply: (value: string | undefined) => void;
}

/**
 * A text filter that applies itself a moment after the owner stops typing. It keeps its own text while typing and
 * takes the value of the address again when the address changes from elsewhere — a reset, the back button
 *
 * @param {IDebouncedTextProps} props
 *
 * @returns {React.JSX.Element}
 */
function DebouncedText({ size, label, placeholder, value, onApply }: Readonly<IDebouncedTextProps>): React.JSX.Element {
  const [text, setText] = useState(value ?? '');
  const [applied, setApplied] = useState(value);
  const apply = useDebouncedCallback((next: string) => {
    onApply(next.trim() || undefined);
  }, TEXT_DELAY_MS);

  if (applied !== value) {
    setApplied(value);
    setText(value ?? '');
  }

  return (
    <TextInput
      size={size}
      label={label}
      placeholder={placeholder}
      value={text}
      leftSection={<IconSearch size={16} />}
      onChange={event => {
        setText(event.currentTarget.value);
        apply(event.currentTarget.value);
      }}
    />
  );
}

/**
 * Filters of the list of vacancies. Every change goes to the address — the filters live there, not here; the
 * component only shows them and reports what the owner changed
 *
 * @param {IVacancyFiltersProps} props
 *
 * @returns {React.JSX.Element}
 */
export function VacancyFilters({ search, options, compact, onChange }: Readonly<IVacancyFiltersProps>): React.JSX.Element {
  const t = useTranslations('vacancies.filters');
  const tEnums = useTranslations('enums');
  const any = t('any');
  const size = compact ? 'xs' : 'sm';

  return (
    <SimpleGrid
      cols={compact ? { base: 2, xs: 3, sm: 4 } : { base: 1, sm: 2, md: 3, lg: 4 }}
      spacing={compact ? 'xs' : 'sm'}
      verticalSpacing="xs">
      <DebouncedText size={size} label={t('search')} placeholder={t('searchPlaceholder')} value={search.q} onApply={q => onChange({ q })} />
      <MultiSelect
        size={size}
        label={t('stage')}
        placeholder={search.stage.length ? undefined : any}
        data={Object.values(VacancyStageEnum).map(value => ({ value, label: tEnums(`stage.${value}`) }))}
        value={search.stage}
        onChange={values => onChange({ stage: values })}
        clearable
      />
      <MultiSelect
        size={size}
        label={t('verdict')}
        placeholder={search.verdict.length ? undefined : any}
        data={Object.values(VacancyMatchVerdictEnum).map(value => ({ value, label: tEnums(`verdict.${value}`) }))}
        value={search.verdict}
        onChange={values => onChange({ verdict: values })}
        clearable
      />
      <MultiSelect
        size={size}
        label={t('lastAction')}
        placeholder={search.lastAction.length ? undefined : any}
        data={Object.values(VacancyLastActionEnum).map(value => ({ value, label: tEnums(`lastAction.${value}`) }))}
        value={search.lastAction}
        onChange={values => onChange({ lastAction: values })}
        clearable
      />
      <MultiSelect
        size={size}
        label={t('country')}
        placeholder={search.country.length ? undefined : any}
        data={[...new Set([...VACANCY_SEARCH_DEFAULTS.country, ...options.countries, ...search.country])]}
        value={search.country}
        onChange={country => onChange({ country })}
        clearable
        searchable
      />
      <Select
        size={size}
        label={t('city')}
        placeholder={any}
        data={cityOptions(options.cities)}
        value={search.city ?? null}
        onChange={value => onChange({ city: value ?? undefined })}
        clearable
        searchable
      />
      <Select
        size={size}
        label={t('workMode')}
        placeholder={any}
        data={Object.values(WorkModeEnum).map(value => ({ value, label: tEnums(`workMode.${value}`) }))}
        value={search.workMode ?? null}
        onChange={value => onChange({ workMode: value ?? undefined })}
        clearable
      />
      <MultiSelect
        size={size}
        label={t('level')}
        placeholder={search.level.length ? undefined : any}
        data={Object.values(SeniorityLevelEnum).map(value => ({ value, label: tEnums(`level.${value}`) }))}
        value={search.level}
        onChange={values => onChange({ level: values })}
        clearable
      />
      <Select
        size={size}
        label={t('source')}
        placeholder={any}
        data={options.sources.map(source => ({ value: String(source.sourceId), label: source.name }))}
        value={search.sourceId === undefined ? null : String(search.sourceId)}
        onChange={value => onChange({ sourceId: value === null ? undefined : +value })}
        clearable
        searchable
      />
      <Select
        size={size}
        label={t('period')}
        placeholder={any}
        data={VACANCY_PERIODS.map(days => ({ value: String(days), label: t('periodDays', { days }) }))}
        value={search.sinceDays === undefined ? null : String(search.sinceDays)}
        onChange={value => onChange({ sinceDays: value === null ? undefined : +value })}
        clearable
      />
      <DebouncedText
        size={size}
        label={t('reason')}
        placeholder={t('reasonPlaceholder')}
        value={search.reason}
        onApply={reason => onChange({ reason })}
      />
      <Group gap="sm" align="flex-end" wrap="wrap">
        <Switch
          size={size}
          label={t('closed')}
          checked={search.closed === true}
          onChange={event => onChange({ closed: event.currentTarget.checked || undefined })}
          mb={8}
        />
        {search.company ? (
          <Badge
            variant="light"
            size="lg"
            tt="none"
            mb={6}
            rightSection={<CloseButton size="xs" aria-label={t('reset')} onClick={() => onChange({ company: undefined })} />}>
            {t('company', { company: search.company })}
          </Badge>
        ) : null}
        <Button
          size={size}
          variant="subtle"
          leftSection={<IconFilterOff size={16} />}
          onClick={() =>
            onChange({
              stage: [...VACANCY_SEARCH_DEFAULTS.stage],
              verdict: [...VACANCY_SEARCH_DEFAULTS.verdict],
              country: [...VACANCY_SEARCH_DEFAULTS.country],
              level: [...VACANCY_SEARCH_DEFAULTS.level],
              sinceDays: VACANCY_SEARCH_DEFAULTS.sinceDays,
              sourceId: undefined,
              city: undefined,
              workMode: undefined,
              lastAction: [...VACANCY_SEARCH_DEFAULTS.lastAction],
              q: undefined,
              reason: undefined,
              company: undefined,
              closed: undefined
            })
          }>
          {t('reset')}
        </Button>
      </Group>
    </SimpleGrid>
  );
}
