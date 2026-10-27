// Chiptune sound effects, generated with square waves and noise. Nothing to download.
(function () {
  let ac = null;
  const ctx = () => { try { ac = ac || new AudioContext(); if (ac.state === "suspended") ac.resume(); } catch (e) { ac = null; } return ac; };
  const N = { C5: 523, D5: 587, E5: 659, F5: 698, G5: 784, A5: 880, B5: 988, C6: 1047, E6: 1319, G6: 1568, G4: 392, E4: 330, C4: 262 };

  // notes: [frequency, start (s), length (s)]
  function tones(notes, type = "square", vol = 0.05) {
    const a = ctx(); if (!a) return;
    const t0 = a.currentTime + 0.02;
    for (const [hz, at, len] of notes) {
      const o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.value = hz;
      g.gain.setValueAtTime(vol, t0 + at); g.gain.exponentialRampToValueAtTime(0.001, t0 + at + len);
      o.connect(g).connect(a.destination); o.start(t0 + at); o.stop(t0 + at + len + 0.02);
    }
  }
  function noise(len, vol = 0.08, from = 900, to = 400) {
    const a = ctx(); if (!a) return;
    const buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = "bandpass"; f.frequency.setValueAtTime(from, a.currentTime); f.frequency.linearRampToValueAtTime(to, a.currentTime + len);
    g.gain.value = vol; src.connect(f).connect(g).connect(a.destination); src.start();
  }

  const SOUNDS = {
    tick: () => tones([[N.A5, 0, 0.06], [N.E6, 0.06, 0.1]]),
    untick: () => tones([[N.E5, 0, 0.06], [N.C5, 0.06, 0.1]]),
    allDone: () => tones([[N.C5, 0, 0.1], [N.E5, 0.1, 0.1], [N.G5, 0.2, 0.1], [N.C6, 0.3, 0.3]]),
    badge: () => tones([[N.G5, 0, 0.08], [N.C6, 0.09, 0.08], [N.E6, 0.18, 0.08], [N.G6, 0.27, 0.35]]),
    whistle: () => tones([[2400, 0, 0.12], [2400, 0.18, 0.4]], "sine", 0.04),
    goal: () => { noise(1.6, 0.1, 700, 1400); tones([[N.C5, 0.1, 0.12], [N.C5, 0.25, 0.12], [N.G5, 0.4, 0.4]]); },
    concede: () => tones([[N.E5, 0, 0.15], [N.C5, 0.15, 0.3]], "triangle", 0.05),
    win: () => { noise(2, 0.08, 600, 1200); tones([[N.C5, 0, 0.12], [N.E5, 0.12, 0.12], [N.G5, 0.24, 0.12], [N.C6, 0.36, 0.12], [N.G5, 0.48, 0.12], [N.C6, 0.6, 0.5]]); },
    lose: () => tones([[N.G4, 0, 0.2], [N.E4, 0.22, 0.2], [N.C4, 0.44, 0.5]], "triangle", 0.05),
    promotion: () => { noise(2.5, 0.08, 600, 1500); tones([[N.G4, 0, 0.1], [N.C5, 0.1, 0.1], [N.E5, 0.2, 0.1], [N.G5, 0.3, 0.2], [N.E5, 0.5, 0.1], [N.G5, 0.6, 0.6]]); },
    chime: () => tones([[660, 0, 0.08], [880, 0.09, 0.08], [1320, 0.18, 0.12]], "square", 0.04),
  };
  // Plays only when sound effects are switched on in the save.
  function play(name, state) {
    if (state && state.sound === false) return;
    try { (SOUNDS[name] || (() => {}))(); } catch (e) {}
  }
  window.SFX = { play };
})();
