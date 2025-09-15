export const CHALLENGE_TEMPLATES = [
  {
    title: "No Boba 7 Hari",
    type: "avoid",
    durationDays: 7,
    rules: { category: "Hiburan" },
    rewardXP: 50,
  },
  {
    title: "No GoFood 7 Hari",
    type: "avoid",
    durationDays: 7,
    rules: { category: "Makan" },
    rewardXP: 50,
  },
  {
    title: "Batasi Transport 50k/Hari",
    type: "limit",
    durationDays: 7,
    rules: { category: "Transport", limit: 50000, period: "day" },
    rewardXP: 50,
  },
  {
    title: "Batasi Jajan 50k/Hari",
    type: "limit",
    durationDays: 7,
    rules: { category: "Belanja", limit: 50000, period: "day" },
    rewardXP: 50,
  },
  {
    title: "Tabung 100k/Minggu",
    type: "target",
    durationDays: 7,
    rules: { category: "Tabungan", target: 100000 },
    rewardXP: 50,
  },
  {
    title: "Hemat Ongkir 20k/Hari",
    type: "limit",
    durationDays: 7,
    rules: { category: "Transport", limit: 20000, period: "day" },
    rewardXP: 50,
  },
  {
    title: "No Kopi Seminggu",
    type: "avoid",
    durationDays: 7,
    rules: { category: "Makan" },
    rewardXP: 50,
  },
  {
    title: "Tabung 500k/Bulan",
    type: "target",
    durationDays: 30,
    rules: { category: "Tabungan", target: 500000 },
    rewardXP: 100,
  },
];

const DAY = 24 * 60 * 60 * 1000;

export function evaluateChallenge(challenge, txs, today = new Date()) {
  if (!challenge) return { status: "active", progress: 0 };
  const start = new Date(challenge.startDate);
  const end = new Date(challenge.endDate);
  const now = today > end ? end : today;
  const duration = Math.max(1, challenge.durationDays || 1);
  let status = "active";
  let progress = 0;

  if (challenge.type === "avoid") {
    const violated = txs.some(
      (t) =>
        t.category === challenge.rules?.category &&
        new Date(t.date) >= start &&
        new Date(t.date) <= end
    );
    const daysPassed = Math.floor((now - start) / DAY) + 1;
    progress = Math.min(daysPassed / duration, 1);
    if (violated) status = "failed";
    else if (today > end) status = "completed";
  } else if (challenge.type === "limit") {
    const { category, limit, period = "day" } = challenge.rules || {};
    const interval = period === "week" ? 7 : 1;
    const checkEnd = now;
    let passed = 0;
    let failed = false;
    for (let d = new Date(start); d <= checkEnd; d.setDate(d.getDate() + interval)) {
      const periodStart = new Date(d);
      const periodEnd = new Date(d);
      periodEnd.setDate(periodEnd.getDate() + interval);
      const total = txs
        .filter(
          (t) =>
            t.category === category &&
            t.type === "expense" &&
            new Date(t.date) >= periodStart &&
            new Date(t.date) < periodEnd
        )
        .reduce((sum, t) => sum + t.amount, 0);
      if (total <= limit) passed += interval;
      else {
        failed = true;
        break;
      }
    }
    progress = Math.min(passed / duration, 1);
    if (failed) status = "failed";
    else if (today > end) status = "completed";
  } else if (challenge.type === "target") {
    const { category, target } = challenge.rules || {};
    const total = txs
      .filter(
        (t) =>
          t.category === category &&
          t.type === "income" &&
          new Date(t.date) >= start &&
          new Date(t.date) <= end
      )
      .reduce((sum, t) => sum + t.amount, 0);
    progress = target ? Math.min(total / target, 1) : 0;
    if (progress >= 1) status = "completed";
    else if (today > end) status = "failed";
  }

  return { status, progress };
}

export function remainingDays(challenge, today = new Date()) {
  const end = new Date(challenge.endDate);
  const diff = Math.ceil((end - today) / DAY);
  return diff > 0 ? diff : 0;
}
