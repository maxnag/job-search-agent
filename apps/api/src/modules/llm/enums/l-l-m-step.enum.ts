/**
 * Pipeline steps that call the LLM; each one has its own model in the environment
 */
export enum LLMStepEnum {
  MAIL = 'mail',
  EXTRACT = 'extract',
  NAVIGATION = 'navigation'
}
