import React, { useState, useEffect } from 'react';

interface SingleSelectorProps {
  values: string[];
  onValueChange: (selectedValue: string | null) => void;
  initialValue?: string;
  tooltips?: { [key: string]: string };
}

const SingleSelector: React.FC<SingleSelectorProps> = ({ 
  values, 
  onValueChange,
  initialValue = null,
  tooltips
}) => {
  const [selectedValue, setSelectedValue] = useState<string | null>(initialValue);
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);

  useEffect(() => {
    setSelectedValue(initialValue);
  }, [initialValue]);

  const handleValueChange = (value: string) => {
    const newValue = selectedValue === value ? null : value;
    setSelectedValue(newValue);
    onValueChange(newValue);
  };

  return (
    <div className="relative">
      {hoveredValue && tooltips && tooltips[hoveredValue] && (
        <div 
          className="absolute z-50 px-3 py-2 bg-zinc-800 text-white text-sm rounded-lg 
            transition-opacity duration-200 pointer-events-none whitespace-nowrap
            -translate-x-1/2 -translate-y-full -top-2 left-1/2"
        >
          {tooltips[hoveredValue]}
        </div>
      )}
      <div className="single-selector flex flex-wrap">
        {values.map((value) => (
          <div 
            key={value} 
            className="relative"
            onMouseEnter={() => setHoveredValue(value)}
            onMouseLeave={() => setHoveredValue(null)}
          >
            <div
              className={`single-selector-item mx-1 py-1 px-2 rounded mt-1 select-none ${
                selectedValue === value ? 'bg-[color:--muted-red]' : 'bg-slate-500'
              }`}
              onClick={() => handleValueChange(value)}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SingleSelector;