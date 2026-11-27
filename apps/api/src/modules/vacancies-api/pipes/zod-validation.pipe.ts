import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { type z } from 'zod';

import { VacanciesAPIErrorCodeEnum } from '../enums/vacancies-a-p-i-error-code.enum.js';

/**
 * Validates the query or the body of a request by a Zod schema and hands the parsed value on
 *
 * @template TSchema
 */
export class ZodValidationPipe<TSchema extends z.ZodType> implements PipeTransform<unknown, z.output<TSchema>> {
  /**
   * @param {TSchema} schema
   */
  constructor(private readonly schema: TSchema) {}

  /**
   * Parse the value
   *
   * @param {unknown} value
   *
   * @throws {BadRequestException} `REQUEST_INVALID` with the paths of the wrong fields
   *
   * @returns {z.output<TSchema>}
   */
  transform(value: unknown): z.output<TSchema> {
    const parsed = this.schema.safeParse(value);

    if (!parsed.success) {
      throw new BadRequestException({
        code: VacanciesAPIErrorCodeEnum.REQUEST_INVALID,
        message: 'The request is invalid',
        fields: parsed.error.issues.map(issue => issue.path.join('.'))
      });
    }

    return parsed.data;
  }
}
