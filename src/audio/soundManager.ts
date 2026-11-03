export type GameAudioEvent =
  | "player-step"
  | "verity-step"
  | "verity-alert"
  | "verity-search"
  | "key"
  | "battery"
  | "flashlight"
  | "hide"
  | "note"
  | "door"
  | "valve"
  | "anchor-break"
  | "lava"
  | "terminal"
  | "elevator"
  | "weapon-fire"
  | "boss-hit"
  | "boss-defeat"
  | "caught";

export class SoundManager {
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private ambientStarted = false;
  private muted = false;

  async resume(): Promise<void> {
    const context = this.ensureContext();
    if (context.state === "suspended") await context.resume();
    if (!this.ambientStarted) this.startAmbient(context);
  }

  async pause(): Promise<void> {
    if (this.context?.state === "running") await this.context.suspend();
  }

  play(event: GameAudioEvent): void {
    const context = this.context;
    if (!context || context.state !== "running" || !this.output) return;

    if (event === "player-step") this.noiseHit(context, 0.055, 620, 0.025);
    if (event === "verity-step") this.tone(context, 58, 0.11, 0.035, "triangle", 42);
    if (event === "verity-alert") this.alert(context);
    if (event === "verity-search") this.tone(context, 118, 0.16, 0.025, "sine", 82);
    if (event === "key") this.keyChime(context);
    if (event === "battery") this.batteryChime(context);
    if (event === "flashlight") this.tone(context, 190, 0.08, 0.018, "square", 145);
    if (event === "hide") this.noiseHit(context, 0.12, 480, 0.028);
    if (event === "note") this.noiseHit(context, 0.16, 2400, 0.04);
    if (event === "door") this.tone(context, 47, 0.45, 0.055, "sawtooth", 31);
    if (event === "valve") {
      this.tone(context, 92, 0.35, 0.045, "square", 48);
      this.noiseHit(context, 0.28, 520, 0.035);
    }
    if (event === "anchor-break") {
      this.tone(context, 145, 0.16, 0.07, "square", 58);
      this.noiseHit(context, 0.34, 1750, 0.075);
      window.setTimeout(() => this.noiseHit(context, 0.18, 900, 0.045), 70);
    }
    if (event === "lava") {
      this.noiseHit(context, 0.52, 1350, 0.085);
      this.tone(context, 82, 0.48, 0.035, "sawtooth", 45);
    }
    if (event === "terminal") {
      this.tone(context, 260, 0.12, 0.04, "square", 390);
      window.setTimeout(() => this.tone(context, 520, 0.2, 0.035, "triangle", 690), 90);
    }
    if (event === "elevator") {
      this.tone(context, 55, 0.7, 0.055, "sawtooth", 34);
      window.setTimeout(() => this.tone(context, 330, 0.22, 0.035, "triangle", 440), 360);
    }
    if (event === "weapon-fire") {
      this.tone(context, 620, 0.14, 0.065, "sawtooth", 155);
      this.noiseHit(context, 0.1, 2400, 0.035);
    }
    if (event === "boss-hit") {
      this.tone(context, 175, 0.2, 0.07, "square", 72);
      this.noiseHit(context, 0.18, 1150, 0.055);
    }
    if (event === "boss-defeat") {
      this.noiseHit(context, 0.7, 1850, 0.12);
      this.tone(context, 185, 0.9, 0.09, "sawtooth", 36);
      window.setTimeout(() => this.tone(context, 440, 0.45, 0.055, "triangle", 880), 420);
    }
    if (event === "caught") this.caughtSting(context);
  }

  toggleMuted(): boolean {
    this.muted = !this.muted;
    if (this.output && this.context) {
      this.output.gain.setTargetAtTime(this.muted ? 0 : 0.72, this.context.currentTime, 0.025);
    }
    return this.muted;
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;

    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) throw new Error("Web Audio API is not supported");
    const context = new AudioContextConstructor();
    const output = context.createGain();
    output.gain.value = this.muted ? 0 : 0.72;
    output.connect(context.destination);
    this.context = context;
    this.output = output;
    return context;
  }

  private startAmbient(context: AudioContext): void {
    if (!this.output) return;
    const ambientGain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 105;
    ambientGain.gain.value = 0.022;
    filter.connect(ambientGain);
    ambientGain.connect(this.output);

    for (const frequency of [43, 57]) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      oscillator.detune.value = frequency === 57 ? -9 : 7;
      oscillator.connect(filter);
      oscillator.start();
    }
    this.ambientStarted = true;
  }

  private noiseHit(context: AudioContext, duration: number, cutoff: number, volume: number): void {
    if (!this.output) return;
    const frameCount = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, frameCount, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      const envelope = 1 - index / samples.length;
      samples[index] = (Math.random() * 2 - 1) * envelope;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.output);
    source.start();
  }

  private tone(
    context: AudioContext,
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    endFrequency: number,
  ): void {
    if (!this.output) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, context.currentTime + duration);
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(this.output);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  private alert(context: AudioContext): void {
    this.tone(context, 210, 0.42, 0.07, "sawtooth", 72);
    this.tone(context, 156, 0.5, 0.045, "square", 54);
  }

  private keyChime(context: AudioContext): void {
    this.tone(context, 440, 0.2, 0.05, "triangle", 660);
    window.setTimeout(() => this.tone(context, 660, 0.28, 0.04, "triangle", 880), 95);
  }

  private batteryChime(context: AudioContext): void {
    this.tone(context, 330, 0.16, 0.04, "triangle", 440);
    window.setTimeout(() => this.tone(context, 440, 0.22, 0.035, "triangle", 550), 85);
  }

  private caughtSting(context: AudioContext): void {
    this.noiseHit(context, 0.38, 1800, 0.11);
    this.tone(context, 130, 0.65, 0.09, "sawtooth", 38);
  }
}

