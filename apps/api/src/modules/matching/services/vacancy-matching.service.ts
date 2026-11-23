import { Injectable, Logger } from '@nestjs/common';

import { VacancyMatchVerdictEnum } from '@job-agent/shared';

import { parseProfilePreferences } from '../../vacancies/helpers/profile-preferences.helper.js';
import type { VacancyRowType } from '../../vacancies/interfaces/vacancy-row.interface.js';
import { readVacancyData } from '../helpers/vacancy-data.helper.js';
import { matchVacancy } from '../helpers/vacancy-match.helper.js';
import type { IMatchProfile } from '../interfaces/match-profile.interface.js';
import type { IMatchRun } from '../interfaces/match-run.interface.js';
import { MatchProfileRepository } from '../repositories/match-profile.repository.js';
import { VacancyMatchRepository } from '../repositories/vacancy-match.repository.js';

/**
 * Verdicts the owner is told about
 *
 * @type {ReadonlySet<VacancyMatchVerdictEnum>}
 */
const NOTIFIED_VERDICTS: ReadonlySet<VacancyMatchVerdictEnum> = new Set([VacancyMatchVerdictEnum.FIT, VacancyMatchVerdictEnum.ALMOST]);

/**
 * Matches extracted vacancies against the current resume version of each profile — code only, no LLM — and stores
 * one verdict per pair; the caller tells the owner about the new `fit` and `almost` ones. A vacancy the owner already
 * got a card for, with an earlier resume version, is not new: its verdict takes over the time that card was sent
 */
@Injectable()
export class VacancyMatchingService {
  /**
   * Logger
   *
   * @var {Logger}
   */
  private readonly logger = new Logger(VacancyMatchingService.name);

  /**
   * @param {MatchProfileRepository} matchProfileRepository
   * @param {VacancyMatchRepository} vacancyMatchRepository
   */
  constructor(
    private readonly matchProfileRepository: MatchProfileRepository,
    private readonly vacancyMatchRepository: VacancyMatchRepository
  ) {}

  /**
   * Match one vacancy, just extracted, against every profile
   *
   * @param {VacancyRowType} vacancy
   *
   * @throws {Error} `PROFILE_PREFERENCES_INVALID` if a profile's preferences are invalid
   *
   * @returns {Promise<IMatchRun>}
   */
  async matchVacancy(vacancy: VacancyRowType): Promise<IMatchRun> {
    return this.run(await this.matchProfileRepository.findCurrent(), [vacancy]);
  }

  /**
   * Match every open extracted vacancy against the current resume version of a profile — after a new version
   *
   * @param {number} profileId
   *
   * @throws {Error} `PROFILE_PREFERENCES_INVALID` if the profile's preferences are invalid
   *
   * @returns {Promise<IMatchRun>}
   */
  async matchProfile(profileId: number): Promise<IMatchRun> {
    const [profiles, vacancies] = await Promise.all([
      this.matchProfileRepository.findCurrent(profileId),
      this.vacancyMatchRepository.findExtractedVacancies()
    ]);
    const run = await this.run(profiles, vacancies);

    this.logger.log({
      message: 'Profile matched',
      profileId,
      vacancies: vacancies.length,
      ...run.verdicts,
      notifiable: run.notifiableMatchIds.length
    });

    return run;
  }

  /**
   * Store the verdict of every vacancy against every profile
   *
   * @param {readonly IMatchProfile[]} profiles
   * @param {readonly VacancyRowType[]} vacancies
   *
   * @returns {Promise<IMatchRun>}
   */
  private async run(profiles: readonly IMatchProfile[], vacancies: readonly VacancyRowType[]): Promise<IMatchRun> {
    const verdicts = { [VacancyMatchVerdictEnum.FIT]: 0, [VacancyMatchVerdictEnum.ALMOST]: 0, [VacancyMatchVerdictEnum.NO_FIT]: 0 };
    const notifiableMatchIds: number[] = [];
    let unreadable = 0;

    for (const profile of profiles) {
      const preferences = parseProfilePreferences(profile.profileName, profile.preferences);
      const resume = { skillKeys: new Set(profile.skillKeys), experienceYears: profile.experienceYears };
      const notifiedAt = await this.vacancyMatchRepository.findNotifiedAt(profile.profileId);

      for (const vacancy of vacancies) {
        const data = readVacancyData(vacancy.vacancy_data);

        if (!data) {
          unreadable++;

          continue;
        }

        const result = matchVacancy(data, vacancy.vacancy_company, preferences, resume);
        const stored = await this.vacancyMatchRepository.upsert({ vacancyId: vacancy.vacancy_id, resumeId: profile.resumeId, ...result });

        this.logger.debug({
          message: 'Vacancy matched',
          vacancyId: vacancy.vacancy_id,
          resumeId: profile.resumeId,
          verdict: stored.verdict
        });

        verdicts[stored.verdict]++;

        if (!NOTIFIED_VERDICTS.has(stored.verdict) || stored.notifiedAt !== null) {
          continue;
        }

        const toldAt = notifiedAt.get(vacancy.vacancy_id);

        if (toldAt) {
          await this.vacancyMatchRepository.markNotified(stored.vacancyMatchId, toldAt);
        } else {
          notifiableMatchIds.push(stored.vacancyMatchId);
        }
      }
    }

    if (unreadable > 0) {
      this.logger.warn({ message: 'Vacancies with unreadable data left unmatched', unreadable });
    }

    return { verdicts, notifiableMatchIds, unreadable };
  }
}
