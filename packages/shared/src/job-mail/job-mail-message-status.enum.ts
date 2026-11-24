/**
 * What became of an e-mail read from the mailbox: `processed` — a job alert whose links were read; `ignored` — not a
 * job alert, or the alert of a source the owner switched off, its body never fetched; `failed` — a job alert that
 * failed after its last attempt. None of them is read again
 */
export enum JobMailMessageStatusEnum {
  PROCESSED = 'processed',
  IGNORED = 'ignored',
  FAILED = 'failed'
}
