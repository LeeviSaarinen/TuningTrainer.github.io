/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { PianoKeyboard } from '@/components/PianoKeyboard';
import { TuningKnob } from '@/components/TuningKnob';
import { Metronome } from '@/components/Metronome';
import { DocumentationContent } from '@/components/DocumentationContent';
import { pianoEngine } from '@/lib/piano-engine';
import { TEMPERAMENT_SEQUENCE, getNoteName, PIANO_PROFILES, DETUNE_LEVELS, PianoProfile, DetuneLevel, isBlackKey, TuningMode, OctaveSize, OCTAVE_DEFINITIONS, UNISON_OCTAVES } from '@/lib/constants';
import { translations, Language } from '@/lib/translations';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Play, RotateCcw, Check, Music, Timer as TimerIcon, Trophy, Bell, X, Activity, Layers, ChevronRight, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const QUICK_INTERVALS = [
  { id: 'octaves', name: "Octaves", size: 12, roots: [53, 57] },
  { id: 'perfectFifths', name: "Perfect Fifths", size: 7, rootRange: [53, 58] },
  { id: 'perfectFourths', name: "Perfect Fourths", size: 5, rootRange: [53, 60] },
  { id: 'majorThirds', name: "Major Thirds", size: 4, rootRange: [53, 61], extraRoots: [65] },
  { id: 'majorSixths', name: "Major Sixths", size: 9, rootRange: [53, 56] }
];

const OCTAVE_MODE_INTERVALS = [
  { id: 'octaves', name: "Octaves", size: 12 },
  { id: 'octaveMajorThirds', name: "Octave + Major Third", size: 16 },
  { id: 'majorThirds', name: "Major Thirds", size: 4 },
  { id: 'minorThirds', name: "Minor Thirds", size: 3 },
  { id: 'majorSixths', name: "Major Sixths", size: 9 }
];

