"use client";
import React, { useState, useEffect, useRef } from "react";

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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const handleSelectTag = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      const newTags = [...selectedTags, tag];
      setSelectedTags(newTags);
      onTagsChange(newTags);
    }
    setSearchTerm("");
    setIsDropdownOpen(false);
  };

  const handleRemoveTag = (tag: string) => {
    const newTags = selectedTags.filter((t) => t !== tag);
    setSelectedTags(newTags);
    onTagsChange(newTags);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setIsDropdownOpen(true);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setIsDropdownOpen(false);
  };

  const filteredTags = availableTags.filter((tag) =>
    tag.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <input
            type="text"
            className="form-input block w-full mb-2 pr-10"
            placeholder="Search..."
            value={searchTerm}
            onChange={handleSearchChange}
            onClick={() => setIsDropdownOpen((prev) => !prev)}
          />
          {searchTerm && (
            <button
              className="absolute right-0 top-1 mt-2 mr-2 text-red-600"
              onClick={handleClearSearch}
            >
              Clear
            </button>
          )}
        </div>
        {isDropdownOpen && filteredTags.length > 0 && (
          <ul className="dropdown-list absolute w-full mt-1 z-10">
            {filteredTags.map((tag) => (
              <li
                key={tag}
                onClick={() => handleSelectTag(tag)}
                className="p-2 cursor-pointer hover:bg-slate-800 bg-slate-700 text-black inter-regular"
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
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