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
  className = "",
  selectedLicense = "",
  onLicenseChange,
  selectedMentorship = "",
  onMentorshipChange,
  setupTimeMin = "",
  setupTimeMax = "",
  onSetupTimeMinChange,
  onSetupTimeMaxChange
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

  const licenseOptions = [
    "MIT",
    "Apache-2.0",
    "GPL-3.0",
    "BSD-3-Clause",
    "Unlicense",
    "Other"
  ];

  const mentorshipOptions = ["Yes", "No"];

  const minSetup = 1;
  const maxSetup = 1440; // 24 hours, adjust as needed

  const sliderMin = Number(setupTimeMin) || minSetup;
  const sliderMax = Number(setupTimeMax) || maxSetup;

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

        <div>
          <p className="mb-2">License:</p>
          <SingleSelector
            values={licenseOptions}
            onValueChange={(value) => {
              if (onLicenseChange) {
                onLicenseChange(value);
              }
            }}
            initialValue={selectedLicense}
          />
        </div>

        <div>
          <p className="mb-2">Mentorship:</p>
          <SingleSelector
            values={mentorshipOptions}
            onValueChange={(value) => {
              if (onMentorshipChange) {
                onMentorshipChange(value);
              }
            }}
            initialValue={selectedMentorship}
          />
        </div>

        <div>
          <p className="mb-2">Setup Time (min):</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Min"
              value={setupTimeMin}
              onChange={e => {
                const numericValue = e.target.value.replace(/\D/g, '');
                onSetupTimeMinChange && onSetupTimeMinChange(numericValue);
              }}
              className="w-16 p-1 rounded border border-gray-300 text-black"
            />
            <span className="mx-2 text-gray-400">—</span>
            <input
              type="text"
              placeholder="Max"
              value={setupTimeMax}
              onChange={e => {
                const numericValue = e.target.value.replace(/\D/g, '');
                onSetupTimeMaxChange && onSetupTimeMaxChange(numericValue);
              }}
              className="w-16 p-1 rounded border border-gray-300 text-black"
            />
          </div>
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