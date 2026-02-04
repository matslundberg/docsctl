export type ErrorCode =
  | "NoMatchError"
  | "AmbiguousMatchError"
  | "InlineObjectConflictError"
  | "AtomicObjectConflictError"
  | "RevisionMismatchError"
  | "ExpectationFailedError"
  | "UnsupportedSelectionError"
  | "UnsupportedOperationError";

export class GdocsError extends Error {
  readonly code: ErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      details: this.details ?? null,
    };
  }
}

export class NoMatchError extends GdocsError {
  constructor(details?: Record<string, unknown>) {
    super("NoMatchError", "No matches for selector", details);
  }
}

export class AmbiguousMatchError extends GdocsError {
  constructor(details?: Record<string, unknown>) {
    super("AmbiguousMatchError", "Selector matched multiple targets", details);
  }
}

export class InlineObjectConflictError extends GdocsError {
  constructor(details?: Record<string, unknown>) {
    super("InlineObjectConflictError", "Inline atomic object conflict", details);
  }
}

export class AtomicObjectConflictError extends GdocsError {
  constructor(details?: Record<string, unknown>) {
    super("AtomicObjectConflictError", "Atomic object conflict", details);
  }
}

export class RevisionMismatchError extends GdocsError {
  constructor(details?: Record<string, unknown>) {
    super("RevisionMismatchError", "Revision mismatch", details);
  }
}

export class ExpectationFailedError extends GdocsError {
  constructor(details?: Record<string, unknown>) {
    super("ExpectationFailedError", "Expectation failed", details);
  }
}

export class UnsupportedSelectionError extends GdocsError {
  constructor(details?: Record<string, unknown>) {
    super("UnsupportedSelectionError", "Unsupported selection for command", details);
  }
}

export class UnsupportedOperationError extends GdocsError {
  constructor(details?: Record<string, unknown>) {
    super("UnsupportedOperationError", "Unsupported operation", details);
  }
}
