import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { z } from 'zod';

import { LLMStepEnum } from '@job-agent/shared';

import type { IEnv } from '../../../config/env.schema.js';
import type { ILLMSettingsOverview, ILLMStepSettings } from '../interfaces/l-l-m-step-settings.interface.js';
import { LLMSettingsRepository } from '../repositories/l-l-m-settings.repository.js';

/**
 * Settings of the LLM steps for the provider chosen by `LLM_PROVIDER`; rows are tuned by hand in `llm_settings`
 */
@Injectable()
export class LLMSettingsService {
  /**
   * @param {LLMSettingsRepository} llmSettingsRepository
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(
    private readonly llmSettingsRepository: LLMSettingsRepository,
    private readonly configService: ConfigService<IEnv, true>
  ) {}

  /**
   * Settings of a step, with the parameters validated by the provider's schema
   *
   * @param {LLMStepEnum} step
   * @param {z.ZodType<TParams>} paramsSchema
   *
   * @template TParams
   *
   * @throws {Error} `LLM_SETTINGS_MISSING` if the step has no row for the provider
   * @throws {Error} `LLM_SETTINGS_INVALID` if the parameters do not match the provider's schema
   *
   * @returns {Promise<ILLMStepSettings<TParams>>}
   */
  async findOne<TParams>(step: LLMStepEnum, paramsSchema: z.ZodType<TParams>): Promise<ILLMStepSettings<TParams>> {
    const provider = this.configService.get('LLM_PROVIDER', { infer: true });
    const row = await this.llmSettingsRepository.findOne(provider, step);

    if (!row) {
      throw new Error(`LLM_SETTINGS_MISSING: no llm_settings row for ${provider}/${step}`);
    }

    const params = paramsSchema.safeParse(row.llm_setting_params);

    if (!params.success) {
      throw new Error(`LLM_SETTINGS_INVALID: llm_setting_params of ${provider}/${step} do not match the provider schema`, {
        cause: params.error
      });
    }

    return { step, model: row.llm_setting_model, params: params.data };
  }

  /**
   * Models of the provider in use and the steps without settings
   *
   * @returns {Promise<ILLMSettingsOverview>}
   */
  async findAll(): Promise<ILLMSettingsOverview> {
    const rows = await this.llmSettingsRepository.findAll(this.configService.get('LLM_PROVIDER', { infer: true }));
    const configured = new Set(rows.map(row => row.llm_setting_step));

    return {
      models: [...new Set(rows.map(row => row.llm_setting_model))],
      missingSteps: Object.values(LLMStepEnum).filter(step => !configured.has(step))
    };
  }
}
