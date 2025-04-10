"use client";
import React, { useState, useEffect, useRef, useMemo } from "react";

interface HighlightableMultiSelectorProps {
  availableTags: string[];
  onTagsChange: (tags: string[]) => void;
  initialTags?: string[];
  nonRemovableTags?: string[];
  highlightedTags: string[];
  onHighlightedTagsChange: (highlighted: string[]) => void;
}

const HighlightableMultiSelector: React.FC<HighlightableMultiSelectorProps> = ({
  availableTags = [],
  onTagsChange,
  initialTags = [],
  nonRemovableTags = [],
  highlightedTags,
  onHighlightedTagsChange
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
  }, [initialTags, nonRemovableTags, selectedTags]);

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
        onHighlightedTagsChange(highlightedTags.filter((t) => t !== tag));
      }
    } else {
      const newTags = [...selectedTags, tag];
      setSelectedTags(newTags);
      onTagsChange(newTags);
    }
    setSearchTerm("");
    setIsDropdownOpen(false);
  };

  const handleHighlightChange = (e: React.MouseEvent, tag: string) => {
    e.preventDefault(); // Prevent default button behavior
    e.stopPropagation(); // Stop event from bubbling up to form
  
    if (highlightedTags.includes(tag)) {
      onHighlightedTagsChange(highlightedTags.filter((t) => t !== tag));
    } else if (highlightedTags.length < 3) {
      onHighlightedTagsChange([...highlightedTags, tag]);
    }
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
            className="form-input block w-full mb-2 pr-10 main-input"
            placeholder="Search..."
            value={searchTerm}
            onChange={handleSearchChange}
            onClick={() => setIsDropdownOpen(true)}
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
                key={`available-${tag}`}
                onClick={() => handleTagChange(tag)}
                className="p-2 cursor-pointer hover:bg-slate-800 bg-slate-700 text-black inter-regular text-uppercase"
              >
                {tag.toUpperCase()}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="selected-tags mt-1">
        {selectedTags.map((tag) => (
          <div
            key={`selected-${tag}`}
            className={`tag-item selected-tag flex items-center py-1 px-2 m-1 rounded text-uppercase transition-colors duration-300 ${
              nonRemovableTags.includes(tag)
                ? 'bg-blue-500 hover:bg-blue-700'
                : highlightedTags.includes(tag)
                ? 'bg-yellow-500 hover:bg-yellow-400'
                : 'bg-slate-500 hover:bg-slate-600'
            }`}
          >
            <span className="flex-1">{tag.toUpperCase()}</span>
            <button
              className="ml-2 text-white transition-transform duration-300 transform hover:scale-125"
              onClick={(e) => handleHighlightChange(e, tag)}
              type="button" // Add this to explicitly prevent form submission
            >
              {highlightedTags.includes(tag) ? '★' : '☆'}
            </button>
            {!nonRemovableTags.includes(tag) && (
              <button
                className="ml-2 text-white transition-transform duration-300 transform hover:scale-125"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleTagChange(tag);
                }}
                type="button" // Add this to explicitly prevent form submission
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HighlightableMultiSelector;