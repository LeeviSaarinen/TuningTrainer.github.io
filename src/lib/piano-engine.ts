import * as Tone from 'tone';

export interface PianoNote {
  midi: number;
  frequency: number;
  detune: number; // in cents
}

export class PianoEngine {
  private voices: Map<number, any> = new Map();
  private inharmonicity: number = 0.0003;
  private volumeNode: Tone.Volume;
  private limiter: Tone.Limiter;
  private compressor: Tone.Compressor;
  private decayTime: number = 4;
  private partialStrength: number = 1.0; 
  private metronomeSynth: Tone.Synth | null = null;
  private metronomeLoop: Tone.Loop | null = null;
  private metronomePitch: number = 440;
  private maxPolyphony: number = 10;

  constructor() {
    this.limiter = new Tone.Limiter(-1).toDestination();
    this.compressor = new Tone.Compressor({
      threshold: -24,
      ratio: 4,
      attack: 0.01,
      release: 0.1
    }).connect(this.limiter);
    this.volumeNode = new Tone.Volume(-12).connect(this.compressor);
  }

  getPartialFrequency(fundamental: number, n: number): number {
    if (isNaN(fundamental) || isNaN(n)) return 440;
    const B = isNaN(this.inharmonicity) ? 0 : this.inharmonicity;
    const stretch = Math.sqrt(1 + B * (n * n - 1));
    return n * fundamental * stretch;
  }

  getStretchRatio(): number {
    const B = isNaN(this.inharmonicity) ? 0 : this.inharmonicity;
    return Math.sqrt(1 + 3 * B);
  }

  getStretchedFrequency(midi: number, detuneCents: number = 0): number {
    if (isNaN(midi)) return 440;
    const semitonesFromA4 = midi - 69;
    const stretchRatio = this.getStretchRatio();
    const baseFreq = 440 * Math.pow(2 * stretchRatio, semitonesFromA4 / 12);
    if (isNaN(baseFreq)) return 440;
    return baseFreq * Math.pow(2, (isNaN(detuneCents) ? 0 : detuneCents) / 1200);
  }

  setInharmonicity(val: number) {
    this.inharmonicity = val;
  }

  updateDetune(midi: number, stringIndex: number, detuneCents: number) {
    const voice = this.voices.get(midi);
    if (voice && voice.stringOscs && voice.activeStringIndices) {
      const fundamental = this.getStretchedFrequency(midi, detuneCents);
      if (isNaN(fundamental)) return;
      
      const internalIdx = voice.activeStringIndices.indexOf(stringIndex);
      if (internalIdx === -1) return;

      const oscs = voice.stringOscs[internalIdx];
      if (oscs) {
        oscs.forEach((osc, i) => {
          if (osc && osc.frequency) {
            const n = i + 1;
            const partialFreq = this.getPartialFrequency(fundamental, n);
            if (!isNaN(partialFreq) && isFinite(partialFreq)) {
              osc.frequency.rampTo(partialFreq, 0.05);
            }
          }
        });
      }
    }
  }

  async init() {
    await Tone.start();
  }

