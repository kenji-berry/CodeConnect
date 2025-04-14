import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface MultiDifficultySelectorProps {
  onDifficultiesChange: (levels: number[]) => void;
  selectedDifficulties: number[];
}

// Tooltip component that will be rendered in a portal
const Tooltip = ({ text, position }: { text: string; position: { top: number; left: number } }) => {
  return createPortal(
    <div 
      className="px-3 py-2 bg-zinc-800 text-white text-sm rounded-lg shadow-lg 
        pointer-events-none whitespace-nowrap"
      style={{
        position: 'fixed',
        zIndex: 10000,
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
      }}
    >
      {text}
    </div>,
    document.body
  );
};

const MultiDifficultySelector: React.FC<MultiDifficultySelectorProps> = ({
  onDifficultiesChange,
  selectedDifficulties = []
}) => {
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const buttonsRef = useRef<(HTMLDivElement | null)[]>([]);

  const difficultyLabels = {
    1: "Beginner - Perfect for first-time contributors",
    2: "Easy - Basic programming knowledge required",
    3: "Intermediate - Good for experienced developers",
    4: "Advanced - Complex concepts involved",
    5: "Expert - Deep technical expertise needed"
  };

  // Update tooltip position when hovering over a button
  const handleMouseEnter = (level: number, index: number) => {
    const button = buttonsRef.current[index];
    if (button) {
      const rect = button.getBoundingClientRect();
      
      let left = window.scrollX + rect.left + rect.width / 2;
      
      // Ensure tooltip doesn't go off the left side of the screen
      const tooltipWidth = difficultyLabels[level as keyof typeof difficultyLabels].length * 7; 
      const minLeft = tooltipWidth / 2 + 20;
      
      if (left < minLeft) {
        left = minLeft;
      }

      setTooltipPosition({
        top: window.scrollY + rect.bottom + 10,
        left: left
      });
      
      setHoveredLevel(level);
    }
  };

  const handleClick = (level: number) => {
    const currentDifficulties = selectedDifficulties.map(d => Number(d));
    
    // Check if the level already exists
    const levelExists = currentDifficulties.includes(level);
    
    const newDifficulties = levelExists
      ? currentDifficulties.filter(d => d !== level) 
      : [...currentDifficulties, level]; 

    onDifficultiesChange(newDifficulties);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((level, index) => (
          <div
            key={level}
            className="relative"
            ref={el => { buttonsRef.current[index] = el; }}
            onMouseEnter={() => handleMouseEnter(level, index)}
            onMouseLeave={() => setHoveredLevel(null)}
          >
            <div
              className={`w-8 h-8 rounded-full cursor-pointer flex items-center justify-center
                transition-colors duration-200 select-none ${
                selectedDifficulties.map(Number).includes(level)
                  ? 'bg-[color:--muted-red] text-white'
                  : 'bg-slate-500 text-slate-200' 
              }`}
              onClick={() => handleClick(level)}
            >
              {level}
            </div>
          </div>
        ))}
      </div>
      
      {hoveredLevel !== null && (
        <Tooltip 
          text={difficultyLabels[hoveredLevel as keyof typeof difficultyLabels]} 
          position={tooltipPosition} 
        />
      )}
    </div>
  );
};

export default MultiDifficultySelector;