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

  useEffect(() => {
    const newSelectedTags = [...new Set([...initialTags, ...nonRemovableTags])];
    if (JSON.stringify(newSelectedTags) !== JSON.stringify(selectedTags)) {
      setSelectedTags(newSelectedTags);
    }
  }, [initialTags, nonRemovableTags]);

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
    <div className="relative w-full max-w-xl">
      <div className="relative" ref={dropdownRef}>
        <div className="relative">
          <input
            type="text"
            className="form-input block w-full mb-2 pr-10 rounded-xl border-2 border-[var(--orange)] 
              bg-[#232323] text-[var(--off-white)] placeholder-gray-400
              focus:border-[var(--title-red)] focus:outline-none focus:ring-2 focus:ring-[var(--title-red)]
              transition-colors py-2 px-4 shadow-sm"
            placeholder="Search tags..."
            value={searchTerm}
            onChange={handleSearchChange}
            onClick={() => setIsDropdownOpen(true)}
            aria-label="Search tags"
          />
          {searchTerm && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center text-[var(--orange)] hover:text-[var(--title-red)] transition-colors rounded-full bg-[#18181b] focus:outline-none focus:ring-2 focus:ring-[var(--title-red)]"
              onClick={handleClearSearch}
              aria-label="Clear search"
              type="button"
            >
              ×
            </button>
          )}
        </div>
        {isDropdownOpen && filteredTags.length > 0 && (
          <ul className="dropdown-list absolute w-full mt-1 z-20 max-h-56 overflow-y-auto 
            rounded-xl border-2 border-[var(--orange)] bg-[#232323] shadow-2xl">
            {filteredTags.map((tag) => (
              <li
                key={`available-${tag}`}
                onClick={() => handleTagChange(tag)}
                className="p-3 cursor-pointer hover:bg-[var(--orange)] hover:text-black text-[var(--off-white)] font-semibold
                  border-b border-[#232323] last:border-b-0 transition-all rounded-xl"
                tabIndex={0}
                onKeyDown={e => (e.key === "Enter" || e.key === " ") && handleTagChange(tag)}
                aria-label={`Add tag ${tag}`}
              >
                {tag.toUpperCase()}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="selected-tags mt-4 flex flex-wrap gap-2">
        {selectedTags.map((tag) => (
          <span
            key={`selected-${tag}`}
            className={`tag-item flex items-center py-1.5 px-3 rounded-full text-sm font-bold transition-all
              shadow-sm border-2
              ${nonRemovableTags.includes(tag)
                ? 'bg-[var(--title-red)] border-[var(--title-red)] text-black cursor-default'
                : 'bg-[var(--orange)] border-[var(--orange)] text-white hover:bg-[var(--title-red)] hover:border-[var(--title-red)] hover:text-black'}`}
            tabIndex={0}
            aria-label={nonRemovableTags.includes(tag) ? `${tag} (locked)` : `Remove tag ${tag}`}
          >
            <span className="truncate max-w-[120px]">{tag.toUpperCase()}</span>
            {!nonRemovableTags.includes(tag) && (
              <button
                type="button"
                onClick={() => handleTagChange(tag)}
                className="ml-2 text-base opacity-80 hover:opacity-100 transition-opacity focus:outline-none"
                aria-label={`Remove tag ${tag}`}
                tabIndex={-1}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
};

export default MultiSelector;