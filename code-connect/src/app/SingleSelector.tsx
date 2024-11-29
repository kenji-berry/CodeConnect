import React, { useState, useEffect } from 'react';

interface SingleSelectorProps {
  values: string[];
  onValueChange: (selectedValue: string | null) => void;
  initialValue?: string;
}

const SingleSelector: React.FC<SingleSelectorProps> = ({ 
  values, 
  onValueChange,
  initialValue = null 
}) => {
  const [selectedValue, setSelectedValue] = useState<string | null>(initialValue);

  useEffect(() => {
    setSelectedValue(initialValue);
  }, [initialValue]);

  const handleValueChange = (value: string) => {
    const newValue = selectedValue === value ? null : value;
    setSelectedValue(newValue);
    onValueChange(newValue);
  };

  return (
    <div className="single-selector">
      {values.map((value) => (
        <div
          key={value}
          className={`single-selector-item mx-1  py-1 px-2 rounded mt-1 select-none ${selectedValue === value ? 'bg-[color:--muted-red]' : 'bg-slate-500'}`}
          onClick={() => handleValueChange(value)}
        >
          {value}
        </div>
      ))}
    </div>
  );
};

export default SingleSelector;