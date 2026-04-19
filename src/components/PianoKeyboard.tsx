import React from 'react';
import { cn } from '@/lib/utils';
import { isBlackKey, getNoteName } from '@/lib/constants';

interface PianoKeyboardProps {
  startMidi: number;
  endMidi: number;
  selectedKeys: number[];
  referenceKeys?: number[];
  validMidis?: number[];
  onKeyClick: (midi: number) => void;
  className?: string;
}

export function PianoKeyboard({
  startMidi,
  endMidi,
  selectedKeys,
  referenceKeys = [],
  validMidis,
  onKeyClick,
  className
}: PianoKeyboardProps) {
  const keys = [];
  for (let i = startMidi; i <= endMidi; i++) {
    keys.push(i);
  }

  // Calculate positions
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const keyWidth = isMobile ? 28 : 44;
  const blackKeyWidth = isMobile ? 18 : 28;
  const height = isMobile ? 100 : 180;
  const blackKeyHeight = isMobile ? 60 : 110;

  // We need to know which white keys exist in the full sequence to calculate black key positions correctly
  // even if some keys are hidden.
  const allKeysInRange = [];
  for (let i = startMidi; i <= endMidi; i++) {
    allKeysInRange.push(i);
  }
  const whiteKeysInRange = allKeysInRange.filter(m => !isBlackKey(m));
  const visibleWhiteKeys = whiteKeysInRange.filter(m => !validMidis || validMidis.includes(m));

  // Determine which white keys have a gap before them
  const whiteKeyGaps: Record<number, boolean> = {};
  visibleWhiteKeys.forEach((midi, idx) => {
    if (idx === 0) return;
    const prevMidi = visibleWhiteKeys[idx - 1];
    const prevIndexInRange = whiteKeysInRange.indexOf(prevMidi);
    const currIndexInRange = whiteKeysInRange.indexOf(midi);
    if (currIndexInRange - prevIndexInRange > 1) {
      whiteKeyGaps[midi] = true;
    }
  });

  const getCumulativeOffset = (midi: number) => {
    let offset = 0;
    for (let i = 0; i < visibleWhiteKeys.length; i++) {
      const m = visibleWhiteKeys[i];
      if (whiteKeyGaps[m]) offset += keyWidth / 2; // Add half a key width as a spacer
      if (m === midi) break;
    }
    return offset;
  };

  return (
    <div className={cn("relative pb-6 select-none overflow-x-auto px-4 w-full flex justify-center scrollbar-hide", className)}>
      <div className="relative flex h-full min-w-fit" style={{ height: `${height}px` }}>
        <div className="relative flex">
          {/* White Keys */}
          {visibleWhiteKeys.map((midi) => {
            const isSelected = selectedKeys.includes(midi);
            const isReference = referenceKeys.includes(midi);
            const hasGapBefore = whiteKeyGaps[midi];
            
            return (
              <React.Fragment key={midi}>
                {hasGapBefore && <div style={{ width: `${keyWidth / 2}px` }} className="flex-shrink-0" />}
                <div
                  onClick={() => onKeyClick(midi)}
                  className={cn(
                    "border border-zinc-200 bg-white hover:bg-zinc-50 transition-all cursor-pointer flex flex-col justify-end items-center pb-3 mx-[0.5px] rounded-b-sm shadow-sm",
                    isSelected && "bg-primary border-primary text-white z-10 scale-[1.01] shadow-md",
                    isReference && !isSelected && "bg-amber-50 border-amber-200 shadow-[inset_0_-3px_0_0_rgba(245,158,11,0.2)]"
                  )}
                  style={{
                    width: `${keyWidth}px`,
                    height: `${height}px`,
                    minWidth: `${keyWidth}px`,
                  }}
                >
                  <span className={cn("text-[10px] font-bold font-mono", isSelected ? "text-zinc-400" : "text-zinc-300")}>
                    {getNoteName(midi)}
                  </span>
                </div>
              </React.Fragment>
            );
          })}

          {/* Black Keys */}
          {allKeysInRange.map((midi) => {
            if (!isBlackKey(midi)) return null;
            
            const isVisible = !validMidis || validMidis.includes(midi);
            if (!isVisible) return null;

            const isSelected = selectedKeys.includes(midi);
            const isReference = referenceKeys.includes(midi);
            
            // Find index of the white key to the left in the VISIBLE white keys list
            const leftWhiteMidi = midi - 1;
            const wIndex = visibleWhiteKeys.indexOf(leftWhiteMidi) + 1;
            if (wIndex === 0) return null;

            // totalWidth = keyWidth + (mx * 2) = keyWidth + 1
            // We must add cumulative offset from gaps to the position
            const offset = getCumulativeOffset(visibleWhiteKeys[wIndex - 1]);
            const left = (wIndex * (keyWidth + 1)) - (blackKeyWidth / 2) + offset;

            return (
              <div
                key={midi}
                onClick={() => onKeyClick(midi)}
                className={cn(
                  "absolute top-0 bg-zinc-800 hover:bg-zinc-700 transition-all cursor-pointer flex flex-col justify-end items-center pb-3 z-20 rounded-b-md shadow-md",
                  isSelected && "bg-primary/80 border-primary scale-[1.02] shadow-xl",
                  isReference && !isSelected && "bg-amber-900 border-amber-700 shadow-[inset_0_-3px_0_0_rgba(245,158,11,0.4)]"
                )}
                style={{
                  width: `${blackKeyWidth}px`,
                  height: `${blackKeyHeight}px`,
                  left: `${left}px`,
                }}
              >
                <span className={cn("text-[8px] font-bold font-mono", isSelected ? "text-zinc-900" : "text-zinc-500")}>
                  {getNoteName(midi)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