export default function App() {
  const [isStarted, setIsStarted] = useState(false);
  const [isReferenceMode, setIsReferenceMode] = useState(false);
  const [language, setLanguage] = useState<Language>('fi');
  const [tuningMode, setTuningMode] = useState<TuningMode>('temperament');
  const [octaveSize, setOctaveSize] = useState<OctaveSize>('2:4');
  const [unisonOctave, setUnisonOctave] = useState(UNISON_OCTAVES[3]); // Default C4-C5
  const [octaveDirection, setOctaveDirection] = useState<'up' | 'down'>('up');
  const [octaveReference, setOctaveReference] = useState(UNISON_OCTAVES[3]); // Default C4-C5
  const [tunedKeys, setTunedKeys] = useState<Record<number, number>>({});
  const [unisonDetunes, setUnisonDetunes] = useState<Record<number, number[]>>({});
  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [timer, setTimer] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const [docTab, setDocTab] = useState<'ear' | 'principles'>('ear');
  const [helpEnabled, setHelpEnabled] = useState(false);
  const [metronomeBpm, setMetronomeBpm] = useState(60);
  const [isMetronomePlaying, setIsMetronomePlaying] = useState(false);
  const [volume, setVolume] = useState(-5);
  const [decay, setDecay] = useState(4);
  const [partialStrength, setPartialStrength] = useState(1.0);
  const [pianoProfile, setPianoProfile] = useState<PianoProfile | { id: string, name: string, inharmonicity: number }>({ id: "random", name: "Random", inharmonicity: 0 });
  const [detuneLevel, setDetuneLevel] = useState<DetuneLevel | { id: string, name: string, range: number }>({ id: "random", name: "Random", range: 0 });
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const keyboardStart = tuningMode === 'unison' ? unisonOctave.start : 
                        tuningMode === 'octave' ? Math.max(21, (octaveDirection === 'up' ? octaveReference.start - 5 : octaveReference.start - 12)) : 
                        Math.min(...TEMPERAMENT_SEQUENCE.map(s => s.midi));
  const keyboardEnd = tuningMode === 'unison' ? unisonOctave.end : 
                      tuningMode === 'octave' ? (octaveDirection === 'up' ? octaveReference.end + 12 : octaveReference.end) : 
                      Math.max(...TEMPERAMENT_SEQUENCE.map(s => s.midi));

  // Initialize audio on first interaction
  useEffect(() => {
    setSelectedKeys([]);
  }, [tuningMode]);

  const handleStart = async (isRef: boolean = false) => {
    await pianoEngine.init();
    setIsReferenceMode(isRef);
    
    let activeProfile = pianoProfile as PianoProfile;
    if (pianoProfile.id === "random") {
      activeProfile = PIANO_PROFILES[Math.floor(Math.random() * PIANO_PROFILES.length)];
    }
    
    let activeDetune = detuneLevel as DetuneLevel;
    if (detuneLevel.id === "random") {
      activeDetune = DETUNE_LEVELS[Math.floor(Math.random() * DETUNE_LEVELS.length)];
    }

    pianoEngine.setInharmonicity(activeProfile.inharmonicity);
    pianoEngine.setVolume(volume);
    pianoEngine.setDecay(decay);
    pianoEngine.setPartialStrength(partialStrength);

    // Initial detune for all keys in the whole piano range (21-108)
    const initialTuned: Record<number, number> = {};
    const initialUnisons: Record<number, number[]> = {};
    
    // Randomize all keys 21-108 +/- activeDetune.range (unless in reference mode)
    for (let midi = 21; midi <= 108; midi++) {
      let detune = isRef ? 0 : (Math.random() * 2 - 1) * activeDetune.range;
      
      // Protect reference keys
      if (tuningMode === 'octave') {
        const isReference = midi >= octaveReference.start && midi <= octaveReference.end;
        if (isReference) detune = 0;
      } else if (tuningMode === 'unison') {
        // In unison mode, the center reference string should be perfect
        detune = 0;
      }
      
      initialTuned[midi] = detune;
      
      // For unisons, strings 1 and 3 are slightly out from string 2 (middle)
      // Middle string (index 1) is always correct relative to initial detune
      const s2 = 0; 
      const s1 = isRef ? s2 : s2 + (Math.random() * 2 - 1) * (activeDetune.range / 2);
      const s3 = isRef ? s2 : s2 + (Math.random() * 2 - 1) * (activeDetune.range / 2);
      initialUnisons[midi] = [s1, s2, s3];
    }

    setTunedKeys(initialTuned);
    setUnisonDetunes(initialUnisons);
    setIsStarted(true);
    setTimer(0);
    setCurrentStep(1);
    
    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
  };

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsStarted(false);
    setTunedKeys({});
    setSelectedKeys([]);
    setCurrentStep(0);
    setTimer(0);
    setShowResults(false);
  };

  const handleKeyClick = (midi: number) => {
    if (!isStarted) return;
    
    setSelectedKeys(prev => {
      if (tuningMode === 'unison') {
        if (prev.includes(midi)) return [];
        return [midi];
      }
      
      if (prev.includes(midi)) {
        return prev.filter(k => k !== midi);
      }
      if (prev.length >= 2) {
        return [prev[1], midi];
      }
      return [...prev, midi];
    });
  };

  const strikeKeys = (stringIndices: number[] = [0, 1, 2]) => {
    const sortedKeys = [...selectedKeys].sort((a, b) => a - b);
    const coincident = sortedKeys.length === 2 ? getCoincidentPartials(sortedKeys[0], sortedKeys[1]) : null;

    selectedKeys.forEach(midi => {
      let accentedPartial: number | null = null;
      if (coincident) {
        accentedPartial = midi === sortedKeys[0] ? coincident.p1 : coincident.p2;
      } else if (tuningMode === 'unison') {
        accentedPartial = 1;
      }

      if (tuningMode === 'unison') {
        const detunes = unisonDetunes[midi] || [0, 0, 0];
        pianoEngine.playNote(midi, detunes, accentedPartial, stringIndices);
      } else {
        const detune = tunedKeys[midi] || 0;
        pianoEngine.playNote(midi, [detune], accentedPartial);
      }
    });
  };

  const handleTune = (midi: number, val: number, stringIndex: number = 0) => {
    if (tuningMode === 'octave' && midi >= octaveReference.start && midi <= octaveReference.end) return;
    
    if (tuningMode === 'unison') {
      setUnisonDetunes(prev => {
        const next = { ...prev };
        const current = [...(next[midi] || [0, 0, 0])];
        current[stringIndex] = val;
        next[midi] = current;
        return next;
      });
      pianoEngine.updateDetune(midi, stringIndex, val);
    } else {
      setTunedKeys(prev => ({
        ...prev,
        [midi]: val
      }));
      pianoEngine.updateDetune(midi, 0, val);
    }
  };

  const getCoincidentPartials = (m1: number, m2: number) => {
    const diff = Math.abs(m2 - m1);
    
    if (diff === 12) {
      // Octave Tuning Mode specific sizes
      if (tuningMode === 'octave') {
        const def = OCTAVE_DEFINITIONS.find(d => d.size === octaveSize);
        if (def) return { p1: def.pLower, p2: def.pUpper };
      }
      return { p1: 2, p2: 1 }; // Default Octave (2:1) for pure fundamental match
    }
    
    if (diff === 7) return { p1: 3, p2: 2 };  // Fifth (3:2)
    if (diff === 5) return { p1: 4, p2: 3 };  // Fourth (4:3)
    if (diff === 4) return { p1: 5, p2: 4 };  // Major Third (5:4)
    if (diff === 9) return { p1: 5, p2: 3 };  // Major Sixth (5:3)
    if (diff === 3) return { p1: 6, p2: 5 };  // Minor Third (6:5)
    return { p1: 1, p2: 1 }; // Default
  };

  useEffect(() => {
    if (helpEnabled && selectedKeys.length > 0) {
      if (tuningMode === 'temperament' && selectedKeys.length === 2) {
        const [m1, m2] = [...selectedKeys].sort((a, b) => a - b);
        const { p1, p2 } = getCoincidentPartials(m1, m2);
        
        const f1 = 440 * Math.pow(2, (m1 - 69) / 12);
        const f2 = 440 * Math.pow(2, (m2 - 69) / 12);
        
        const inharmonicity = (pianoProfile as any).inharmonicity ?? 0.0003;
        const getPartial = (f: number, n: number) => n * f * Math.sqrt(1 + inharmonicity * (n * n - 1));
        
        const freq1 = getPartial(f1, p1);
        const freq2 = getPartial(f2, p2);
        
        const beatFreq = Math.abs(freq1 - freq2);
        const pitchFreq = (freq1 + freq2) / 2;
        
        if (!isNaN(beatFreq) && beatFreq > 0.05 && !isNaN(pitchFreq)) {
          pianoEngine.updateMetronome(beatFreq, pitchFreq);
        } else {
          pianoEngine.stopMetronome();
        }
      } else {
        pianoEngine.stopMetronome();
      }
    } else if (isMetronomePlaying && tuningMode === 'temperament') {
      pianoEngine.updateMetronome(metronomeBpm / 60, 880);
    } else {
      pianoEngine.stopMetronome();
    }
    return () => pianoEngine.stopMetronome();
  }, [helpEnabled, selectedKeys, tuningMode, unisonDetunes, octaveSize, pianoProfile, isMetronomePlaying, metronomeBpm]);

  const finishGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setShowResults(true);
  };

  const calculateScore = () => {
    const getWeight = (err: number) => {
      const absError = Math.abs(err);
      if (absError <= 0.5) return 100;
      if (absError <= 1.5) return 80;
      if (absError <= 10.0) return 50 * (1 - (absError - 1.5) / 8.5);
      return 0;
    };

    if (tuningMode === 'unison') {
      let totalWeight = 0;
      let count = 0;
      const range = Array.from({ length: unisonOctave.end - unisonOctave.start + 1 }, (_, i) => unisonOctave.start + i);
      range.forEach(midi => {
        const detunes = unisonDetunes[midi] || [0, 0, 0];
        totalWeight += getWeight(detunes[0] - detunes[1]);
        totalWeight += getWeight(detunes[2] - detunes[1]);
        count += 2;
      });
      return count === 0 ? 100 : Math.round(totalWeight / count);
    }
    
    if (tuningMode === 'octave') {
      const targetStart = octaveDirection === 'up' ? octaveReference.start + 12 : octaveReference.start - 12;
      const targetRange = Array.from({ length: 13 }, (_, i) => targetStart + i);
      
      let totalWeight = 0;
      targetRange.forEach(midi => {
        totalWeight += getWeight(tunedKeys[midi] || 0);
      });
      
      return Math.round(totalWeight / targetRange.length);
    }
    
    let totalWeight = 0;
    TEMPERAMENT_SEQUENCE.forEach(step => {
      const tuned = tunedKeys[step.midi] || 0;
      totalWeight += getWeight(tuned - step.target);
    });
    return Math.round(totalWeight / TEMPERAMENT_SEQUENCE.length);
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const t = translations[language];

  return (
    <div className="min-h-screen bg-background font-sans text-foreground flex flex-col">
      <main className="flex-1 p-2 md:p-10 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-3 md:space-y-6">
          {/* Header */}
          <header className="flex flex-row justify-between items-center mb-2 md:mb-10 gap-2">
            <div>
              <div className="flex items-center gap-1.5 md:gap-3">
                <h2 className="text-base md:text-3xl font-bold tracking-tight">{t.title}</h2>
                {isReferenceMode && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 uppercase text-[7px] md:text-[10px] font-bold tracking-widest hidden sm:inline-flex">
                    {t.referenceMode}
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-[9px] md:text-sm hidden sm:block">{t.subtitle}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setLanguage('en')}
                  className={cn(
                    "w-6 h-4 md:w-8 md:h-6 rounded overflow-hidden border transition-all",
                    language === 'en' ? "border-primary ring-2 ring-primary/20" : "border-transparent opacity-50 grayscale hover:grayscale-0 hover:opacity-100"
                  )}
                >
                  <img src="https://flagcdn.com/gb.svg" alt="UK Flag" className="w-full h-full object-cover" />
                </button>
                <button 
                  onClick={() => setLanguage('fi')}
                  className={cn(
                    "w-6 h-4 md:w-8 md:h-6 rounded overflow-hidden border transition-all",
                    language === 'fi' ? "border-primary ring-2 ring-primary/20" : "border-transparent opacity-50 grayscale hover:grayscale-0 hover:opacity-100"
                  )}
                >
                  <img src="https://flagcdn.com/fi.svg" alt="Finland Flag" className="w-full h-full object-cover" />
                </button>
              </div>
              {isStarted && (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center gap-1.5 bg-white px-2 py-1 md:px-4 md:py-2 rounded-lg shadow-sm border border-border">
                    <TimerIcon className="w-3 h-3 text-primary" />
                    <span className="font-mono font-bold text-xs md:text-base text-primary">{formatTime(timer)}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={handleReset}
                    className="text-muted-foreground hover:text-red-500 w-8 h-8 md:w-10 md:h-10"
                    title={t.mainMenu}
                  >
                    <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  </Button>
                </div>
              )}
            </div>
          </header>

        {!isStarted ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto text-center space-y-12">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight uppercase">{t.pianoSuite}</h1>
              <p className="text-muted-foreground text-sm font-mono uppercase tracking-widest">{t.professionalEnv}</p>
            </motion.div>

            <div className="w-full space-y-10">
              {/* Mode Selection */}
              <div className="space-y-4">
                <div className="flex justify-center gap-6">
                  {[
                    { 
                      id: 'temperament', 
                      name: 'Temperament', 
                      icon: (props: any) => (
                        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2v20M12 2l4 4M12 2l-4 4M12 22l4-4M12 22l-4-4" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )
                    },
                    { 
                      id: 'unison', 
                      name: 'Unison', 
                      icon: (props: any) => (
                        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 4v16M12 4v16M16 4v16" />
                        </svg>
                      )
                    },
                    { 
                      id: 'octave', 
                      name: 'Octave', 
                      icon: (props: any) => (
                        <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 10v4M20 10v4M4 12h16M4 8h2M18 8h2M4 16h2M18 16h2" />
                        </svg>
                      )
                    }
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setTuningMode(m.id as TuningMode)}
                      className={cn(
                        "group flex flex-col items-center gap-3 transition-all",
                        tuningMode === m.id ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all",
                        tuningMode === m.id ? "bg-primary/5 border-primary shadow-lg shadow-primary/10" : "bg-white border-border hover:border-muted-foreground/30"
                      )}>
                        <m.icon className="w-7 h-7" />
                      </div>
                    </button>
                  ))}
                </div>
                <p className="text-sm font-bold uppercase tracking-widest text-foreground">
                  {tuningMode === 'temperament' ? t.temperamentMode : tuningMode === 'unison' ? t.unisonMode : t.octaveMode}
                </p>

                {tuningMode === 'unison' && (
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t.octaves}</label>
                    <select
                      value={unisonOctave.label}
                      onChange={(e) => {
                        const oct = UNISON_OCTAVES.find(o => o.label === e.target.value);
                        if (oct) setUnisonOctave(oct);
                      }}
                      className="bg-white border border-border rounded-lg px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer hover:border-muted-foreground/30 transition-all appearance-none pr-8 relative"
                      style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%236b7280\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'%3E%3C/path%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1.5em 1.5em' }}
                    >
                      {UNISON_OCTAVES.map((oct) => (
                        <option key={oct.label} value={oct.label}>
                          {oct.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {tuningMode === 'octave' && (
                  <div className="mt-4 flex flex-row items-center justify-center gap-2 text-sm font-bold">
                    <span className="text-muted-foreground uppercase text-[10px] tracking-widest">{t.tune}</span>
                    <select
                      value={octaveDirection}
                      onChange={(e) => {
                        const newDir = e.target.value as 'up' | 'down';
                        setOctaveDirection(newDir);
                        const validOptions = UNISON_OCTAVES.filter(oct => {
                          if (newDir === 'up') return oct.start >= 60 && oct.end <= 96;
                          if (newDir === 'down') return oct.end <= 72 && oct.start >= 36;
                          return true;
                        });
                        if (!validOptions.some(o => o.label === octaveReference.label)) {
                          setOctaveReference(UNISON_OCTAVES[3]);
                        }
                      }}
                      className="bg-secondary/30 border border-border rounded-lg px-2 py-1 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary/20 cursor-pointer hover:bg-secondary transition-all"
                    >
                      <option value="up">{t.up}</option>
                      <option value="down">{t.down}</option>
                    </select>
                    <span className="text-muted-foreground uppercase text-[10px] tracking-widest">{t.from}</span>
                    <select
                      value={octaveReference.label}
                      onChange={(e) => {
                        const oct = UNISON_OCTAVES.find(o => o.label === e.target.value);
                        if (oct) setOctaveReference(oct);
                      }}
                      className="bg-secondary/30 border border-border rounded-lg px-2 py-1 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary/20 cursor-pointer hover:bg-secondary transition-all"
                    >
                      {UNISON_OCTAVES.filter(oct => {
                        if (octaveDirection === 'up') return oct.start >= 60 && oct.end <= 96;
                        if (octaveDirection === 'down') return oct.end <= 72 && oct.start >= 36;
                        return true;
                      }).map((oct) => (
                        <option key={oct.label} value={oct.label}>
                          {oct.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Minimal Dropdowns */}
              <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-md mx-auto">
                <div className="flex-1 space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">{t.pianoModel}</label>
                  <select 
                    value={pianoProfile.id}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "random") {
                        setPianoProfile({ id: "random", name: "Random", inharmonicity: 0 });
                      } else {
                        const profile = PIANO_PROFILES.find(p => p.id === val);
                        if (profile) setPianoProfile(profile);
                      }
                    }}
                    className="w-full bg-white border border-border rounded-xl px-4 h-11 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="random">{t.random}</option>
                    {PIANO_PROFILES.map(p => (
                      <option key={p.id} value={p.id}>{t[p.id as keyof typeof t] || p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="flex-1 space-y-1.5 text-left">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">{t.initialCondition}</label>
                  <select 
                    value={detuneLevel.id}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "random") {
                        setDetuneLevel({ id: "random", name: "Random", range: 0 });
                      } else {
                        const level = DETUNE_LEVELS.find(l => l.id === val);
                        if (level) setDetuneLevel(level);
                      }
                    }}
                    className="w-full bg-white border border-border rounded-xl px-4 h-11 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="random">{t.random}</option>
                    {DETUNE_LEVELS.map(l => (
                      <option key={l.id} value={l.id}>{t[l.id as keyof typeof t] || l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    onClick={() => handleStart(false)} 
                    className="bg-primary hover:bg-primary/90 text-white font-bold h-14 px-12 text-lg rounded-2xl shadow-lg shadow-primary/20 uppercase tracking-tight transition-all hover:scale-105 active:scale-95"
                  >
                    <Play className="mr-3 w-6 h-6 fill-current" /> {t.startSession}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => handleStart(true)} 
                    className="border-primary/20 hover:bg-primary/5 text-primary font-bold h-14 px-8 text-lg rounded-2xl uppercase tracking-tight transition-all"
                  >
                    <Layers className="mr-3 w-6 h-6" /> {t.referencePiano}
                  </Button>
                </div>

                <div className="pt-8 border-t border-border/50 max-w-xs mx-auto">
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowDocumentation(true)}
                    className="w-full text-muted-foreground hover:text-primary transition-colors text-[10px] uppercase tracking-widest font-bold"
                  >
                    <BookOpen className="w-3.5 h-3.5 mr-2" /> {t.documentation}
                  </Button>
                </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Main Workbench Container */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-3 md:p-6 shadow-sm border border-border w-full flex flex-col gap-4 overflow-hidden">
              
              {/* Row 1: Top Bar (Guide, Metronome, Fork) - Very Compact */}
              {tuningMode === 'temperament' && (
                <div className="flex items-center justify-between gap-1 border-b border-border pb-3">
                  <div className="flex items-center gap-1 md:gap-2 flex-grow min-w-0">
                    <div className="flex items-center gap-1 md:gap-2 bg-secondary/30 px-1.5 md:px-3 h-9 md:h-10 rounded-lg md:rounded-xl border border-border shrink-0">
                      <span className="text-[7px] md:text-[10px] font-bold text-muted-foreground uppercase">{t.guide}</span>
                      <Switch checked={helpEnabled} onCheckedChange={setHelpEnabled} className="scale-[0.55] md:scale-75" />
                    </div>
                    <Metronome 
                      bpm={metronomeBpm} 
                      setBpm={setMetronomeBpm} 
                      isPlaying={isMetronomePlaying} 
                      setIsPlaying={setIsMetronomePlaying} 
                      label={t.metronome}
                      className="h-9 md:h-10 border-border bg-secondary/30 min-w-0 flex-shrink"
                    />
                  </div>
                  <Button 
                    variant="outline"
                    size="sm" 
                    onClick={() => pianoEngine.playTuningFork(440)}
                    className="bg-white border-border text-foreground hover:bg-secondary h-9 md:h-10 px-1.5 md:px-4 text-[8px] md:text-[10px] font-bold uppercase tracking-tight md:tracking-widest rounded-lg md:rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-1 md:gap-2 shrink-0"
                  >
                    <Bell className="w-2.5 h-2.5 md:w-3 md:h-3 text-primary" /> 
                    <span className="hidden xs:inline sm:inline">{t.tuningFork}</span>
                    <span className="xs:hidden">440Hz</span>
                  </Button>
                </div>
              )}

              {/* Row 2: Keyboard + Strike Buttons + Selection Toggle (Unison/Octave) */}
              <div className="space-y-3">
                <div className="flex flex-col lg:flex-row items-center gap-3">
                  <div className="flex-1 w-full">
                    <PianoKeyboard 
                      startMidi={keyboardStart} 
                      endMidi={keyboardEnd} 
                      selectedKeys={selectedKeys}
                      validMidis={tuningMode === 'temperament' ? TEMPERAMENT_SEQUENCE.map(s => s.midi) : undefined}
                      referenceKeys={
                        tuningMode === 'unison' ? [] : 
                        tuningMode === 'octave' ? (() => {
                          const startOffset = octaveDirection === 'up' ? 5 : 0;
                          const excludeMidi = octaveDirection === 'up' ? octaveReference.end : octaveReference.start;
                          return Array.from({ length: octaveReference.end - (octaveReference.start - startOffset) + 1 }, (_, i) => (octaveReference.start - startOffset) + i)
                            .filter(k => k !== excludeMidi);
                        })() :
                        []
                      }
                      onKeyClick={handleKeyClick}
                      className="pb-2"
                    />
                  </div>
                  
                  {/* Strike Action Buttons - Positioned next to keyboard on LG+, below beneath */}
                  <div className="flex items-center gap-2 w-full lg:w-auto">
                    {tuningMode === 'unison' ? (
                      <div className="flex flex-1 gap-1.5">
                        <Button size="sm" onClick={() => { strikeKeys([0, 1]); }} disabled={selectedKeys.length === 0} className="flex-1 h-8 text-[9px] bg-secondary text-foreground hover:bg-secondary/80 rounded-lg">{t.leftMid}</Button>
                        <Button size="sm" onClick={() => { strikeKeys([1, 2]); }} disabled={selectedKeys.length === 0} className="flex-1 h-8 text-[9px] bg-secondary text-foreground hover:bg-secondary/80 rounded-lg">{t.midRight}</Button>
                        <Button size="sm" onClick={() => { strikeKeys([0, 1, 2]); }} disabled={selectedKeys.length === 0} className="flex-1 h-8 text-[8px] font-bold rounded-lg px-2">{t.fullUnison}</Button>
                      </div>
                    ) : (
                      <Button 
                        onClick={() => strikeKeys()} 
                        disabled={selectedKeys.length === 0}
                        className="flex-1 lg:w-32 h-8 text-xs font-bold rounded-lg"
                      >
                        {t.strikeKeys}
                      </Button>
                    )}
                    <Button onClick={() => setSelectedKeys([])} disabled={selectedKeys.length === 0} variant="outline" className="h-8 w-8 p-0 rounded-lg shrink-0">
                      <X className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </div>
                </div>

              </div>

              {/* Row 3: Knob Area (Note Interaction Card) */}
              <div className="flex-1 py-1">
                <div className="grid grid-cols-2 gap-3 lg:gap-6">
                  {isReferenceMode ? (
                    <div className="col-span-2 py-8 flex items-center justify-center border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
                      <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">{t.referenceModeActive}</p>
                    </div>
                  ) : selectedKeys.length === 0 ? (
                    <div className="col-span-2 py-8 flex items-center justify-center border border-dashed border-zinc-200 rounded-2xl bg-zinc-50/50">
                      <p className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">{t.selectKeysPrompt}</p>
                    </div>
                  ) : tuningMode === 'unison' ? (
                    selectedKeys.map((midi) => (
                      <motion.div key={midi} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="col-span-2 bg-white p-3 lg:p-6 rounded-2xl border border-border shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl font-bold font-mono tracking-tighter">{getNoteName(midi)}</span>
                          </div>
                          <Badge variant="outline" className="text-[8px] bg-primary/5 text-primary border-primary/20">{t.unison}</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {[0, 1, 2].map(idx => (
                            <div key={idx} className="flex flex-col items-center gap-1.5">
                              <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                                {idx === 0 ? t.leftString : idx === 1 ? t.centerString : t.rightString}
                              </span>
                              {idx === 1 ? (
                                <div className="h-16 flex items-center justify-center"> <Badge variant="outline" className="text-[7px] border-dashed opacity-40">REF</Badge> </div>
                              ) : (
                                <div className="flex flex-col items-center gap-1">
                                  <TuningKnob value={unisonDetunes[midi]?.[idx] || 0} onChange={(val) => handleTune(midi, val, idx)} />
                                  {helpEnabled && ( <div className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded", (unisonDetunes[midi]?.[idx] || 0) > 0.1 ? "text-red-500 bg-red-50" : (unisonDetunes[midi]?.[idx] || 0) < -0.1 ? "text-blue-500 bg-blue-50" : "text-green-500 bg-green-50" )}> {(unisonDetunes[midi]?.[idx] || 0).toFixed(1)} </div> )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    selectedKeys.map((midi) => {
                      const startOffset = octaveDirection === 'up' ? 5 : 0;
                      const excludeMidi = octaveDirection === 'up' ? octaveReference.end : octaveReference.start;
                      const isRef = tuningMode === 'octave' && 
                                    (midi >= octaveReference.start - startOffset && midi <= octaveReference.end) && 
                                    midi !== excludeMidi;
                      return (
                        <motion.div key={midi} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("bg-white p-3 lg:p-6 rounded-2xl border border-border shadow-sm", selectedKeys.length === 1 && "col-span-2 mx-auto w-full max-w-sm")}>
                          <div className="flex justify-center mb-3">
                            <span className="text-3xl font-bold font-mono tracking-tighter">{getNoteName(midi)}</span>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            {isRef ? (
                              <div className="h-24 flex items-center justify-center"> <Badge variant="outline" className="text-[7px] border-dashed opacity-40">REF</Badge> </div>
                            ) : (
                              <>
                                <TuningKnob value={tunedKeys[midi] || 0} onChange={(val) => handleTune(midi, val)} precision={0.05} />
                                {helpEnabled && tuningMode === 'octave' && (() => {
                                  const refMidi = octaveDirection === 'up' ? midi - 12 : midi + 12;
                                  const { p1, p2 } = getCoincidentPartials(Math.min(midi, refMidi), Math.max(midi, refMidi));
                                  const B = pianoProfile.inharmonicity;
                                  const f_ref = 440 * Math.pow(2, (refMidi - 69) / 12);
                                  const stretch_low = Math.sqrt(1 + B * (p1 * p1 - 1));
                                  const stretch_high = Math.sqrt(1 + B * (p2 * p2 - 1));
                                  let f_target;
                                  if (midi > refMidi) f_target = f_ref * (p1 / p2) * (stretch_low / stretch_high);
                                  else f_target = f_ref * (p2 / p1) * (stretch_high / stretch_low);
                                  const f_nominal = 440 * Math.pow(2, (midi - 69) / 12);
                                  const targetDetune = 1200 * Math.log2(f_target / f_nominal);
                                  const diff = (tunedKeys[midi] || 0) - targetDetune;
                                  return ( <div className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded", diff > 0.1 ? "text-red-500 bg-red-50" : diff < -0.1 ? "text-blue-500 bg-blue-50" : "text-green-500 bg-green-50" )}>{diff.toFixed(1)}</div> );
                                })()}
                              </>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Row 4: Quickplay Intervals - Unified & Visible on all screens */}
              {(tuningMode === 'temperament' || tuningMode === 'octave') && (
                <div className="border-t border-border pt-4">
                  <div className="space-y-3">
                    <h3 className="hidden md:block text-[9px] font-bold uppercase tracking-widest text-muted-foreground border-l-2 border-primary pl-2">{t.intervalQuickPlay}</h3>
                    <div className="space-y-3">
                      {(tuningMode === 'octave' ? OCTAVE_MODE_INTERVALS.filter(g => {
                        if (octaveDirection === 'up') return ['octaves', 'octaveMajorThirds', 'majorThirds'].includes(g.id);
                        return ['octaves', 'minorThirds', 'majorSixths'].includes(g.id);
                      }) : QUICK_INTERVALS).map(group => (
                        <div key={group.id} className="space-y-1">
                          <span className="hidden md:block text-[8px] font-bold text-muted-foreground/50 uppercase ml-1">{t[group.id as keyof typeof t] || group.name}</span>
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                            {Array.from({ length: keyboardEnd - keyboardStart + 1 }).map((_, i) => {
                              const root = keyboardStart + i;
                              const top = root + group.size;
                              let isAllowed = false;
                              if (tuningMode === 'octave') {
                                const targetStart = octaveReference.start + (octaveDirection === 'up' ? 12 : -12);
                                const targetEnd = octaveReference.end + (octaveDirection === 'up' ? 12 : -12);
                                const inTarget = (m: number) => m >= targetStart && m <= targetEnd;
                                
                                if (octaveDirection === 'up') {
                                  if (group.id === 'octaves') isAllowed = inTarget(top);
                                  else if (group.id === 'octaveMajorThirds') isAllowed = inTarget(top);
                                  else if (group.id === 'majorThirds') isAllowed = inTarget(root + 16); // Same root as a valid octaveMajorThird
                                } else {
                                  // Downward
                                  if (group.id === 'octaves') isAllowed = inTarget(root);
                                  else if (group.id === 'minorThirds') isAllowed = inTarget(root);
                                  else if (group.id === 'majorSixths') isAllowed = inTarget(root - 3); // Starts from top of valid minor3rd
                                }
                              } else {
                                const interval = group as any;
                                if (interval.roots) isAllowed = interval.roots.includes(root);
                                else if (interval.rootRange) {
                                  isAllowed = root >= interval.rootRange[0] && root <= interval.rootRange[1];
                                  if (!isAllowed && interval.extraRoots) isAllowed = interval.extraRoots.includes(root);
                                }
                              }
                              if (!isAllowed || top > keyboardEnd) return null;
                              return (
                                <button
                                  key={`${root}-${top}`}
                                  onClick={() => {
                                    pianoEngine.stopAll(0.1);
                                    const coincident = getCoincidentPartials(root, top);
                                    if (tuningMode === 'unison') {
                                      pianoEngine.playNote(root, unisonDetunes[root] || [0, 0, 0], coincident.p1);
                                      pianoEngine.playNote(top, unisonDetunes[top] || [0, 0, 0], coincident.p2);
                                    } else {
                                      pianoEngine.playNote(root, [tunedKeys[root] || 0], coincident.p1);
                                      pianoEngine.playNote(top, [tunedKeys[top] || 0], coincident.p2);
                                    }
                                  }}
                                  className="whitespace-nowrap px-2.5 py-1 rounded-md text-[9px] font-bold border border-border bg-white text-muted-foreground hover:border-primary hover:text-primary transition-all active:scale-95"
                                >
                                  {getNoteName(root)}-{getNoteName(top)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Row 5: Sliders and Session End - Bottom Area */}
              <div className="border-t border-border pt-4 flex flex-col gap-4">
                <div className="grid grid-cols-3 gap-2 lg:gap-6">
                  {/* Volume */}
                  <div className="bg-secondary/10 rounded-xl p-1.5 lg:p-3 border border-border">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[7px] lg:text-[9px] text-muted-foreground uppercase font-bold">{t.volume}</span>
                      <span className="text-[7px] lg:text-foreground font-mono">{volume}dB</span>
                    </div>
                    <Slider 
                      value={[volume]} 
                      min={-40} 
                      max={0} 
                      onValueChange={(v: number[]) => { 
                        if (v && v.length > 0) {
                          setVolume(v[0]); 
                          pianoEngine.setVolume(v[0]); 
                        }
                      }} 
                    />
                  </div>
                  {/* Decay */}
                  <div className="bg-secondary/10 rounded-xl p-1.5 lg:p-3 border border-border">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[7px] lg:text-[9px] text-muted-foreground uppercase font-bold">{t.decay}</span>
                      <span className="text-[7px] lg:text-foreground font-mono">{decay}s</span>
                    </div>
                    <Slider 
                      value={[decay]} 
                      min={1} 
                      max={10} 
                      step={0.5} 
                      onValueChange={(v: number[]) => { 
                        if (v && v.length > 0) {
                          setDecay(v[0]); 
                          pianoEngine.setDecay(v[0]); 
                        }
                      }} 
                    />
                  </div>
                  {/* Harmonics */}
                  <div className="bg-secondary/10 rounded-xl p-1.5 lg:p-3 border border-border">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[7px] lg:text-[9px] text-muted-foreground uppercase font-bold">{t.harmonics}</span>
                      <span className="text-[7px] lg:text-foreground font-mono">{Math.round(partialStrength * 100)}%</span>
                    </div>
                    <Slider 
                      value={[partialStrength]} 
                      min={0} 
                      max={2} 
                      step={0.1} 
                      onValueChange={(v: number[]) => { 
                        if (v && v.length > 0) {
                          setPartialStrength(v[0]); 
                          pianoEngine.setPartialStrength(v[0]); 
                        }
                      }} 
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={finishGame} className="w-full h-10 md:h-12 bg-primary hover:bg-primary/90 text-white font-bold text-xs md:text-sm rounded-xl transition-all shadow-md shadow-primary/10">
                    <Check className="w-4 h-4 mr-2" /> {t.finishTuning}
                  </Button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Results Modal */}
        <AnimatePresence>
          {showResults && (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start md:items-center justify-center p-2 md:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-8 max-w-xl w-full shadow-2xl relative my-auto overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
          
          <div className="text-center mb-3 md:mb-6">
            <div className="w-10 h-10 md:w-16 md:h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2 md:mb-3">
              <Trophy className="w-5 h-5 md:w-8 md:h-8 text-yellow-600" />
            </div>
            <h2 className="text-lg md:text-2xl font-bold uppercase leading-tight">{t.sessionComplete}</h2>
            <p className="text-[10px] md:text-sm text-zinc-500">{t.analysisComplete}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-4 mb-4 md:mb-6">
            <div className="bg-zinc-50 p-2 md:p-4 rounded-xl text-center">
              <p className="text-[7px] md:text-[9px] text-zinc-400 uppercase font-bold mb-0.5">{t.accuracyScore}</p>
              <p className="text-xl md:text-3xl font-bold text-zinc-900">{calculateScore()}%</p>
            </div>
            <div className="bg-zinc-50 p-2 md:p-4 rounded-xl text-center">
              <p className="text-[7px] md:text-[9px] text-zinc-400 uppercase font-bold mb-0.5">{t.timeTaken}</p>
              <p className="text-xl md:text-3xl font-bold text-zinc-900">{formatTime(timer)}</p>
            </div>
          </div>

          <div className="bg-zinc-50 p-2 md:p-6 rounded-xl mb-4 md:mb-6 overflow-hidden">
            <p className="text-[8px] md:text-[9px] text-zinc-400 uppercase font-bold mb-3 md:mb-4 text-center tracking-widest">
              {tuningMode === 'temperament' ? t.temperamentAnalysis : tuningMode === 'unison' ? t.unisonMode : t.octaveMode}
            </p>
            
            <div className="relative mx-auto flex justify-center w-full overflow-visible px-2" style={{ height: '160px' }}>
              {tuningMode === 'temperament' ? (
                <div className="scale-[0.5] sm:scale-75 md:scale-90 origin-center transition-transform duration-300 shrink-0">
                  <div className="relative" style={{ width: '500px', height: '160px' }}>
                          {/* White Keys */}
                          {TEMPERAMENT_SEQUENCE.filter(s => !isBlackKey(s.midi)).map((step) => {
                            const error = (tunedKeys[step.midi] || 0) - step.target;
                            const absError = Math.abs(error);
                            let colorClass = "bg-red-500";
                            if (absError <= 0.5) colorClass = "bg-green-500";
                            else if (absError <= 1.5) colorClass = "bg-yellow-400";

                            const whiteKeys = [53, 55, 57, 59, 60, 62, 64, 65, 67, 69];
                            const index = whiteKeys.indexOf(step.midi);
                            if (index === -1) return null;

                            return (
                              <div 
                                key={step.midi} 
                                className="absolute flex flex-col items-center gap-1.5"
                                style={{ left: `${index * 50}px`, top: '65px' }}
                              >
                                 <div 
                                  className={`w-12 h-24 rounded-b-md shadow-md ${colorClass} flex items-end justify-center pb-3 border-b-4 border-black/10 transition-all hover:scale-105 cursor-help`}
                                  title={`${step.note}: ${error.toFixed(2)} cents`}
                                >
                                  <span className="text-[10px] text-white font-bold">{step.note}</span>
                                </div>
                                <div className="mt-1 bg-white/80 backdrop-blur-[2px] px-1 rounded border border-zinc-100/50 shadow-sm">
                                  <span className={`text-[10px] font-mono font-bold whitespace-nowrap ${error > 0 ? 'text-blue-600' : error < 0 ? 'text-red-600' : 'text-zinc-400'}`}>
                                    {error > 0 ? '+' : ''}{error.toFixed(1)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {/* Black Keys */}
                          {TEMPERAMENT_SEQUENCE.filter(s => isBlackKey(s.midi)).map((step) => {
                            const error = (tunedKeys[step.midi] || 0) - step.target;
                            const absError = Math.abs(error);
                            let colorClass = "bg-red-500";
                            if (absError <= 0.5) colorClass = "bg-green-500";
                            else if (absError <= 1.5) colorClass = "bg-yellow-400";

                            const whiteKeys = [53, 55, 57, 59, 60, 62, 64, 65, 67, 69];
                            const leftWhiteMidi = step.midi - 1;
                            const index = whiteKeys.indexOf(leftWhiteMidi);
                            if (index === -1) return null;

                            return (
                                <div 
                                  key={step.midi} 
                                  className="absolute flex flex-col items-center gap-1 z-10"
                                  style={{ left: `${index * 50 + 29}px`, top: '-5px' }}
                                >
                                  <div className="mb-0.5 bg-white/80 backdrop-blur-[2px] px-0.5 rounded border border-zinc-100/50 shadow-sm">
                                    <span className={`text-[10px] font-mono font-bold whitespace-nowrap ${error > 0 ? 'text-blue-600' : error < 0 ? 'text-red-600' : 'text-zinc-400'}`}>
                                      {error > 0 ? '+' : ''}{error.toFixed(1)}
                                    </span>
                                  </div>
                                  <div 
                                    className={`w-10 h-16 rounded-b-sm shadow-lg ${colorClass} flex items-end justify-center pb-3 border-b-4 border-black/30 transition-all hover:scale-110 cursor-help`}
                                    title={`${step.note}: ${error.toFixed(2)} cents`}
                                  >
                                    <span className="text-[9px] text-white font-bold">{step.note}</span>
                                  </div>
                                </div>
                              );
                          })}
                        </div>
                      </div>
                    ) : tuningMode === 'unison' ? (
                      <div className="scale-[0.5] sm:scale-75 md:scale-90 origin-center transition-transform duration-300 shrink-0">
                        <div className="relative" style={{ width: '400px', height: '160px' }}>
                          {(() => {
                            const range = Array.from({ length: unisonOctave.end - unisonOctave.start + 1 }, (_, i) => unisonOctave.start + i);
                            const whiteKeysInRange = range.filter(m => !isBlackKey(m));
                            const blackKeysInRange = range.filter(m => isBlackKey(m));

                            const getActionColor = (detunes: number[]) => {
                              // Center string (index 1) is reference
                              const avgError = (Math.abs(detunes[0] - detunes[1]) + Math.abs(detunes[2] - detunes[1])) / 2;
                              if (avgError <= 0.5) return "bg-green-500";
                              if (avgError <= 1.5) return "bg-yellow-400";
                              return "bg-red-500";
                            };

                            return (
                              <>
                                {/* White Keys */}
                                {whiteKeysInRange.map((midi, index) => {
                                  const detunes = unisonDetunes[midi] || [0, 0, 0];
                                  const valL = detunes[0];
                                  const valR = detunes[2];
                                  const colorClass = getActionColor(detunes);

                                  return (
                                    <div 
                                      key={midi} 
                                      className="absolute flex flex-col items-center gap-1.5"
                                      style={{ left: `${index * 50}px`, top: '65px' }}
                                    >
                                      <div 
                                        className={`w-12 h-24 rounded-b-md shadow-md ${colorClass} flex flex-col items-center justify-end pb-3 border-b-4 border-black/10 transition-all hover:scale-105 cursor-help`}
                                        title={`${getNoteName(midi)}: Strings [${valL.toFixed(1)}, ${valR.toFixed(1)}]`}
                                      >
                                        <span className="text-[10px] text-white font-bold">{getNoteName(midi)}</span>
                                      </div>
                                      <div className="flex flex-col items-center bg-white/80 backdrop-blur-[2px] rounded border border-zinc-100 px-1 py-0.5 shadow-sm">
                                        <span className="text-[8px] font-mono font-bold text-zinc-800">{valL > 0 ? '+' : ''}{valL.toFixed(1)}</span>
                                        <span className="text-[8px] font-mono font-bold text-zinc-800">{valR > 0 ? '+' : ''}{valR.toFixed(1)}</span>
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Black Keys */}
                                {blackKeysInRange.map((midi) => {
                                  const detunes = unisonDetunes[midi] || [0, 0, 0];
                                  const valL = detunes[0];
                                  const valR = detunes[2];
                                  const colorClass = getActionColor(detunes);
                                  const leftWhiteMidi = midi - 1;
                                  const whiteKeyIndex = whiteKeysInRange.indexOf(leftWhiteMidi);

                                  return (
                                    <div 
                                      key={midi} 
                                      className="absolute flex flex-col items-center z-10"
                                      style={{ left: `${whiteKeyIndex * 50 + 29}px`, top: '-5px' }}
                                    >
                                      <div className="flex flex-col items-center mb-1 bg-white/80 backdrop-blur-[2px] rounded border border-zinc-100 px-0.5 shadow-sm">
                                        <span className="text-[8px] font-mono font-bold text-zinc-800">{valL > 0 ? '+' : ''}{valL.toFixed(1)}</span>
                                        <span className="text-[8px] font-mono font-bold text-zinc-800">{valR > 0 ? '+' : ''}{valR.toFixed(1)}</span>
                                      </div>
                                      <div 
                                        className={`w-10 h-16 rounded-b-sm shadow-lg ${colorClass} flex items-end justify-center pb-2 border-b-4 border-black/30 transition-all hover:scale-110 cursor-help`}
                                        title={`${getNoteName(midi)}: Strings [${valL.toFixed(1)}, ${valR.toFixed(1)}]`}
                                      >
                                        <span className="text-[9px] text-white font-bold">{getNoteName(midi)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="scale-[0.5] sm:scale-75 md:scale-90 origin-center transition-transform duration-300 shrink-0">
                        <div className="relative" style={{ width: '400px', height: '160px' }}>
                          {(() => {
                            const targetStart = octaveDirection === 'up' ? octaveReference.start + 12 : octaveReference.start - 12;
                            const range = Array.from({ length: 13 }, (_, i) => targetStart + i);
                            
                            const whiteKeysInRange = range.filter(m => !isBlackKey(m));
                            const blackKeysInRange = range.filter(m => isBlackKey(m));

                            return (
                              <>
                                {/* White Keys */}
                                {whiteKeysInRange.map((midi, index) => {
                                  const error = tunedKeys[midi] || 0;
                                  const absError = Math.abs(error);
                                  let colorClass = "bg-red-500";
                                  if (absError <= 0.5) colorClass = "bg-green-500";
                                  else if (absError <= 1.5) colorClass = "bg-yellow-400";

                                  return (
                                    <div 
                                      key={midi} 
                                      className="absolute flex flex-col items-center gap-1.5"
                                      style={{ left: `${index * 50}px`, top: '65px' }}
                                    >
                                      <div 
                                        className={`w-12 h-24 rounded-b-md shadow-md ${colorClass} flex items-end justify-center pb-3 border-b-4 border-black/10 transition-all hover:scale-105 cursor-help`}
                                        title={`${getNoteName(midi)}: ${error.toFixed(2)} cents`}
                                      >
                                        <span className="text-[10px] text-white font-bold">{getNoteName(midi)}</span>
                                      </div>
                                      <div className="mt-1 bg-white/80 backdrop-blur-[2px] px-1 rounded border border-zinc-100/50 shadow-sm">
                                        <span className={`text-[10px] font-mono font-bold whitespace-nowrap ${error > 0 ? 'text-blue-600' : error < 0 ? 'text-red-600' : 'text-zinc-400'}`}>
                                          {error > 0 ? '+' : ''}{error.toFixed(1)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Black Keys */}
                                {blackKeysInRange.map((midi) => {
                                  const error = tunedKeys[midi] || 0;
                                  const absError = Math.abs(error);
                                  let colorClass = "bg-red-500";
                                  if (absError <= 0.5) colorClass = "bg-green-500";
                                  else if (absError <= 1.5) colorClass = "bg-yellow-400";

                                  // Find the white key to the left for positioning
                                  const leftWhiteMidi = midi - 1;
                                  const whiteKeyIndex = whiteKeysInRange.indexOf(leftWhiteMidi);

                                  return (
                                    <div 
                                      key={midi} 
                                      className="absolute flex flex-col items-center gap-1 z-10"
                                      style={{ left: `${whiteKeyIndex * 50 + 29}px`, top: '-5px' }}
                                    >
                                      <div className="mb-0.5 bg-white/80 backdrop-blur-[2px] px-0.5 rounded border border-zinc-100/50 shadow-sm">
                                        <span className={`text-[10px] font-mono font-bold whitespace-nowrap ${error > 0 ? 'text-blue-600' : error < 0 ? 'text-red-600' : 'text-zinc-400'}`}>
                                          {error > 0 ? '+' : ''}{error.toFixed(1)}
                                        </span>
                                      </div>
                                      <div 
                                        className={`w-10 h-16 rounded-b-sm shadow-lg ${colorClass} flex items-end justify-center pb-3 border-b-4 border-black/30 transition-all hover:scale-110 cursor-help`}
                                        title={`${getNoteName(midi)}: ${error.toFixed(2)} cents`}
                                      >
                                        <span className="text-[9px] text-white font-bold">{getNoteName(midi)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button 
              onClick={() => {
                if (timerRef.current) clearInterval(timerRef.current);
                setShowResults(false);
                handleStart(isReferenceMode);
              }} 
              className="w-full h-12 bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-sm md:text-base rounded-xl"
            >
              {t.tryAgain}
            </Button>
            <Button 
              variant="outline" 
              className="w-full h-12 border-zinc-200 text-zinc-600 font-bold text-sm md:text-base rounded-xl" 
              onClick={handleReset}
            >
              {t.mainMenu}
            </Button>
          </div>
        </motion.div>
      </motion.div>
          )}
        </AnimatePresence>

        {/* Documentation Modal */}
        <AnimatePresence>
          {showDocumentation && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full shadow-2xl relative my-auto overflow-hidden max-h-[90vh] flex flex-col"
              >
                <button 
                  onClick={() => setShowDocumentation(false)}
                  className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>

                <div className="mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold uppercase tracking-tight">{t.documentation}</h2>
                </div>

                <div className="flex gap-2 mb-6 bg-zinc-100 p-1 rounded-xl">
                  <button 
                    onClick={() => setDocTab('ear')}
                    className={cn(
                      "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                      docTab === 'ear' ? "bg-white text-primary shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                    )}
                  >
                    {t.tuningByEar}
                  </button>
                  <button 
                    onClick={() => setDocTab('principles')}
                    className={cn(
                      "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all",
                      docTab === 'principles' ? "bg-white text-primary shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                    )}
                  >
                    {t.appPrinciples}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  <DocumentationContent tab={docTab} language={language} />
                </div>

                <div className="mt-8 pt-6 border-t border-zinc-100 italic text-[10px] text-zinc-400 text-center">
                  Created for students and professionals of piano technology.
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
    </div>
  );
}
