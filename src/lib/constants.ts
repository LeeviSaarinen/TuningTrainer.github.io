export const TEMPERAMENT_SEQUENCE = [
  { note: "A4", midi: 69, target: 0 }, // Reference
  { note: "A3", midi: 57, target: 0 }, // Octave
  { note: "D4", midi: 62, target: 0 }, // 4th up
  { note: "G3", midi: 55, target: 0 }, // 5th down
  { note: "C4", midi: 60, target: 0 }, // 4th up
  { note: "F3", midi: 53, target: 0 }, // 5th down
  { note: "A#3", midi: 58, target: 0 }, // 4th up
  { note: "D#4", midi: 63, target: 0 }, // 4th up
  { note: "G#3", midi: 56, target: 0 }, // 5th down
  { note: "C#4", midi: 61, target: 0 }, // 4th up
  { note: "F#3", midi: 54, target: 0 }, // 5th down
  { note: "B3", midi: 59, target: 0 }, // 4th up
  { note: "E4", midi: 64, target: 0 }, // 4th up
  { note: "F4", midi: 65, target: 0 }, // Octave from F3
];

export interface PianoProfile {
  id: string;
  name: string;
  inharmonicity: number;
}

export const PIANO_PROFILES: PianoProfile[] = [
  { 
    id: "concertGrand",
    name: "Concert Grand 9'", 
    inharmonicity: 0.00015
  },
  { 
    id: "studioGrand",
    name: "Studio Grand 6'", 
    inharmonicity: 0.0003
  },
  { 
    id: "classicUpright",
    name: "Classic Upright", 
    inharmonicity: 0.0006
  },
  { 
    id: "vintageSpinnet",
    name: "Vintage Spinnet", 
    inharmonicity: 0.0012
  },
  { 
    id: "oldSaloon",
    name: "Old Saloon Piano", 
    inharmonicity: 0.0025
  }
];

export interface DetuneLevel {
  id: string;
  name: string;
  range: number; // +/- cents
}

export const DETUNE_LEVELS: DetuneLevel[] = [
  { id: "slightDetune", name: "Slightly Out", range: 5 },
  { id: "unplayedDetune", name: "Unplayed", range: 15 },
  { id: "neglectedDetune", name: "Neglected", range: 35 },
  { id: "barnFindDetune", name: "Barn Find", range: 75 }
];

export const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export type OctaveSize = "1:2" | "2:4" | "3:6" | "4:8";

export interface OctaveDefinition {
  size: OctaveSize;
  pLower: number;
  pUpper: number;
  description: string;
}

export const OCTAVE_DEFINITIONS: OctaveDefinition[] = [
  { size: "1:2", pLower: 2, pUpper: 1, description: "Pure fundamental to 2nd partial. Bright treble." },
  { size: "2:4", pLower: 4, pUpper: 2, description: "Standard mid-range octave. Balanced stretch." },
  { size: "3:6", pLower: 6, pUpper: 3, description: "Wide bass octave. Deep and resonant." },
  { size: "4:8", pLower: 8, pUpper: 4, description: "Extreme stretch for low bass growl." },
];

export type TuningMode = 'temperament' | 'unison' | 'octave';

export const UNISON_OCTAVES = [
  { label: "C1-C2", start: 24, end: 36 },
  { label: "C2-C3", start: 36, end: 48 },
  { label: "C3-C4", start: 48, end: 60 },
  { label: "C4-C5", start: 60, end: 72 },
  { label: "C5-C6", start: 72, end: 84 },
  { label: "C6-C7", start: 84, end: 96 },
  { label: "C7-C8", start: 96, end: 108 },
];

export function getNoteName(midi: number) {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

export function isBlackKey(midi: number) {
  return [1, 3, 6, 8, 10].includes(midi % 12);
}
