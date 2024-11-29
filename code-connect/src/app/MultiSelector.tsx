"use client";
import React, { useState } from "react";

interface MultiSelectorProps {
  availableTags: string[];
  onTagsChange: (tags: string[]) => void;
}

const MultiSelector: React.FC<MultiSelectorProps> = ({
  availableTags,
  onTagsChange,
}) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const handleDoubleClick = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      const newTags = [...selectedTags, tag];
      setSelectedTags(newTags);
      onTagsChange(newTags);
    }
  };

  const handleRemoveTag = (tag: string) => {
    const newTags = selectedTags.filter((t) => t !== tag);
    setSelectedTags(newTags);
    onTagsChange(newTags);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const clearSearch = () => {
    setSearchTerm("");
  };

  const filteredTags = availableTags.filter((tag) =>
    tag.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <div className="available-tags">
        <div className="relative">
          <input
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="form-input block w-full px-1 rounded-t"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-red-700 text-xs"
            >
              CLEAR
            </button>
          )}
        </div>
        <select
          multiple
          className="form-multiselect block w-full custom-select"
          size={5}
        >
          {filteredTags.map((tag) => (
            <option
              key={tag}
              value={tag}
              onDoubleClick={() => handleDoubleClick(tag)}
            >
              {tag}
            </option>
          ))}
        </select>
      </div>
      <div className="selected-tags mt-1">
        {selectedTags.map((tag) => (
          <button
            key={tag}
            className="tag-item selected-tag flex items-center py-1 px-2 m-1 bg-slate-500 rounded hover:bg-red-700"
            onClick={() => handleRemoveTag(tag)}
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MultiSelector;
