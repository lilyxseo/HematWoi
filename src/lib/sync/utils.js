export function calcBackoff(attempt) {
  return Math.min(30000, 500 * 2 ** attempt);
}

export function normalize(_entity, payload) {
  return {
    id: payload.id || crypto.randomUUID(),
    rev: payload.rev || 0,
    ...payload,
  };
}
