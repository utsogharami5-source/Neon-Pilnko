export class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  async ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.3; // Master volume
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  // Small metallic tick when hitting a peg
  playPegHit() {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // High pitch sine wave for "glass/neon" feel
    osc.type = 'sine';
    // Randomize pitch slightly 1200-1600Hz for organic feel
    osc.frequency.setValueAtTime(1200 + Math.random() * 400, t);
    
    // Very short envelope
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Whoosh/Thump when ball drops
  playDrop() {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.3);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.3);
  }

  // Landing sound. Pitch scales with multiplier value
  playWin(multiplier: number) {
    if (!this.ctx || !this.masterGain) return;

    const t = this.ctx.currentTime;
    
    // Determine if it's a "good" win or a "loss" (loss usually < 1x)
    const isWin = multiplier >= 1;
    
    // Base frequency increases with multiplier
    const baseFreq = isWin ? 400 + (multiplier * 20) : 150;
    const duration = isWin ? 0.5 : 0.3;
    const type = isWin ? 'triangle' : 'sine';

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type as OscillatorType;
    osc.frequency.setValueAtTime(baseFreq, t);
    
    if (isWin && multiplier > 2) {
        // Arpeggio slide effect for big wins
        osc.frequency.linearRampToValueAtTime(baseFreq * 1.5, t + 0.1);
    } else if (!isWin) {
        // Pitch down for loss
        osc.frequency.linearRampToValueAtTime(baseFreq * 0.8, t + 0.2);
    }

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(isWin ? 0.4 : 0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + duration);
  }
}

export const soundManager = new SoundManager();