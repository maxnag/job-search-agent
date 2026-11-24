/**
 * Kind of an e-mail, told by the LLM from its headers: `job_alert` — a digest or a subscription of vacancies;
 * `recruiter` — a person writing about a job (a reply, an invitation, a rejection); `other` — anything else
 */
export enum JobMailKindEnum {
  JOB_ALERT = 'job_alert',
  RECRUITER = 'recruiter',
  OTHER = 'other'
}
