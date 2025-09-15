export function createMoneyTalkLimiter(intensity = "normal") {
  const events = [];
  const max = intensity === "jarang" ? 1 : intensity === "ramai" ? 3 : 2;
  function tryConsume(now = Date.now()) {
    while (events.length && now - events[0] > 60000) {
      events.shift();
    }
    if (events.length >= max) return false;
    events.push(now);
    return true;
  }
  return { tryConsume, get count() { return events.length; } };
}
