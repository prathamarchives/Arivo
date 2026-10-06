/**
 * TYPED DOMAIN ERRORS — "something went wrong" is banned.
 * every failure arivo can name has a code; codes map to diagnostics events
 * and to user-facing messages. errors cross the ipc boundary as
 * {code, message, details} via toJSON.
 */

export type ArivoErrorCode =
  | 'BOOK_NOT_FOUND'
  | 'BOOK_ALREADY_IMPORTED'
  | 'INVALID_DOCUMENT'
  | 'DOCUMENT_CORRUPT'
  | 'UNSUPPORTED_FORMAT'
  | 'ANCHOR_UNRESOLVED'
  | 'ANCHOR_AMBIGUOUS'
  | 'STORAGE_UNAVAILABLE'
  | 'DATABASE_CORRUPT'
  | 'MIGRATION_FAILED'
  | 'PERMISSION_DENIED'
  | 'PATH_ESCAPE'
  | 'PATH_INVALID'
  | 'RECOVERY_FAILED'
  | 'VALIDATION_FAILED'
  | 'IMPORT_FAILED';

export interface SerializedArivoError {
  code: ArivoErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export class ArivoError extends Error {
  readonly code: ArivoErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ArivoErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ArivoError';
    this.code = code;
    this.details = details;
  }

  toJSON(): SerializedArivoError {
    return { code: this.code, message: this.message, details: this.details };
  }

  static is(err: unknown): err is ArivoError {
    return err instanceof ArivoError;
  }
}

/** ipc shape: any thrown value → a serializable typed error */
export function serializeError(err: unknown): SerializedArivoError {
  if (ArivoError.is(err)) return err.toJSON();
  if (err instanceof Error) {
    return { code: 'VALIDATION_FAILED', message: err.message };
  }
  return { code: 'VALIDATION_FAILED', message: String(err) };
}
