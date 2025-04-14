"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";

interface MultiSelectorProps {
  availableTags: string[];
  onTagsChange: (tags: string[]) => void;
  initialTags?: string[];
  nonRemovableTags?: string[];
}

const MultiSelector: React.FC<MultiSelectorProps> = ({
  availableTags = [],
  onTagsChange,
  initialTags = [],
  nonRemovableTags = []
}) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([
    ...new Set([...initialTags, ...nonRemovableTags])
  ]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Update selectedTags when initialTags or nonRemovableTags change
  useEffect(() => {
    const newSelectedTags = [...new Set([...initialTags, ...nonRemovableTags])];
    if (JSON.stringify(newSelectedTags) !== JSON.stringify(selectedTags)) {
      setSelectedTags(newSelectedTags);
    }
  }, [initialTags, nonRemovableTags]);

  // Filter available tags based on search term using useMemo with null checks
  const filteredTags = useMemo(() => {
    return (availableTags || [])
      .filter((tag): tag is string =>
        typeof tag === 'string' && tag !== null && tag !== undefined)
      .filter(tag =>
        tag.toLowerCase().includes((searchTerm || "").toLowerCase()) &&
        !selectedTags.includes(tag)
      );
  }, [availableTags, searchTerm, selectedTags]);

  const handleTagChange = (tag: string) => {
    if (selectedTags.includes(tag)) {
      if (!nonRemovableTags.includes(tag)) {
        const newTags = selectedTags.filter((t) => t !== tag);
        setSelectedTags(newTags);
        onTagsChange(newTags);
      }
    } else {
      const newTags = [...selectedTags, tag];
      setSelectedTags(newTags);
      onTagsChange(newTags);
    }
    setSearchTerm("");
    setIsDropdownOpen(false);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setIsDropdownOpen(true);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setIsDropdownOpen(false);
  };

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
            className="form-input block w-full mb-2 pr-10 rounded-md border-2 border-slate-600 
                      bg-magenta-dark text-black placeholder-gray-500 
                      focus:border-orange focus:outline-none focus:ring-1 focus:ring-orange 
                      transition-colors py-1.5 px-3"
            placeholder="Search tags..."
            value={searchTerm}
            onChange={handleSearchChange}
            onClick={() => setIsDropdownOpen(true)}
          />
          {searchTerm && (
            <button
              className="absolute right-0 top-0 h-full px-3 text-slate-800 hover:text-muted-red transition-colors"
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
        {isDropdownOpen && filteredTags.length > 0 && (
          <ul className="dropdown-list absolute w-full mt-1 z-10 max-h-48 overflow-y-auto 
                      rounded-md border border-slate-600 bg-slate-200 shadow-lg">
            {filteredTags.map((tag) => (
              <li
                key={`available-${tag}`}
                onClick={() => handleTagChange(tag)}
                className="p-2 cursor-pointer hover:bg-slate-300 text-black inter-regular 
                          border-b border-slate-400 last:border-b-0 transition-colors"
              >
                {tag.toUpperCase()}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="selected-tags mt-2 flex flex-wrap gap-1.5">
        {selectedTags.map((tag) => (
          <button
            key={`selected-${tag}`}
            className={`tag-item flex items-center py-1.5 px-2.5 rounded text-sm font-medium transition-colors
                      ${nonRemovableTags.includes(tag)
                ? 'bg-title-red text-black cursor-default'
                : 'bg-slate-300 hover:bg-muted-red text-black'}`}
            onClick={() => handleTagChange(tag)}
            disabled={nonRemovableTags.includes(tag)}
          >
            <span>{tag.toUpperCase()}</span>
            {!nonRemovableTags.includes(tag) && (
              <span className="ml-1.5 text-sm opacity-80 hover:opacity-100">×</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default MultiSelector;