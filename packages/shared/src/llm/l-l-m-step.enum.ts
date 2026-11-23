/**
 * Pipeline steps that call the LLM; each one has its own row of settings per provider
 */
export enum LLMStepEnum {
  RESUME = 'resume',
  LISTING = 'listing',
  MAIL = 'mail',
  EXTRACT = 'extract',
  NAVIGATION = 'navigation'
}
