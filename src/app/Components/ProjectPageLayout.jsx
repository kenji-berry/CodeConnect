"use client";
import React from "react";
import Link from "next/link";
import FilterSidebar from "./FilterSidebar";

export default function ProjectPageLayout({
  title,
  children,
  loading,
  filterProps,
  projectCount = 0,
  sortOption,
  onSortChange,
  availableSortOptions = [],
}) {

  const {
    availableTechnologies,
    selectedTechnologies,
    selectedContributionTypes,
    selectedDifficulties,
    selectedLastUpdated,
    filterMode,
    availableTags,
    selectedTags,
    selectedLicense,
    selectedMentorship,
    setupTimeMin,
    setupTimeMax,
    handleTechnologiesChange,
    handleContributionTypesChange,
    handleDifficultyChange,
    handleLastUpdatedChange,
    handleFilterModeChange,
    handleTagsChange,
    handleLicenseChange,
    handleMentorshipChange,
    handleSetupTimeMinChange,
    handleSetupTimeMaxChange,
    clearAllFilters
  } = filterProps;


  return (
    <div className="flex flex-col min-h-screen">
      {/* Header Section */}
      <div className="py-4 px-6 border-b border-gray-800">
        <div className="flex items-center justify-between flex-wrap gap-4">
          {/* Back Link */}
          <Link href="/" className="inria-sans-bold title-red hover:underline">
            ← Back to Dashboard
          </Link>

          {/* Sort Dropdown */}
          {onSortChange && availableSortOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <label htmlFor="sort-select" className="text-sm text-gray-400">Sort by:</label>
              <select
                id="sort-select"
                value={sortOption}
                onChange={(e) => onSortChange(e.target.value)}
                className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-1.5"
              >
                {availableSortOptions.map(option => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col md:flex-row flex-1">

        {/* Filter Sidebar */}
        <div className="w-full md:w-64 md:border-r md:border-gray-800 p-4 md:sticky md:top-0 md:h-screen md:overflow-y-auto">
          <FilterSidebar
            availableTechnologies={availableTechnologies}
            selectedTechnologies={selectedTechnologies}
            onTechnologiesChange={handleTechnologiesChange}
            selectedContributionTypes={selectedContributionTypes}
            onContributionTypesChange={handleContributionTypesChange}
            selectedDifficulties={selectedDifficulties}
            onDifficultiesChange={handleDifficultyChange}
            selectedLastUpdated={selectedLastUpdated}
            onLastUpdatedChange={handleLastUpdatedChange}
            filterMode={filterMode}
            onFilterModeChange={handleFilterModeChange}
            availableTags={availableTags}
            selectedTags={selectedTags}
            onTagsChange={handleTagsChange}
            selectedLicense={selectedLicense}
            onLicenseChange={handleLicenseChange}
            selectedMentorship={selectedMentorship}
            onMentorshipChange={handleMentorshipChange}
            setupTimeMin={setupTimeMin}
            setupTimeMax={setupTimeMax}
            onSetupTimeMinChange={handleSetupTimeMinChange}
            onSetupTimeMaxChange={handleSetupTimeMaxChange}
            onClearFilters={clearAllFilters}
          />
        </div>

        {/* Project List Area */}
        <div className="flex-1 p-6">
          <h1 className="text-3xl font-bold inter-bold mb-2">{title}</h1>
          {!loading && projectCount > 0 && (
             <p className="mb-4 inria-sans-regular text-gray-400">{projectCount} projects found</p>
          )}
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="mb-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
                </div>
                <p>Loading {title.toLowerCase()}...</p>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}