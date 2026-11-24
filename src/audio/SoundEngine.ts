class SoundEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOscs: OscillatorNode[] = [];

  private soundEnabled = true;
  private ambientEnabled = true;

  public configure(soundEnabled: boolean, ambientEnabled: boolean) {
    this.soundEnabled = soundEnabled;
    this.ambientEnabled = ambientEnabled;
    this.updateAmbientState();
  }

  public unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.createNoiseBuffer();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    this.updateAmbientState();
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.08 * white) / 1.08;
      data[i] = last * 2.2;
    }
    this.noiseBuffer = buf;
  }

  private updateAmbientState() {
    if (!this.ctx) return;
    const shouldPlay = this.soundEnabled && this.ambientEnabled;

    if (shouldPlay && !this.ambientGain) {
      // Soft, warm cozy room chord pad (very quiet and soothing)
      const master = this.ctx.createGain();
      master.gain.value = 0.0001;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      filter.connect(master);
      master.connect(this.ctx.destination);

      const freqs = [174.61, 220.0, 261.63, 329.63]; // Warm Fmaj7
      for (const f of freqs) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.value = 0.008;
        osc.connect(g);
        g.connect(filter);
        osc.start();
        this.ambientOscs.push(osc);
      }

      master.gain.exponentialRampToValueAtTime(0.45, this.ctx.currentTime + 2.0);
      this.ambientGain = master;
    } else if (!shouldPlay && this.ambientGain) {
      const now = this.ctx.currentTime;
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.setTargetAtTime(0.0001, now, 0.25);
      const oldOscs = this.ambientOscs;
      const oldGain = this.ambientGain;
      this.ambientOscs = [];
      this.ambientGain = null;
      setTimeout(() => {
        oldOscs.forEach((o) => {
          try {
            o.stop();
          } catch {
            // ignore
          }
        });
        oldGain.disconnect();
      }, 900);
    }
  }

  /** Soft natural rat squeak / chirp */
  public playSqueak(pitchScale = 1.0) {
    if (!this.soundEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    const base = (1950 + Math.random() * 550) * pitchScale;
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(base * 1.38, now + 0.055);
    osc.frequency.exponentialRampToValueAtTime(base * 0.92, now + 0.13);

    filter.type = 'bandpass';
    filter.frequency.value = base * 1.1;
    filter.Q.value = 3.5;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }

  /** Happy bruxing (soft rhythmic tooth-chattering when petted) */
  public playBrux() {
    if (!this.soundEnabled || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const t = now + i * 0.075;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1350 + Math.random() * 250;
      filter.Q.value = 6;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.04, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(t, Math.random() * 1.2, 0.05);
    }
  }

  /** Gentle bedding rustle */
  public playRustle() {
    if (!this.soundEnabled || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 950 + Math.random() * 450;
    filter.Q.value = 1.4;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.032, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now, Math.random() * 1.1, 0.28);
  }

  /** Cute soft nibbling / crunching sound */
  public playNibble() {
    if (!this.soundEnabled || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.11;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1600;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.045, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(t, Math.random() * 1.2, 0.07);
    }
  }

  /** Water bottle ball-bearing click */
  public playDrink() {
    if (!this.soundEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.16;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(840 + i * 90, t);
      osc.frequency.exponentialRampToValueAtTime(520, t + 0.04);
      gain.gain.setValueAtTime(0.03, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.06);
    }
  }

  /** Soft warm UI click */
  public playClick() {
    if (!this.soundEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(340, now + 0.045);
    gain.gain.setValueAtTime(0.04, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  /** Pleasant coin / reward chime */
  public playCoin() {
    if (!this.soundEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [880, 1174.66];
    notes.forEach((f, idx) => {
      if (!this.ctx) return;
      const t = now + idx * 0.075;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.26);
    });
  }

  /** Quest / trick mastered celebration jingle */
  public playSuccess() {
    if (!this.soundEnabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, idx) => {
      if (!this.ctx) return;
      const t = now + idx * 0.085;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t);
      gain.gain.setValueAtTime(0.055, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  }

  /** Crisp camera shutter click */
  public playShutter() {
    if (!this.soundEnabled || !this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2600;
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(now, 0, 0.09);
  }
}

export const soundEngine = new SoundEngine();
