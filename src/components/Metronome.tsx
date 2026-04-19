import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Settings, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { pianoEngine } from '@/lib/piano-engine';

interface MetronomeProps {
  className?: string;
  bpm: number;
  setBpm: (bpm: number) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  label?: string;
}

export const Metronome: React.FC<MetronomeProps> = ({ className, bpm, setBpm, isPlaying, setIsPlaying, label = "Metronome" }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [inputValue, setInputValue] = useState(bpm.toString());
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(bpm.toString());
  }, [bpm]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click was on the settings gear button - if so, let the button's own toggle logic handle it
      const target = event.target as Node;
      const settingsButton = document.querySelector('[data-metronome-settings-btn]');
      if (settingsButton && settingsButton.contains(target)) {
        return;
      }

      if (settingsRef.current && !settingsRef.current.contains(target)) {
        setShowSettings(false);
      }
    };
    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSettings]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleBpmChange = (newBpm: number) => {
    const clampedBpm = Math.max(20, Math.min(300, newBpm));
    setBpm(clampedBpm);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      setBpm(Math.max(20, Math.min(300, val)));
    }
  };

  const adjustBpm = (delta: number) => {
    handleBpmChange(bpm + delta);
  };

  return (
    <div className={cn("relative flex items-center gap-1 md:gap-2 bg-secondary/10 rounded-lg md:rounded-xl border border-border p-0.5 md:p-1 pr-1 md:pr-2", className)}>
      <div 
        className="flex flex-col px-1 md:px-2 border-r border-border/50 cursor-ns-resize select-none group"
        onWheel={(e) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.5 : 0.5;
          adjustBpm(delta);
        }}
        title="Scroll to adjust BPM"
      >
        <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-tighter text-muted-foreground leading-none mb-0.5 group-hover:text-primary transition-colors">{label}</span>
        <div className="flex items-center gap-0.5 md:gap-1">
          <span className="text-xs md:text-sm font-mono font-bold tabular-nums text-primary">{bpm.toFixed(1)}</span>
          <span className="text-[7px] md:text-[8px] font-bold text-muted-foreground hidden xs:inline">BPM</span>
        </div>
      </div>

      <div className="flex items-center gap-0.5 md:gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={togglePlay}
          className={cn(
            "h-7 w-7 md:h-8 md:w-8 rounded-md md:rounded-lg transition-all",
            isPlaying ? "bg-primary/10 text-primary hover:bg-primary/20" : "hover:bg-secondary"
          )}
        >
          {isPlaying ? <Pause className="w-3 h-3 md:w-4 md:h-4 fill-current" /> : <Play className="w-3 h-3 md:w-4 md:h-4 fill-current ml-0.5" />}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          data-metronome-settings-btn
          onClick={() => setShowSettings(!showSettings)}
          className={cn(
            "h-7 w-7 md:h-8 md:w-8 rounded-md md:rounded-lg hover:bg-secondary transition-all",
            showSettings && "bg-secondary"
          )}
        >
          <Settings className={cn("w-3 h-3 md:w-4 md:h-4 text-muted-foreground transition-transform duration-300", showSettings && "rotate-90")} />
        </Button>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div
            ref={settingsRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full right-0 mt-2 z-[60] bg-white border border-border rounded-xl shadow-2xl p-3 w-48"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Settings</span>
              <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  className="flex-1 bg-secondary/20 border border-border rounded-lg px-2 h-9 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <div className="flex flex-col gap-0.5">
                  <button 
                    onClick={() => adjustBpm(0.5)}
                    className="p-1 hover:bg-secondary rounded-md transition-colors"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={() => adjustBpm(-0.5)}
                    className="p-1 hover:bg-secondary rounded-md transition-colors"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <input
                  type="range"
                  min="20"
                  max="300"
                  step="0.5"
                  value={bpm}
                  onChange={(e) => handleBpmChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
