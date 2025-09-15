const KEY = 'hematwoi:v3:subs';

export function loadSubscriptions() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSubscriptions(subs) {
  localStorage.setItem(KEY, JSON.stringify(subs));
}

export function nextDue(sub) {
  const now = new Date();
  if (sub.period === 'annual') {
    const [m, d] = (sub.dueDay || '01-01').split('-').map(Number);
    let due = new Date(now.getFullYear(), m - 1, d);
    if (due < now) due = new Date(now.getFullYear() + 1, m - 1, d);
    return due;
  }
  const day = Number(sub.dueDay) || 1;
  let due = new Date(now.getFullYear(), now.getMonth(), day);
  if (due < now) due = new Date(now.getFullYear(), now.getMonth() + 1, day);
  return due;
}

export function daysUntil(date) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = end - start;
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

export function projectMonthlyCost(subs = []) {
  return subs.reduce(
    (sum, s) => sum + (s.period === 'annual' ? s.amount / 12 : s.amount),
    0
  );
}

export function findUpcoming(subs = [], windowDays = 7) {
  return subs
    .map((s) => {
      const due = nextDue(s);
      return { sub: s, days: daysUntil(due) };
    })
    .filter((it) => it.days >= 0 && it.days <= windowDays);
}

