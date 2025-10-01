const WINDOW_MS = 60_000;

export function createMoneyTalkLimiter(intensity = "normal") {
  const events = [];
  const max = intensity === "jarang" ? 1 : intensity === "ramai" ? 3 : 2;

  function prune(now = Date.now()) {
    while (events.length && now - events[0] > WINDOW_MS) {
      events.shift();
    }
  }

  function estimateWait(now = Date.now()) {
    prune(now);
    if (events.length < max) return 0;
    return Math.max(0, WINDOW_MS - (now - events[0]));
  }

  function tryConsume(now = Date.now()) {
    prune(now);
    if (events.length >= max) {
      return { allowed: false, wait: estimateWait(now) };
    }
    events.push(now);
    return { allowed: true, wait: 0 };
  }

  return {
    tryConsume,
    estimateWait,
    get count() {
      prune();
      return events.length;
    },
  };
}
