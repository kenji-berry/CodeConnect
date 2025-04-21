"use client";
import React, { useState } from "react";
import Link from "next/link";
import FilterSidebar from "./FilterSidebar";

export default function ProjectPageLayout({
  title,
  children,
  loading,
  filterProps,
  projectCount = 0,
}) {
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  
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
      <div className="py-4 px-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <Link href="/" className="inria-sans-bold title-red hover:underline">
            ← Back to Dashboard
          </Link>
          
          <button 
            className="md:hidden bg-[--title-red] p-2 rounded"
            onClick={() => setShowMobileSidebar(!showMobileSidebar)}
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"></path>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="flex flex-1">
        <div className={`
          w-64 border-r border-gray-800 fixed md:static h-full z-40 overflow-y-auto 
          transition-all duration-300 ease-in-out
          ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="p-4">
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
        </div>
        
        <div className="flex-1 p-6">
          <h1 className="text-3xl font-bold inter-bold mb-6">{title}</h1>
          
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
            <>
              {projectCount > 0 && <p className="mb-4 inria-sans-regular">{projectCount} projects found</p>}
              {children}
            </>
          )}
        </div>
      </div>
    </div>
  );
}