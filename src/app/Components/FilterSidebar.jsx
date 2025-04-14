"use client";
import React from "react";
import MultiSelector from "./MultiSelector";
import SingleSelector from "./SingleSelector";
import MultiDifficultySelector from "./MultiDifficultySelector";

export default function FilterSidebar({
  availableTechnologies = [],
  selectedTechnologies = [],
  onTechnologiesChange,
  selectedContributionTypes = [],
  onContributionTypesChange,
  selectedDifficulties = [],
  onDifficultiesChange,
  selectedLastUpdated = "",
  onLastUpdatedChange,
  filterMode = "AND",
  onFilterModeChange,
  availableTags = [],
  selectedTags = [],
  onTagsChange,
  onClearFilters,
  className = ""
}) {
  // Filter options
  const contributionTypes = [
    "Documentation",
    "Design",
    "Testing",
    "Code",
    "Translation",
  ];

  const lastUpdated = ["Last 24 hours", "Last 7 days", "Last 30 days"];

  return (
    <div className={`filter-sidebar ${className}`}>
      <h3 className="inter-bold text-xl mb-4">Filters</h3>
      
      <div className="main-page-filter-box radial-background px-3 py-4 inria-sans-bold flex flex-col gap-4">
        <div>
          <p className="mb-2">Technologies/Languages:</p>
          <MultiSelector
            availableTags={availableTechnologies}
            onTagsChange={onTechnologiesChange}
            initialTags={selectedTechnologies}
          />
        </div>
        
        <div>
          <p className="mb-2">Tags:</p>
          <MultiSelector
            availableTags={availableTags}
            onTagsChange={onTagsChange}
            initialTags={selectedTags}
          />
        </div>
        
        <div>
          <p className="mb-2">Contribution Type:</p>
          <MultiSelector
            availableTags={contributionTypes}
            onTagsChange={onContributionTypesChange}
            initialTags={selectedContributionTypes}
          />
        </div>
        
        <div>
          <p className="mb-2">Difficulty:</p>
          <MultiDifficultySelector
            onDifficultiesChange={onDifficultiesChange} 
            selectedDifficulties={selectedDifficulties}
          />
        </div>
        
        <div>
          <p className="mb-2">Last Updated:</p>
          <SingleSelector
            values={lastUpdated}
            onValueChange={onLastUpdatedChange}
            initialValue={selectedLastUpdated}
          />
        </div>
        
        <div>
          <p className="mb-2">Filter Mode:</p>
          <SingleSelector
            values={['AND', 'OR']}
            onValueChange={onFilterModeChange}
            initialValue={filterMode}
          />
        </div>
        
        <div className="mt-2">
          <button 
            onClick={onClearFilters} 
            className="flex items-center py-1.5 px-3 bg-red-700 hover:bg-red-900 rounded transition w-full justify-center"
          >
            Clear All Filters
          </button>
        </div>
      </div>
    </div>
  );
}