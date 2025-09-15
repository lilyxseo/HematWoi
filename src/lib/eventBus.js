const listeners = {};

export function on(event, fn) {
  listeners[event] = listeners[event] || [];
  listeners[event].push(fn);
  return () => off(event, fn);
}

export function off(event, fn) {
  listeners[event] = (listeners[event] || []).filter((l) => l !== fn);
}

export function emit(event, payload) {
  (listeners[event] || []).forEach((fn) => fn(payload));
}

const EventBus = { on, off, emit };
export default EventBus;
