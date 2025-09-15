export function goalProgress(goal) {
  if (!goal || !goal.target) return 0;
  return Math.min(goal.allocated / goal.target, 1);
}

export function estimateGoalETA(goal, avgPerDay = 0) {
  if (!goal || !avgPerDay) return null;
  const remaining = (goal.target || 0) - (goal.allocated || 0);
  if (remaining <= 0) return new Date();
  const days = Math.ceil(remaining / avgPerDay);
  const eta = new Date();
  eta.setDate(eta.getDate() + days);
  return eta;
}

export function updateGoalBalance(goals, id, amount) {
  return goals.map((g) => (g.id === id ? { ...g, allocated: amount } : g));
}

export function updateEnvelopeBalance(envelopes, category, amount) {
  return envelopes.map((e) =>
    e.category === category ? { ...e, balance: amount } : e
  );
}

// rules: { goals: { [id]: { fixed?:number, percent?:number } }, envelopes: { [cat]: { fixed?:number, percent?:number } } }
export function allocateIncome(amount, goals, envelopes, rules = {}) {
  let remaining = amount;
  const gRules = rules.goals || {};
  const eRules = rules.envelopes || {};

  const newGoals = goals.map((g) => {
    const r = gRules[g.id] || {};
    let add = 0;
    if (r.fixed) {
      add += r.fixed;
      remaining -= r.fixed;
    }
    if (r.percent) {
      const v = (amount * r.percent) / 100;
      add += v;
      remaining -= v;
    }
    return { ...g, allocated: (g.allocated || 0) + add };
  });

  const newEnvelopes = envelopes.map((e) => {
    const r = eRules[e.category] || {};
    let add = 0;
    if (r.fixed) {
      add += r.fixed;
      remaining -= r.fixed;
    }
    if (r.percent) {
      const v = (amount * r.percent) / 100;
      add += v;
      remaining -= v;
    }
    return { ...e, balance: (e.balance || 0) + add };
  });

  return { goals: newGoals, envelopes: newEnvelopes, remaining };
}
