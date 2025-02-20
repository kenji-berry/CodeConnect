import React, { useState } from 'react';

interface DifficultySelectorProps {
  onDifficultyChange: (level: number) => void;
  initialDifficulty?: number;
}

const DifficultySelector: React.FC<DifficultySelectorProps> = ({
  onDifficultyChange,
  initialDifficulty = 1
}) => {
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);

  const difficultyLabels = {
    1: "Beginner - Perfect for first-time contributors",
    2: "Easy - Basic programming knowledge required",
    3: "Intermediate - Good for experienced developers",
    4: "Advanced - Complex concepts involved",
    5: "Expert - Deep technical expertise needed"
  };

  const handleClick = (level: number) => {
    setDifficulty(level);
    onDifficultyChange(level);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className="relative"
            onMouseEnter={() => setHoveredLevel(level)}
            onMouseLeave={() => setHoveredLevel(null)}
          >
            <div
              className={`w-8 h-8 rounded-full cursor-pointer flex items-center justify-center
                transition-colors duration-200 ${
                level == difficulty
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
      {hoveredLevel && (
        <div 
          className="absolute z-50 px-3 py-2 bg-zinc-800 text-white text-sm rounded-lg 
            transition-opacity duration-200 pointer-events-none whitespace-nowrap
            left-0 mt-2"
        >
          {difficultyLabels[hoveredLevel as keyof typeof difficultyLabels]}
        </div>
      )}
    </div>
  );
};

export default DifficultySelector;