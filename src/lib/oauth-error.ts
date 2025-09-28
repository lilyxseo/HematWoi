type OAuthErrorLike = {
  message?: string | null;
  error?: string | null;
  error_description?: string | null;
  errorDescription?: string | null;
  detail?: string | null;
  code?: string | null;
  status?: number | string | null;
};

type OAuthErrorParams = {
  fallback: string;
  error?: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
  hint?: string | null;
  status?: number | string | null;
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

export function formatOAuthErrorMessage(error: unknown, fallback: string): string {
  const details: string[] = [];
  let resolvedMessage: string | null = null;

  if (error instanceof Error) {
    resolvedMessage = error.message?.trim() || null;
    if (!resolvedMessage && isNonEmptyString((error as OAuthErrorLike).message)) {
      resolvedMessage = ((error as OAuthErrorLike).message ?? '').trim();
    }
  } else if (isNonEmptyString(error)) {
    resolvedMessage = error.trim();
  }

  if (error && typeof error === 'object') {
    const err = error as OAuthErrorLike;
    const messageCandidates = [
      err.error_description,
      err.errorDescription,
      err.detail,
      err.message,
      err.error,
    ];
    const candidate = messageCandidates.find(isNonEmptyString);
    if (candidate) {
      resolvedMessage = candidate.trim();
    }

    if (isNonEmptyString(err.code)) {
      details.push(`Kode: ${err.code.trim()}`);
    }
    if (typeof err.status === 'number' && Number.isFinite(err.status)) {
      details.push(`Status: ${err.status}`);
    } else if (isNonEmptyString(err.status)) {
      details.push(`Status: ${err.status.trim()}`);
    }
  }

  const message = resolvedMessage || fallback;
  if (details.length === 0) {
    return message;
  }
  return `${message} (${details.join(', ')})`;
}

export function formatOAuthQueryError({
  fallback,
  error,
  errorCode,
  errorDescription,
  hint,
  status,
}: OAuthErrorParams): string {
  const parts: string[] = [];

  if (isNonEmptyString(errorDescription)) {
    parts.push(errorDescription.trim());
  }

  if (isNonEmptyString(error)) {
    parts.push(`Kode: ${error.trim()}`);
  }

  if (isNonEmptyString(errorCode)) {
    parts.push(`Error code: ${errorCode.trim()}`);
  }

  if (isNonEmptyString(hint)) {
    parts.push(`Hint: ${hint.trim()}`);
  }

  if (typeof status === 'number' && Number.isFinite(status)) {
    parts.push(`Status: ${status}`);
  } else if (isNonEmptyString(status)) {
    parts.push(`Status: ${status.trim()}`);
  }

  if (parts.length === 0) {
    return fallback;
  }

  return parts.join(' ');
}
