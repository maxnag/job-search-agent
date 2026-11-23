import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { llmSettings } from '@job-agent/db';
import type { LLMProviderEnum, LLMStepEnum } from '@job-agent/shared';

import { DatabaseService } from '../../database/services/database.service.js';
import type { LLMSettingRowType } from '../interfaces/l-l-m-setting-row.interface.js';

/**
 * Reads the LLM settings rows
 */
@Injectable()
export class LLMSettingsRepository {
  /**
   * @param {DatabaseService} databaseService
   */
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Settings of one step of a provider
   *
   * @param {LLMProviderEnum} provider
   * @param {LLMStepEnum} step
   *
   * @returns {Promise<LLMSettingRowType | undefined>}
   */
  async findOne(provider: LLMProviderEnum, step: LLMStepEnum): Promise<LLMSettingRowType | undefined> {
    const [row] = await this.databaseService.db
      .select()
      .from(llmSettings)
      .where(and(eq(llmSettings.llm_setting_provider, provider), eq(llmSettings.llm_setting_step, step)))
      .limit(1);

    return row;
  }

  /**
   * Every settings row of a provider
   *
   * @param {LLMProviderEnum} provider
   *
   * @returns {Promise<LLMSettingRowType[]>}
   */
  async findAll(provider: LLMProviderEnum): Promise<LLMSettingRowType[]> {
    return this.databaseService.db.select().from(llmSettings).where(eq(llmSettings.llm_setting_provider, provider));
  }
}
