let ctx;
function getCtx() {
  if (typeof window === "undefined") return null;
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}

function beep({ frequency = 440, duration = 0.3 } = {}) {
  const audio = getCtx();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.frequency.value = frequency;
  osc.start();
  gain.gain.setValueAtTime(0.1, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  osc.stop(audio.currentTime + duration);
}

export function playChaChing() {
  beep({ frequency: 880, duration: 0.4 });
  setTimeout(() => beep({ frequency: 660, duration: 0.3 }), 150);
}

export function playKrik() {
  beep({ frequency: 300, duration: 0.2 });
  setTimeout(() => beep({ frequency: 260, duration: 0.2 }), 200);
  setTimeout(() => beep({ frequency: 220, duration: 0.2 }), 400);
}

