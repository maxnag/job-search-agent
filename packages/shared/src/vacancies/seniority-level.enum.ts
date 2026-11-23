/**
 * Seniority of a role, lowest first — the order is the comparison
 */
export enum SeniorityLevelEnum {
  INTERN = 'intern',
  JUNIOR = 'junior',
  MIDDLE = 'middle',
  SENIOR = 'senior',
  STAFF = 'staff',
  PRINCIPAL = 'principal'
}

/**
 * Every level, lowest first
 *
 * @type {readonly SeniorityLevelEnum[]}
 */
export const SENIORITY_LEVELS: readonly SeniorityLevelEnum[] = Object.values(SeniorityLevelEnum);
