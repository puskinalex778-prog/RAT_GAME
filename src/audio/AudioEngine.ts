import { bus } from '../store/bus';
import { useGame } from '../store/gameStore';

/**
 * Полностью синтезированный звук (Web Audio API): тихое попискивание, шуршание,
 * грызение, бруксизм, капли воды, монетки и мягкий уютный эмбиент.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noiseBuf!: AudioBuffer;
  private ambientTimer: number | null = null;
  private started = false;
  private lastPlay = new Map<string, number>();

  constructor() {
    bus.on('sound', ({ name }) => this.play(name));
    useGame.subscribe((s) => this.applyVolumes(s.settings.music, s.settings.sfx));
    const unlock = () => {
      this.ensure();
      window.removeEventListener('pointerdown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) void this.ctx.suspend();
      else void this.ctx.resume();
    });
  }

  private ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.music = this.ctx.createGain();
    this.sfx.connect(this.master);
    this.music.connect(this.master);
    const s = useGame.getState().settings;
    this.applyVolumes(s.music, s.sfx);
    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbient();
  }

  private applyVolumes(music: number, sfx: number) {
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(music * 0.35, this.ctx.currentTime, 0.2);
    this.sfx.gain.setTargetAtTime(sfx * 0.8, this.ctx.currentTime, 0.05);
  }

  private noise(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass', when = 0) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 1.0);
    src.stop(t + dur + 0.05);
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', when = 0, slideTo?: number) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name: string) {
    this.ensure();
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = performance.now();
    const minGap: Record<string, number> = { squeak: 400, chew: 600, rustle: 300, brux: 120, drink: 500, wheel: 1000 };
    if ((now - (this.lastPlay.get(name) ?? 0)) < (minGap[name] ?? 40)) return;
    this.lastPlay.set(name, now);
    switch (name) {
      case 'squeak': {
        // тихий короткий писк с FM-вибрато
        const c = this.ctx;
        const t = c.currentTime;
        const n = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
          const o = c.createOscillator();
          const lfo = c.createOscillator();
          const lg = c.createGain();
          lfo.frequency.value = 38 + Math.random() * 20;
          lg.gain.value = 260;
          lfo.connect(lg).connect(o.frequency);
          const f0 = 3600 + Math.random() * 1600;
          const st = t + i * 0.13;
          o.frequency.setValueAtTime(f0, st);
          o.frequency.linearRampToValueAtTime(f0 * (0.85 + Math.random() * 0.3), st + 0.08);
          const g = c.createGain();
          g.gain.setValueAtTime(0, st);
          g.gain.linearRampToValueAtTime(0.035, st + 0.012);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.09);
          o.connect(g).connect(this.sfx);
          o.start(st);
          lfo.start(st);
          o.stop(st + 0.12);
          lfo.stop(st + 0.12);
        }
        break;
      }
      case 'chew':
        for (let i = 0; i < 9; i++) this.noise(0.04, 2400 + Math.random() * 1500, 3, 0.12, 'bandpass', i * 0.11 + Math.random() * 0.04);
        break;
      case 'brux':
        for (let i = 0; i < 6; i++) this.noise(0.018, 3800, 6, 0.08, 'bandpass', i * 0.045);
        break;
      case 'rustle':
        for (let i = 0; i < 4; i++) this.noise(0.12 + Math.random() * 0.1, 5000 + Math.random() * 2000, 0.8, 0.07, 'highpass', i * 0.08);
        break;
      case 'drink':
        for (let i = 0; i < 4; i++) this.tone(900 + Math.random() * 400, 0.06, 0.05, 'sine', i * 0.18, 1600);
        break;
      case 'wheel':
        for (let i = 0; i < 10; i++) this.noise(0.03, 1200, 4, 0.04, 'bandpass', i * 0.16);
        break;
      case 'pop':
        this.tone(520, 0.08, 0.08, 'triangle', 0, 900);
        break;
      case 'coin':
        this.tone(1318, 0.12, 0.08, 'triangle');
        this.tone(1760, 0.22, 0.07, 'triangle', 0.07);
        break;
      case 'quest':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.35, 0.06, 'sine', i * 0.09));
        break;
      case 'achievement':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.5, 0.06, 'triangle', i * 0.08));
        break;
      case 'buy':
        this.tone(880, 0.1, 0.07, 'triangle');
        this.tone(1320, 0.18, 0.06, 'triangle', 0.06);
        break;
      case 'click':
        this.tone(1400, 0.035, 0.04, 'sine');
        break;
      case 'shutter':
        this.noise(0.05, 3000, 1, 0.25, 'highpass');
        this.noise(0.08, 1800, 1, 0.18, 'bandpass', 0.07);
        break;
      case 'place':
        this.tone(420, 0.12, 0.08, 'sine', 0, 300);
        this.noise(0.08, 900, 1, 0.05, 'lowpass');
        break;
    }
  }

  /** Мягкий эмбиент: тёплые аккорды-пэды и редкие ноты «музыкальной шкатулки» */
  private startAmbient() {
    const c = this.ctx!;
    const chords = [
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 329.63],
      [196.0, 246.94, 293.66, 392.0],
    ];
    const box = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    let ci = 0;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.connect(this.music);
    const playChord = () => {
      if (!this.ctx) return;
      const t = c.currentTime;
      const notes = chords[ci % chords.length];
      ci++;
      for (const f of notes) {
        for (const det of [-4, 4]) {
          const o = c.createOscillator();
          o.type = 'triangle';
          o.frequency.value = f / 2;
          o.detune.value = det;
          const g = c.createGain();
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.03, t + 2.5);
          g.gain.linearRampToValueAtTime(0.025, t + 6);
          g.gain.linearRampToValueAtTime(0, t + 8.5);
          o.connect(g).connect(lp);
          o.start(t);
          o.stop(t + 8.6);
        }
      }
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.7) {
          const f = box[Math.floor(Math.random() * box.length)];
          const st = t + 1 + i * 2 + Math.random();
          const o = c.createOscillator();
          o.type = 'sine';
          o.frequency.value = f;
          const g = c.createGain();
          g.gain.setValueAtTime(0, st);
          g.gain.linearRampToValueAtTime(0.03, st + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 1.6);
          o.connect(g).connect(this.music);
          o.start(st);
          o.stop(st + 1.7);
        }
      }
    };
    playChord();
    this.ambientTimer = window.setInterval(playChord, 8000);
    this.started = true;
  }

  get isStarted() {
    return this.started;
  }

  dispose() {
    if (this.ambientTimer) clearInterval(this.ambientTimer);
    void this.ctx?.close();
  }
}
