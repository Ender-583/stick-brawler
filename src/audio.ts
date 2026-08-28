export class AudioBus {
  muted = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;

  unlock(): void {
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 1;
    return this.muted;
  }

  punch(): void {
    this.blip(140, 90, 0.08, "square", 0.07);
    this.noise(0.04, 0.12, 900);
  }

  swing(): void {
    this.sweep(420, 180, 0.1, "sawtooth", 0.05);
  }

  gun(heavy = false): void {
    this.noise(heavy ? 0.09 : 0.05, heavy ? 0.22 : 0.14, heavy ? 600 : 1400);
    this.blip(heavy ? 90 : 160, 50, heavy ? 0.1 : 0.06, "square", heavy ? 0.1 : 0.06);
  }

  rocket(): void {
    this.sweep(90, 40, 0.18, "sawtooth", 0.08);
    this.noise(0.12, 0.2, 400);
  }

  explode(): void {
    this.noise(0.22, 0.45, 300);
    this.blip(70, 30, 0.16, "triangle", 0.12);
  }

  pickup(): void {
    this.blip(520, 880, 0.08, "square", 0.05);
  }

  spawn(): void {
    this.blip(660, 1200, 0.12, "triangle", 0.04);
  }

  hit(): void {
    this.noise(0.05, 0.18, 800);
    this.blip(200, 90, 0.07, "square", 0.06);
  }

  death(): void {
    this.sweep(220, 50, 0.28, "sawtooth", 0.08);
  }

  jump(): void {
    this.blip(240, 420, 0.07, "square", 0.04);
  }

  win(): void {
    this.blip(440, 660, 0.12, "triangle", 0.06);
    this.later(90, () => this.blip(660, 880, 0.14, "triangle", 0.06));
  }

  tick(): void {
    this.blip(880, 880, 0.06, "square", 0.04);
  }

  fight(): void {
    this.blip(220, 330, 0.16, "square", 0.08);
  }

  banana(): void {
    this.blip(700, 200, 0.14, "sine", 0.06);
  }

  private ensure(): AudioContext {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private dest(): AudioNode {
    this.ensure();
    return this.master!;
  }

  private now(): number {
    return this.ensure().currentTime;
  }

  private blip(from: number, to: number, dur: number, type: OscillatorType, gain: number): void {
    if (this.muted) return;
    const ctx = this.ensure();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, this.now());
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), this.now() + dur);
    g.gain.setValueAtTime(gain, this.now());
    g.gain.exponentialRampToValueAtTime(0.001, this.now() + dur);
    osc.connect(g);
    g.connect(this.dest());
    osc.start();
    osc.stop(this.now() + dur + 0.02);
  }

  private sweep(from: number, to: number, dur: number, type: OscillatorType, gain: number): void {
    this.blip(from, to, dur, type, gain);
  }

  private noise(dur: number, gain: number, cutoff: number): void {
    if (this.muted) return;
    const ctx = this.ensure();
    const size = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, this.now());
    g.gain.exponentialRampToValueAtTime(0.001, this.now() + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.dest());
    src.start();
  }

  private later(ms: number, fn: () => void): void {
    window.setTimeout(fn, ms);
  }
}
