import { VacancyStageEnum } from '@job-agent/shared';

import { vacancyDedupKey } from '../../vacancies/helpers/vacancy-key.helper.js';
import type { IListingScanPlan, IVacancyUpdate } from '../../vacancies/interfaces/listing-scan-plan.interface.js';
import type { VacancyInsertType, VacancyRowType, VacancyUpdateType } from '../../vacancies/interfaces/vacancy-row.interface.js';
import type { IListingScanRequest } from '../interfaces/listing-scan-request.interface.js';
import type { IScreenedPosition } from '../interfaces/screened-position.interface.js';

/**
 * Stage of a position the filter kept or dropped
 *
 * @param {IScreenedPosition} position
 *
 * @returns {VacancyStageEnum}
 */
function screenedStage(position: IScreenedPosition): VacancyStageEnum {
  return position.skipReason ? VacancyStageEnum.SKIPPED : VacancyStageEnum.LISTED;
}

/**
 * Columns the listing knows about a position — classified again on every scan
 *
 * @param {IScreenedPosition} position
 *
 * @returns {VacancyUpdateType}
 */
function listingColumns(position: IScreenedPosition): VacancyUpdateType {
  return {
    vacancy_country: position.country,
    vacancy_city: position.city,
    vacancy_work_mode: position.workMode,
    vacancy_role_family: position.roleFamily,
    vacancy_level: position.level,
    vacancy_skip_reason: position.skipReason ?? null
  };
}

/**
 * Change of a known vacancy seen again. Not yet extracted — classified and screened again, so a change of the
 * preferences takes effect; extracted — only seen; closed — reopened at the stage it had. Title, company and URL of a
 * known vacancy never change: they make its keys
 *
 * @param {VacancyRowType} row
 * @param {IScreenedPosition} position
 * @param {Date} now
 *
 * @returns {VacancyUpdateType}
 */
function seenAgain(row: VacancyRowType, position: IScreenedPosition, now: Date): VacancyUpdateType {
  const seen = { vacancy_last_seen_at: now };

  if (row.vacancy_data) {
    return row.vacancy_stage === VacancyStageEnum.CLOSED
      ? { ...seen, vacancy_stage: VacancyStageEnum.EXTRACTED, vacancy_closed_at: null }
      : seen;
  }

  return { ...seen, ...listingColumns(position), vacancy_stage: screenedStage(position), vacancy_closed_at: null };
}

/**
 * Whether an extracted vacancy's page is read again: never read, or read before the recheck time
 *
 * @param {VacancyRowType} row
 * @param {Date} recheckBefore
 *
 * @returns {boolean}
 */
function isDueForRecheck(row: VacancyRowType, recheckBefore: Date): boolean {
  if (!row.vacancy_data) {
    return false;
  }

  return !row.vacancy_checked_at || row.vacancy_checked_at < recheckBefore;
}

/**
 * What one scan writes: new positions are inserted at `listed` or `skipped`, known ones (by URL, then by the
 * company + title key, from any source) are updated, open vacancies of the source not on the page are closed,
 * extracted ones due for a recheck are named. A page
 * with no positions closes nothing — an empty answer is more likely a broken page than a company with no vacancies
 *
 * @param {IListingScanRequest} request
 *
 * @returns {IListingScanPlan}
 */
export function planListingScan(request: IListingScanRequest): IListingScanPlan {
  const byURL = new Map(request.known.map(row => [row.vacancy_url, row]));
  const byKey = new Map(request.known.map(row => [row.vacancy_dedup_key, row]));
  const inserts: VacancyInsertType[] = [];
  const updates: IVacancyUpdate[] = [];
  const seenIds = new Set<number>();
  const plannedKeys = new Set<string>();
  const recheckIds: number[] = [];

  for (const position of request.positions) {
    const dedupKey = vacancyDedupKey(position.company, position.title);
    const known = byURL.get(position.url) ?? byKey.get(dedupKey);

    if (known) {
      if (!seenIds.has(known.vacancy_id)) {
        seenIds.add(known.vacancy_id);
        updates.push({ vacancyId: known.vacancy_id, values: seenAgain(known, position, request.now) });

        if (isDueForRecheck(known, request.recheckBefore)) {
          recheckIds.push(known.vacancy_id);
        }
      }

      continue;
    }

    if (plannedKeys.has(dedupKey)) {
      continue;
    }

    plannedKeys.add(dedupKey);
    inserts.push({
      source_id: request.sourceId,
      vacancy_url: position.url,
      vacancy_title: position.title,
      vacancy_company: position.company,
      vacancy_dedup_key: dedupKey,
      ...listingColumns(position),
      vacancy_stage: screenedStage(position),
      vacancy_first_seen_at: request.now,
      vacancy_last_seen_at: request.now
    });
  }

  const closeIds =
    request.positions.length === 0 ? [] : request.open.filter(row => !seenIds.has(row.vacancy_id)).map(row => row.vacancy_id);

  return { inserts, updates, closeIds, recheckIds };
}
