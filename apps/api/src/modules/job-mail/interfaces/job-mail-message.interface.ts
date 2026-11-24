/**
 * Headers of one e-mail, read without its body
 */
export interface IJobMailHeaders {
  /**
   * Id of the e-mail in the mailbox of the provider; only the adapter that issued it reads it back
   *
   * @var {string}
   */
  readonly providerId: string;

  /**
   * Key of the e-mail across providers: its `Message-ID` header, `<provider>:<provider id>` when it has none
   *
   * @var {string}
   */
  readonly messageKey: string;

  /**
   * Display name of the sender, null when the header gives none
   *
   * @var {string | null}
   */
  readonly senderName: string | null;

  /**
   * Address of the sender, lower case; empty when the header gives none
   *
   * @var {string}
   */
  readonly senderAddress: string;

  /**
   * Subject, empty when there is none
   *
   * @var {string}
   */
  readonly subject: string;

  /**
   * When the mailbox received the e-mail
   *
   * @var {Date}
   */
  readonly receivedAt: Date;
}

/**
 * One e-mail with its body
 */
export interface IJobMailMessage extends IJobMailHeaders {
  /**
   * HTML body, null when the e-mail has only text
   *
   * @var {string | null}
   */
  readonly html: string | null;

  /**
   * Text body, null when the e-mail has only HTML
   *
   * @var {string | null}
   */
  readonly text: string | null;
}
