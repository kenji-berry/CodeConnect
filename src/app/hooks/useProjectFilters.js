"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/supabaseClient';

export default function useProjectFilters(initialProjects = []) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter states
  const [availableTechnologies, setAvailableTechnologies] = useState([]);
  const [projects, setProjects] = useState(initialProjects);
  const [filteredProjects, setFilteredProjects] = useState(initialProjects);
  const [selectedTechnologies, setSelectedTechnologies] = useState([]);
  const [selectedContributionTypes, setSelectedContributionTypes] = useState([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [selectedLastUpdated, setSelectedLastUpdated] = useState("");
  const [filterMode, setFilterMode] = useState('AND');
  
  // Load filters from URL parameters
  useEffect(() => {
    const technologies = searchParams.get("technologies")?.split(",") || [];
    const contributionTypes = searchParams.get("contributionTypes")?.split(",") || [];
    const difficulty = searchParams.get("difficulty") || "";
    const lastUpdated = searchParams.get("lastUpdated") || "";
    const mode = searchParams.get("filterMode") || 'AND';

    setSelectedTechnologies(technologies.filter(Boolean));
    setSelectedContributionTypes(contributionTypes.filter(Boolean));
    setSelectedDifficulty(difficulty);
    setSelectedLastUpdated(lastUpdated);
    setFilterMode(mode);
  }, [searchParams]);
  
  // Fetch available technologies
  useEffect(() => {
    const fetchTechnologies = async () => {
      try {
        const { data, error } = await supabase
          .from('technologies')
          .select('id, name')
          .order('name');

        if (error) {
          console.error('Error fetching technologies:', error);
          return;
        }

        if (data) {
          setAvailableTechnologies(data.map(tech => tech.name));
        }
      } catch (error) {
        console.error('Failed to fetch technologies:', error);
      }
    };

    fetchTechnologies();
  }, []);
  
  // Apply filters when filter state or projects change
  useEffect(() => {
    if (!projects.length) return;
    
    let filtered = [...projects];
    
    // Apply technology filter
    if (selectedTechnologies.length > 0) {
      filtered = filtered.filter(project => {
        const projectTechs = project.technologies.map(tech => tech.name);
        if (filterMode === 'AND') {
          return selectedTechnologies.every(tech => projectTechs.includes(tech));
        } else {
          return selectedTechnologies.some(tech => projectTechs.includes(tech));
        }
      });
    }
    
    // Apply contribution type filter
    if (selectedContributionTypes.length > 0) {
      filtered = filtered.filter(project => {
        const projectTags = project.tags || [];
        if (filterMode === 'AND') {
          return selectedContributionTypes.every(type => projectTags.includes(type));
        } else {
          return selectedContributionTypes.some(type => projectTags.includes(type));
        }
      });
    }
    
    // Apply difficulty filter
    if (selectedDifficulty) {
      filtered = filtered.filter(project => 
        project.difficulty_level === selectedDifficulty
      );
    }
    
    // Apply lastUpdated filter
    if (selectedLastUpdated) {
      const now = new Date();
      let timeLimit;
      
      if (selectedLastUpdated === "Last 24 hours") {
        timeLimit = new Date(now.setDate(now.getDate() - 1));
      } else if (selectedLastUpdated === "Last 7 days") {
        timeLimit = new Date(now.setDate(now.getDate() - 7));
      } else if (selectedLastUpdated === "Last 30 days") {
        timeLimit = new Date(now.setDate(now.getDate() - 30));
      }
      
      if (timeLimit) {
        filtered = filtered.filter(project => 
          new Date(project.created_at) >= timeLimit
        );
      }
    }
    
    setFilteredProjects(filtered);
  }, [projects, selectedTechnologies, selectedContributionTypes, selectedDifficulty, selectedLastUpdated, filterMode]);

  // Memoize updateProjects to prevent unnecessary re-renders
  const updateProjects = useCallback((newProjects) => {
    setProjects(newProjects);
    setFilteredProjects(newProjects);
  }, []);
  
  // Update URL when filters change
  const updateUrl = (params) => {
    const urlParams = new URLSearchParams(searchParams);
    
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length > 0) {
        urlParams.set(key, value.join(","));
      } else if (Array.isArray(value) && value.length === 0) {
        urlParams.delete(key);
      } else if (value) {
        urlParams.set(key, value);
      } else {
        urlParams.delete(key);
      }
    });
    
    router.push(`?${urlParams.toString()}`, { scroll: false });
  };
  
  // Filter handlers
  const handleTechnologiesChange = (techs) => {
    setSelectedTechnologies(techs);
    updateUrl({ technologies: techs });
  };
  
  const handleContributionTypesChange = (types) => {
    setSelectedContributionTypes(types);
    updateUrl({ contributionTypes: types });
  };
  
  const handleDifficultyChange = (difficulty) => {
    setSelectedDifficulty(difficulty || "");
    updateUrl({ difficulty: difficulty || "" });
  };
  
  const handleLastUpdatedChange = (lastUpdated) => {
    setSelectedLastUpdated(lastUpdated || "");
    updateUrl({ lastUpdated: lastUpdated || "" });
  };
  
  const handleFilterModeChange = (mode) => {
    setFilterMode(mode || "AND");
    updateUrl({ filterMode: mode || "AND" });
  };
  
  const clearAllFilters = () => {
    setSelectedTechnologies([]);
    setSelectedContributionTypes([]);
    setSelectedDifficulty("");
    setSelectedLastUpdated("");
    setFilterMode("AND");
    router.push(`?`, { scroll: false });
  };

  return {
    availableTechnologies,
    selectedTechnologies,
    selectedContributionTypes,
    selectedDifficulty,
    selectedLastUpdated,
    filterMode,
    filteredProjects,
    updateProjects,
    handleTechnologiesChange,
    handleContributionTypesChange,
    handleDifficultyChange,
    handleLastUpdatedChange,
    handleFilterModeChange,
    clearAllFilters
  };
}