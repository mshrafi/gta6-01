// Synthesized sound only — WebAudio oscillators and filtered noise. No audio files.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      // Engine hum: low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(ctx.destination);
      engineOsc.start();
      // Siren: two-tone triangle.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain); sirenGain.connect(ctx.destination);
      sirenOsc.start();
    } catch { ctx = null; }
    return ctx;
  }
  function tone(freq, dur, type, vol, slideTo) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    try {
      const o = c.createOscillator(); const g = c.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), c.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.12, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      o.connect(g); g.connect(c.destination);
      o.start(); o.stop(c.currentTime + dur + 0.02);
    } catch { /* audio is best-effort */ }
  }
  function noise(dur, vol, freq) {
    if (muted) return;
    const c = ensure(); if (!c) return;
    try {
      const len = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
      const g = c.createGain(); g.gain.value = vol || 0.2;
      src.connect(f); f.connect(g); g.connect(c.destination);
      src.start();
    } catch { /* best-effort */ }
  }
  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    setMuted(m) {
      muted = m;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
    },
    isMuted() { return muted; },
    shot() { noise(0.14, 0.3, 2400); tone(180, 0.08, 'square', 0.1, 60); },
    enemyShot() { noise(0.1, 0.14, 1800); },
    punch() { noise(0.07, 0.18, 700); },
    crash() { noise(0.3, 0.3, 500); tone(90, 0.25, 'sawtooth', 0.15, 40); },
    blip() { tone(880, 0.09, 'sine', 0.14, 1320); },
    pickup() { tone(660, 0.08, 'sine', 0.14); tone(990, 0.12, 'sine', 0.14); },
    click() { tone(1200, 0.04, 'square', 0.07); },
    jingle() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.14), i * 110)); },
    fail() { tone(220, 0.3, 'sawtooth', 0.12, 110); },
    reload() { tone(500, 0.05, 'square', 0.08); setTimeout(() => tone(700, 0.05, 'square', 0.08), 90); },
    engine(speed01, driving) {
      if (!ctx || muted) return;
      try {
        const target = driving ? 0.05 + speed01 * 0.05 : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
        engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.08);
      } catch { /* best-effort */ }
    },
    siren(on, dt) {
      if (!ctx) return;
      try {
        if (on && !muted) {
          sirenTimer += dt;
          sirenOsc.frequency.value = 650 + 250 * Math.sin(sirenTimer * 5);
          sirenGain.gain.setTargetAtTime(0.035, ctx.currentTime, 0.1);
        } else {
          sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
        }
      } catch { /* best-effort */ }
    },
  };
}
