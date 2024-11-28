"use client";
import React, { useState } from "react";

interface MultiSelectorProps {
  availableTags: string[];
  onTagsChange: (tags: string[]) => void;
}

const MultiSelector: React.FC<MultiSelectorProps> = ({ availableTags, onTagsChange }) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleDoubleClick = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      const newTags = [...selectedTags, tag];
      setSelectedTags(newTags);
      onTagsChange(newTags);
    }
  };

  const handleRemoveTag = (tag: string) => {
    const newTags = selectedTags.filter(t => t !== tag);
    setSelectedTags(newTags);
    onTagsChange(newTags);
  };

  return (
    <div>
      <div className="available-tags">
        <select multiple className="form-multiselect block w-full mt-1" size={availableTags.length}>
          {availableTags.map(tag => (
            <option key={tag} value={tag} onDoubleClick={() => handleDoubleClick(tag)}>
              {tag}
            </option>
          ))}
        </select>
      </div>
      <div className="selected-tags mt-4">
        {selectedTags.map(tag => (
          <div key={tag} className="tag-item selected-tag flex items-center p-2 m-1 bg-blue-200 rounded">
            {tag}
            <button
              onClick={() => handleRemoveTag(tag)}
              className="ml-2 text-red-500"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MultiSelector;