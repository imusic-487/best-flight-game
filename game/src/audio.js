// Audio: every sound is synthesised with WebAudio — no audio files.
// Engine hum follows throttle, wind follows speed, and events chime, thud
// and crash. Starts on the first user gesture; M toggles mute.

export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    muted: false,
    started: false,
  };

  audio.start = () => {
    if (audio.started) return;
    audio.started = true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);

      // Engine: two detuned saws through a low-pass filter.
      audio.engineOsc = audio.ctx.createOscillator();
      audio.engineOsc.type = 'sawtooth';
      audio.engineOsc.frequency.value = 62;
      const engineOsc2 = audio.ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 93;
      const engineFilter = audio.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      audio.engineGain = audio.ctx.createGain();
      audio.engineGain.gain.value = 0;
      audio.engineOsc.connect(engineFilter);
      engineOsc2.connect(engineFilter);
      engineFilter.connect(audio.engineGain);
      audio.engineGain.connect(audio.master);
      audio.engineOsc.start();
      engineOsc2.start();
      audio.engineOsc2 = engineOsc2;

      // Wind: looped noise buffer through a band-pass filter.
      const len = audio.ctx.sampleRate * 2;
      const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      audio.windSource = audio.ctx.createBufferSource();
      audio.windSource.buffer = buffer;
      audio.windSource.loop = true;
      const windFilter = audio.ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windFilter.Q.value = 0.6;
      audio.windGain = audio.ctx.createGain();
      audio.windGain.gain.value = 0;
      audio.windSource.connect(windFilter);
      windFilter.connect(audio.windGain);
      audio.windGain.connect(audio.master);
      audio.windSource.start();
    } catch (err) {
      audio.ctx = null; // audio is optional; the game plays on without it
    }
  };

  // Continuous update: engine pitch from throttle, wind from airspeed.
  audio.update = (plane) => {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const rpm = 55 + plane.throttle * 90 + plane.speed * 0.35;
    audio.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    audio.engineOsc2.frequency.setTargetAtTime(rpm * 1.5, t, 0.08);
    const engineLevel = plane.onGround && plane.speed < 2 ? 0.015 : 0.03 + plane.throttle * 0.075;
    audio.engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
    const windLevel = Math.min(0.16, plane.speed * 0.0011);
    audio.windGain.gain.setTargetAtTime(windLevel, t, 0.15);
  };

  audio.setMuted = (muted) => {
    audio.muted = muted;
    if (audio.master) audio.master.gain.value = muted ? 0 : 0.5;
  };

  function tone(freq, dur, type, level, when = 0, slideTo = null) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime + when;
    const osc = audio.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gain = audio.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noiseBurst(dur, level, filterFreq) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = audio.ctx.createGain();
    gain.gain.value = level;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t);
  }

  audio.ringChime = () => {
    tone(880, 0.35, 'sine', 0.22);
    tone(1318, 0.5, 'sine', 0.18, 0.07);
  };

  audio.touchdown = () => {
    tone(90, 0.25, 'sine', 0.4, 0, 45);
    noiseBurst(0.18, 0.25, 500);
  };

  audio.hardLanding = () => {
    tone(70, 0.4, 'sine', 0.5, 0, 35);
    noiseBurst(0.35, 0.4, 350);
  };

  audio.crash = () => {
    noiseBurst(0.9, 0.7, 900);
    tone(55, 0.8, 'sawtooth', 0.35, 0, 28);
  };

  audio.click = () => tone(660, 0.08, 'square', 0.08);

  audio.takeoff = () => {
    tone(440, 0.3, 'sine', 0.15, 0, 880);
  };

  return audio;
}
