import { z } from 'zod';

import { LanguageLevelEnum, SkillKindEnum } from '@job-agent/shared';

/**
 * A skill as the resume names it, with its kind
 *
 * @returns {z.ZodObject}
 */
function namedSkill() {
  return z.object({
    name: z.string().min(1),
    kind: z.enum(SkillKindEnum)
  });
}

/**
 * What the LLM extracts from a resume — names and dates only; years are counted by code
 */
export const resumeExtractionSchema = z.object({
  positions: z.array(
    z.object({
      title: z.string().min(1),
      company: z.string().nullable(),
      start: z.string().nullable(),
      end: z.string().nullable(),
      skills: z.array(namedSkill())
    })
  ),
  claimed_skills: z.array(namedSkill()),
  languages: z.array(
    z.object({
      name: z.string().min(1),
      code: z.string().length(2),
      level: z.enum(LanguageLevelEnum)
    })
  )
});

/**
 * Validated extraction of a resume
 */
export type ResumeExtractionType = z.infer<typeof resumeExtractionSchema>;
