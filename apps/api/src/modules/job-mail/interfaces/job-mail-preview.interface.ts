import type { JobMailKindEnum } from '@job-agent/shared';

import type { ILinkCandidate } from '../../search/interfaces/link-candidate.interface.js';
import type { IJobMailHeaders } from './job-mail-message.interface.js';

/**
 * One e-mail of a dry run
 */
export interface IJobMailPreviewMessage {
  /**
   * Headers of the e-mail
   *
   * @var {IJobMailHeaders}
   */
  readonly headers: IJobMailHeaders;

  /**
   * Kind told by the LLM
   *
   * @var {JobMailKindEnum}
   */
  readonly kind: JobMailKindEnum;

  /**
   * Links of a job alert in the order of the e-mail; empty for any other kind
   *
   * @var {readonly ILinkCandidate[]}
   */
  readonly links: readonly ILinkCandidate[];
}

/**
 * What a dry run of the mail reading saw — nothing is stored
 */
export interface IJobMailPreview {
  /**
   * Start of the window: e-mails received earlier are not read
   *
   * @var {Date}
   */
  readonly since: Date;

  /**
   * The e-mails of the window, newest first
   *
   * @var {readonly IJobMailPreviewMessage[]}
   */
  readonly messages: readonly IJobMailPreviewMessage[];
}