  startMetronome(beatFrequency: number, pitchFrequency: number) {
    this.stopMetronome();
    if (isNaN(beatFrequency) || isNaN(pitchFrequency) || beatFrequency <= 0.05 || !isFinite(beatFrequency)) return;
    this.metronomePitch = pitchFrequency;

    this.metronomeSynth = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
      volume: -20
    }).connect(this.volumeNode);

    this.metronomeLoop = new Tone.Loop((time) => {
      if (this.metronomeSynth && !isNaN(this.metronomePitch)) {
        this.metronomeSynth.triggerAttackRelease(this.metronomePitch, "64n", time);
      }
    }, 1 / beatFrequency).start(0);
    
    if (Tone.Transport.state !== "started") {
      Tone.Transport.start();
    }
  }

  updateMetronome(beatFrequency: number, pitchFrequency: number) {
    if (!this.metronomeLoop || !this.metronomeSynth) {
      this.startMetronome(beatFrequency, pitchFrequency);
      return;
    }
    if (isNaN(beatFrequency) || isNaN(pitchFrequency) || beatFrequency <= 0.05 || !isFinite(beatFrequency)) {
      this.stopMetronome();
      return;
    }
    this.metronomePitch = pitchFrequency;
    this.metronomeLoop.interval = 1 / beatFrequency;
  }

  stopMetronome() {
    if (this.metronomeLoop) {
      this.metronomeLoop.stop();
      this.metronomeLoop.dispose();
      this.metronomeLoop = null;
    }
    if (this.metronomeSynth) {
      this.metronomeSynth.dispose();
      this.metronomeSynth = null;
    }
  }

  playNote(midi: number, detunes: number[], accentedPartial: number | null = null, activeStringIndices?: number[]) {
    const now = Tone.now();
    
    // Polyphony management
    if (this.voices.size >= this.maxPolyphony) {
      const oldestMidi = this.voices.keys().next().value;
      if (oldestMidi !== undefined) this.stopNote(oldestMidi, 0.1);
    }

    // Each voice has its own master gain for the envelope
    const voiceGain = new Tone.Gain(1).connect(this.volumeNode);
    
    // Hammer thump
    const thump = new Tone.Noise("pink").start(now);
    const thumpFilter = new Tone.Filter(150, "lowpass").connect(voiceGain);
    const thumpEnv = new Tone.AmplitudeEnvelope({
      attack: 0.001,
      decay: 0.04,
      sustain: 0,
    }).connect(thumpFilter);
    thump.connect(thumpEnv);
    thumpEnv.triggerAttack(now);

    const oscillators: any[] = [voiceGain, thump, thumpEnv, thumpFilter];
    const stringOscs: Tone.Oscillator[][] = [];
    const stringsToPlay = activeStringIndices || detunes.map((_, i) => i);
    
    stringsToPlay.forEach((stringIdx, i) => {
      const stringDelay = i * 0.0015;
      const currentStringOscs: Tone.Oscillator[] = [];
      const panValue = stringIdx === 0 ? -0.3 : stringIdx === 2 ? 0.3 : 0;
      const panner = new Tone.Panner(panValue).connect(voiceGain);
      oscillators.push(panner);

      const detuneCents = detunes[stringIdx] || 0;
      const fundamental = this.getStretchedFrequency(midi, detuneCents);
      
      // We sum partials per string to prevent overloading the destination gain stage
      const stringGain = new Tone.Gain(1 / stringsToPlay.length).connect(panner);
      oscillators.push(stringGain);

      for (let n = 1; n <= 8; n++) {
        const partialFreq = this.getPartialFrequency(fundamental, n);
        
        // Volume logic for partials
        const baseVolDb = -18 - (n * 4); 
        let finalGain = Tone.dbToGain(baseVolDb);
        
        if (accentedPartial !== null) {
          if (n === accentedPartial) {
            // Strong boost for matching partial, influenced by slider
            finalGain = Tone.dbToGain(baseVolDb + (this.partialStrength * 12));
          } else {
            // Mask others
            finalGain = Tone.dbToGain(baseVolDb - 20);
          }
        } else {
          // Standard play - apply partialStrength as a high-frequency tilt
          if (n > 1) {
            finalGain *= Math.pow(this.partialStrength, 0.8);
          }
        }
        
        const osc = new Tone.Oscillator({
          frequency: partialFreq,
          type: 'sine',
        }).connect(stringGain);
        
        osc.phase = Math.random() * 360;
        osc.start(now + stringDelay);
        oscillators.push(osc);
        currentStringOscs.push(osc);

        // Amplitude envelope for this partial
        const partialDecay = this.decayTime / Math.pow(n, 0.5);
        osc.volume.setValueAtTime(-100, now);
        osc.volume.exponentialRampToValueAtTime(Tone.gainToDb(finalGain), now + stringDelay + 0.005);
        osc.volume.exponentialRampToValueAtTime(-100, now + stringDelay + partialDecay);
      }
      stringOscs.push(currentStringOscs);
    });

    // Master voice envelope
    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.exponentialRampToValueAtTime(1, now + 0.005);
    voiceGain.gain.exponentialRampToValueAtTime(0.001, now + this.decayTime);

    const voice = { oscillators, isStopping: false, activeStringIndices: stringsToPlay, stringOscs, masterGain: voiceGain };
    this.voices.set(midi, voice);
    
    // Cleanup reference
    setTimeout(() => {
      if (this.voices.get(midi) === voice) {
        this.stopNote(midi, 0.5);
      }
    }, (this.decayTime) * 1000);
  }

  private disposeVoice(voice: any) {
    voice.oscillators.forEach((obj: any) => {
      try {
        if (obj.stop) obj.stop();
        if (obj.dispose) obj.dispose();
      } catch (e) {}
    });
  }

  stopNote(midi: number, releaseTime: number = 0.2) {
    const voice = this.voices.get(midi);
    if (voice && !voice.isStopping) {
      voice.isStopping = true;
      const now = Tone.now();
      voice.masterGain.gain.rampTo(0, releaseTime, now);
      this.voices.delete(midi);
      
      setTimeout(() => {
        this.disposeVoice(voice);
      }, (releaseTime + 0.1) * 1000);
    }
  }

  playTuningFork(frequency: number = 440, duration: number = 4) {
    const osc = new Tone.Oscillator(frequency, 'sine').connect(this.volumeNode);
    osc.volume.value = -15;
    osc.start().stop(`+${duration}`);
    osc.volume.rampTo(-100, duration);
    setTimeout(() => osc.dispose(), (duration + 1) * 1000);
  }

  stopAll(releaseTime: number = 0.2) {
    this.voices.forEach((_, midi) => this.stopNote(midi, releaseTime));
  }

  setVolume(val: number) {
    if (isNaN(val)) return;
    this.volumeNode.volume.value = val;
  }

  setDecay(val: number) {
    if (isNaN(val) || val <= 0) return;
    this.decayTime = val;
  }

  setPartialStrength(val: number) {
    if (isNaN(val)) return;
    this.partialStrength = val;
  }
}


export const pianoEngine = new PianoEngine();
