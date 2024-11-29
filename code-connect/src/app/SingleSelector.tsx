import React, { useState } from 'react';

interface SingleSelectorProps {
  values: string[];
  onValueChange: (selectedValue: string | null) => void;
}

const SingleSelector: React.FC<SingleSelectorProps> = ({ values, onValueChange }) => {
  const [selectedValue, setSelectedValue] = useState<string | null>(null);

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
          className={`single-selector-item mx-1 rounded mt-1 select-none ${selectedValue === value ? 'bg-red-700' : 'bg-slate-500'}`}
          onClick={() => handleValueChange(value)}
        >
          {value}
        </div>
      ))}
    </div>
  );
};

export default SingleSelector;