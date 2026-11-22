import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { IEnv } from '../../../config/env.schema.js';
import { LLMStepEnum } from '../enums/l-l-m-step.enum.js';

/**
 * Model of each pipeline step, read from the environment
 */
@Injectable()
export class LLMModelService {
  /**
   * @param {ConfigService<IEnv, true>} configService
   */
  constructor(private readonly configService: ConfigService<IEnv, true>) {}

  /**
   * Model configured for a step
   *
   * @param {LLMStepEnum} step
   *
   * @returns {string}
   */
  resolve(step: LLMStepEnum): string {
    switch (step) {
      case LLMStepEnum.MAIL:
        return this.configService.get('LLM_MODEL_MAIL', { infer: true });
      case LLMStepEnum.EXTRACT:
        return this.configService.get('LLM_MODEL_EXTRACT', { infer: true });
      case LLMStepEnum.NAVIGATION:
        return this.configService.get('LLM_MODEL_NAVIGATION', { infer: true });
    }
  }

  /**
   * Every distinct model the steps use
   *
   * @returns {string[]}
   */
  findAll(): string[] {
    return [...new Set(Object.values(LLMStepEnum).map(step => this.resolve(step)))];
  }
}
