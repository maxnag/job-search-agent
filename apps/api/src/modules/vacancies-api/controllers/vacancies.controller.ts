import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Query } from '@nestjs/common';

import type { IVacancyActionAnswer, IVacancyCard, IVacancyFilterOptions, IVacancyListPage } from '@job-agent/shared';

import { ZodValidationPipe } from '../pipes/zod-validation.pipe.js';
import { type VacancyActionBodyType, vacancyActionBodySchema } from '../schemas/vacancy-action-body.schema.js';
import { type VacancyListQueryType, vacancyListQuerySchema } from '../schemas/vacancy-list-query.schema.js';
import { VacanciesAPIService } from '../services/vacancies-a-p-i.service.js';

/**
 * The vacancies for the web UI: the list, the values of its filters, the card, the owner's choices
 */
@Controller('api/vacancies')
export class VacanciesController {
  /**
   * @param {VacanciesAPIService} vacanciesAPIService
   */
  constructor(private readonly vacanciesAPIService: VacanciesAPIService) {}

  /**
   * One page of the vacancies the filter selects
   *
   * @param {VacancyListQueryType} query
   *
   * @throws {BadRequestException} `REQUEST_INVALID` for a wrong value of the query
   *
   * @returns {Promise<IVacancyListPage>}
   */
  @Get()
  async findAll(@Query(new ZodValidationPipe(vacancyListQuerySchema)) query: VacancyListQueryType): Promise<IVacancyListPage> {
    return this.vacanciesAPIService.findAll(query);
  }

  /**
   * The values the filters of the list offer
   *
   * @returns {Promise<IVacancyFilterOptions>}
   */
  @Get('filters')
  async findFilterOptions(): Promise<IVacancyFilterOptions> {
    return this.vacanciesAPIService.findFilterOptions();
  }

  /**
   * A vacancy with its extraction, verdicts and the owner's choices
   *
   * @param {number} vacancyId
   *
   * @throws {NotFoundException} `VACANCY_NOT_FOUND` if there is no such vacancy
   *
   * @returns {Promise<IVacancyCard>}
   */
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) vacancyId: number): Promise<IVacancyCard> {
    return this.vacanciesAPIService.findOne(vacancyId);
  }

  /**
   * Store the owner's choice about a vacancy, as a button under its Telegram card does
   *
   * @param {number} vacancyId
   * @param {VacancyActionBodyType} body
   *
   * @throws {BadRequestException} `REQUEST_INVALID` for an unknown choice
   * @throws {NotFoundException} `VACANCY_NOT_FOUND` if there is no such vacancy
   *
   * @returns {Promise<IVacancyActionAnswer>}
   */
  @Post(':id/actions')
  @HttpCode(HttpStatus.OK)
  async recordAction(
    @Param('id', ParseIntPipe) vacancyId: number,
    @Body(new ZodValidationPipe(vacancyActionBodySchema)) body: VacancyActionBodyType
  ): Promise<IVacancyActionAnswer> {
    return this.vacanciesAPIService.recordAction(vacancyId, body.kind);
  }
}
