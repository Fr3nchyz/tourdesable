// ============================================================================
// tour-de-sable — procedural audio (WebAudio synthesis, no asset files)
//  - clink(): high-pitched metallic marble collision
//  - ocean(): swelling filtered-noise loop for the rogue-wave warning
// Lazy-initialised on the first user gesture (browser autoplay policy).
// ============================================================================

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private oceanGain: GainNode | null = null;
  private oceanSrc: AudioBufferSourceNode | null = null;
  private muted = false;

  /** Must be called from a user gesture to satisfy autoplay policies. */
  resume(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (m) this.stopOcean();
  }

  /** Short metallic "clink" — two detuned partials with a fast decay. */
  clink(intensity = 1): void {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    const vol = Math.min(0.5, 0.18 + intensity * 0.22);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    gain.connect(this.ctx.destination);

    for (const [freq, type] of [
      [2100, "triangle"],
      [3300, "square"],
    ] as const) {
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.15);
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 0.2);
    }
  }

  /** Soft low "thud" when a marble is deflected by a berm bank. */
  thud(): void {
    if (this.muted || !this.ctx) return;
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    gain.connect(this.ctx.destination);
    const osc = this.ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.2);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.24);
  }

  /** Start the swelling ocean loop (rogue-wave warning). */
  startOcean(): void {
    if (this.muted || !this.ctx || this.oceanSrc) return;
    const ctx = this.ctx;

    // 2s of brown-ish noise, looped.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 1.0);

    src.connect(lp);
    lp.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    this.oceanSrc = src;
    this.oceanGain = gain;
  }

  /** Fade out + stop the ocean loop. */
  stopOcean(): void {
    if (!this.ctx || !this.oceanSrc || !this.oceanGain) return;
    const t = this.ctx.currentTime;
    this.oceanGain.gain.cancelScheduledValues(t);
    this.oceanGain.gain.setValueAtTime(this.oceanGain.gain.value, t);
    this.oceanGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    const src = this.oceanSrc;
    src.stop(t + 0.7);
    this.oceanSrc = null;
    this.oceanGain = null;
  }
}

/** Singleton — one audio engine for the app. */
export const audio = new AudioEngine();
