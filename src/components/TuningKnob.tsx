import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface TuningKnobProps {
  value: number;
  onChange: (newValue: number) => void;
  precision?: number;
}

export const TuningKnob: React.FC<TuningKnobProps> = ({ value, onChange, precision = 0.05 }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startValue = useRef(0);
  const rotationOffset = useRef(Math.random() * 360);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startY.current = e.clientY;
    startValue.current = value;
    document.body.style.cursor = 'ns-resize';
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    startY.current = e.touches[0].clientY;
    startValue.current = value;
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = startY.current - e.clientY;
      const newValue = startValue.current + deltaY * precision;
      onChange(newValue);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      // Prevent scrolling while dragging the knob
      if (e.cancelable) e.preventDefault();
      const deltaY = startY.current - e.touches[0].clientY;
      const newValue = startValue.current + deltaY * precision;
      onChange(newValue);
    };

    const handleEnd = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, onChange, precision]);

  // Visual rotation - map value to degrees + random offset
  const rotation = (value * 20 + rotationOffset.current) % 360;

  return (
    <div 
      className="relative flex flex-col items-center justify-center py-1.5"
    >
      <div 
        className="relative w-12 h-12 md:w-32 md:h-32 flex items-center justify-center cursor-ns-resize select-none group touch-none"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Outer Glow */}
        <div className={`absolute inset-0 rounded-full transition-all duration-500 ${isDragging ? 'bg-primary/20 scale-110 blur-2xl' : 'bg-primary/5 blur-xl group-hover:bg-primary/10'}`} />
        
        {/* Knob Body */}
        <div className="relative w-10 h-10 md:w-24 md:h-24 rounded-full bg-white border-2 md:border-4 border-secondary shadow-[0_10px_30px_rgba(0,0,0,0.05)] flex items-center justify-center overflow-hidden">
          {/* Metal Texture/Grooves - Subtle for light theme */}
          <div className="absolute inset-0 opacity-5 bg-[conic-gradient(from_0deg,transparent_0deg,black_10deg,transparent_20deg)] bg-[length:20px_20px]" />
          
          {/* Rotating Part */}
          <motion.div 
            className="w-full h-full relative"
            style={{ rotate: rotation }}
          >
            {/* Center Cap */}
            <div className="absolute inset-3 md:inset-6 rounded-full bg-secondary/30 border border-border shadow-inner flex items-center justify-center">
               <div className="w-1 h-1 rounded-full bg-muted-foreground/30" />
            </div>
          </motion.div>
        </div>

        {/* Drag Hint */}
        <AnimatePresence>
          {isDragging && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute -bottom-6 text-[9px] text-primary font-mono uppercase tracking-[0.2em] font-bold"
            >
              Adjusting Pitch
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
