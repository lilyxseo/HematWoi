const AUTH_MISSING_DEFAULT_MESSAGE = 'Fitur ini memerlukan akun. Silakan masuk untuk melanjutkan.';

function extractMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }
  if (typeof error === 'object' && 'message' in error) {
    const value = error.message;
    if (typeof value === 'string') {
      return value;
    }
  }
  return '';
}

function extractCode(error) {
  if (!error || typeof error !== 'object') return '';
  if ('code' in error && typeof error.code === 'string') {
    return error.code;
  }
  if ('name' in error && typeof error.name === 'string') {
    return error.name;
  }
  return '';
}

function extractStatus(error) {
  if (!error || typeof error !== 'object') return null;
  const maybeStatus = 'status' in error ? error.status : 'statusCode' in error ? error.statusCode : null;
  if (typeof maybeStatus === 'number') {
    return maybeStatus;
  }
  if (typeof maybeStatus === 'string') {
    const parsed = Number.parseInt(maybeStatus, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function isAuthSessionMissingError(error) {
  const message = extractMessage(error).toLowerCase();
  if (message.includes('auth session missing')) return true;
  if (message.includes('session missing')) return true;
  if (message.includes('session not found')) return true;
  if (message.includes('session unavailable')) return true;
  const code = extractCode(error).toLowerCase();
  if (code.includes('auth_session_missing')) return true;
  if (code.includes('session_missing')) return true;
  if (code.includes('session_not_found')) return true;
  const status = extractStatus(error);
  if (status === 401 || status === 403) {
    if (!message) return true;
    if (message.includes('auth') || message.includes('session')) return true;
  }
  return false;
}

export function toUserFacingAuthError(error, fallbackMessage = AUTH_MISSING_DEFAULT_MESSAGE, options = {}) {
  const missingMessage = options.missingMessage || AUTH_MISSING_DEFAULT_MESSAGE;
  if (isAuthSessionMissingError(error)) {
    return missingMessage;
  }
  const extracted = extractMessage(error);
  if (extracted) return extracted;
  return fallbackMessage || AUTH_MISSING_DEFAULT_MESSAGE;
}

export function getDefaultAuthMissingMessage() {
  return AUTH_MISSING_DEFAULT_MESSAGE;
}
