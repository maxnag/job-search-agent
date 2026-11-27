'use client';

import { Anchor, Badge, Text } from '@mantine/core';
import { DataTable, type DataTableSortStatus } from 'mantine-datatable';
import { useFormatter, useTranslations } from 'next-intl';

import { SortOrderEnum, VACANCY_PAGE_SIZES, VacancySortEnum } from '@job-agent/shared';

import { Link } from '@/i18n/navigation';
import type { VacancyListType } from '@/server/schemas/vacancy-list.schema';
import { toVacancyQuery } from '@/vacancies/vacancy-search.helper';
import type { VacancySearchType } from '@/vacancies/vacancy-search.schema';

import { VerdictBadges } from './verdict-badges';

/**
 * A row of the table
 */
type VacancyRowType = VacancyListType['vacancies'][number];

/**
 * Columns the table can be sorted by
 *
 * @type {ReadonlySet<string>}
 */
const SORTABLE: ReadonlySet<string> = new Set(Object.values(VacancySortEnum));

/**
 * Props of the table of vacancies
 */
interface IVacancyTableProps {
  /**
   * The page of the list
   *
   * @var {VacancyListType}
   */
  readonly list: VacancyListType;

  /**
   * Filters of the page shown now
   *
   * @var {VacancySearchType}
   */
  readonly search: VacancySearchType;

  /**
   * True while the next page is loading
   *
   * @var {boolean}
   */
  readonly fetching: boolean;

  /**
   * Open the list with its page, size or order changed
   *
   * @var {(changes: Partial<VacancySearchType>) => void}
   */
  readonly onChange: (changes: Partial<VacancySearchType>) => void;
}

/**
 * The page of vacancies as a table: the title opens the card, a column header sorts, the footer turns the pages. The
 * page, its size and the order live in the address like the filters
 *
 * @param {IVacancyTableProps} props
 *
 * @returns {React.JSX.Element}
 */
export function VacancyTable({ list, search, fetching, onChange }: Readonly<IVacancyTableProps>): React.JSX.Element {
  const t = useTranslations('vacancies.table');
  const tEnums = useTranslations('enums');
  const format = useFormatter();
  const from = toVacancyQuery(search).toString();
  const sortStatus: DataTableSortStatus<VacancyRowType> = {
    columnAccessor: search.sort,
    direction: search.order === SortOrderEnum.ASC ? 'asc' : 'desc'
  };

  return (
    <DataTable<VacancyRowType>
      withTableBorder
      borderRadius="sm"
      striped
      highlightOnHover
      minHeight={180}
      idAccessor="vacancyId"
      records={[...list.vacancies]}
      fetching={fetching}
      noRecordsText={t('empty')}
      totalRecords={list.total}
      recordsPerPage={list.pageSize}
      page={list.page}
      onPageChange={page => onChange({ page })}
      recordsPerPageOptions={[...VACANCY_PAGE_SIZES]}
      onRecordsPerPageChange={pageSize => onChange({ pageSize })}
      recordsPerPageLabel={t('perPage')}
      paginationText={({ from: first, to, totalRecords }) => t('pagination', { from: first, to, total: totalRecords })}
      sortStatus={sortStatus}
      onSortStatusChange={status => {
        if (SORTABLE.has(String(status.columnAccessor))) {
          onChange({
            sort: status.columnAccessor as VacancySortEnum,
            order: status.direction === 'asc' ? SortOrderEnum.ASC : SortOrderEnum.DESC
          });
        }
      }}
      columns={[
        {
          accessor: VacancySortEnum.TITLE,
          title: t('title'),
          sortable: true,
          render: vacancy => (
            <Anchor
              component={Link}
              href={from ? `/vacancies/${vacancy.vacancyId}?from=${encodeURIComponent(from)}` : `/vacancies/${vacancy.vacancyId}`}
              fw={500}>
              {vacancy.title}
            </Anchor>
          )
        },
        { accessor: VacancySortEnum.COMPANY, title: t('company'), sortable: true },
        {
          accessor: 'place',
          title: t('place'),
          render: vacancy => [vacancy.country, vacancy.city].filter(Boolean).join(', ') || '—'
        },
        {
          accessor: 'workMode',
          title: t('workMode'),
          render: vacancy => (vacancy.workMode ? tEnums(`workMode.${vacancy.workMode}`) : '—')
        },
        {
          accessor: 'level',
          title: t('level'),
          render: vacancy => (vacancy.level ? tEnums(`level.${vacancy.level}`) : '—')
        },
        {
          accessor: 'stage',
          title: t('stage'),
          render: vacancy => (
            <Badge variant="outline" color="gray" size="sm" tt="none">
              {tEnums(`stage.${vacancy.stage}`)}
            </Badge>
          )
        },
        { accessor: 'verdicts', title: t('verdicts'), render: vacancy => <VerdictBadges verdicts={vacancy.verdicts} /> },
        {
          accessor: 'lastAction',
          title: t('lastAction'),
          render: vacancy => (vacancy.lastAction ? tEnums(`lastAction.${vacancy.lastAction}`) : '—')
        },
        {
          accessor: VacancySortEnum.FIRST_SEEN_AT,
          title: t('firstSeenAt'),
          sortable: true,
          render: vacancy => (
            <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {format.dateTime(new Date(vacancy.firstSeenAt), 'dateTime')}
            </Text>
          )
        }
      ]}
    />
  );
}
