"use client";
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/supabaseClient';

export default function useProjectFilters(initialProjects = [], options = {}) {
  const {
    includeTags = false,
    numericDifficulty = false,
    defaultDifficulty = 1
  } = options;
  
  const router = useRouter();
  const searchParams = useSearchParams();

  // Filter states
  const [availableTechnologies, setAvailableTechnologies] = useState([]);
  const [availableTags, setAvailableTags] = useState([]); // Add state for available tags
  const [projects, setProjects] = useState(initialProjects);
  const [filteredProjects, setFilteredProjects] = useState(initialProjects);
  const [selectedTechnologies, setSelectedTechnologies] = useState([]);
  const [selectedContributionTypes, setSelectedContributionTypes] = useState([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState([]);
  const [selectedLastUpdated, setSelectedLastUpdated] = useState("");
  const [filterMode, setFilterMode] = useState('AND');
  const [selectedTags, setSelectedTags] = useState([]);
  
  // Load filters from URL parameters
  useEffect(() => {
    const technologies = searchParams.get("technologies")?.split(",") || [];
    const contributionTypes = searchParams.get("contributionTypes")?.split(",") || [];
    const tags = includeTags ? (searchParams.get("tags")?.split(",") || []) : [];
    const difficultiesParam = searchParams.get("difficulties");
    const lastUpdated = searchParams.get("lastUpdated") || "";
    const mode = searchParams.get("filterMode") || 'AND';

    setSelectedTechnologies(technologies.filter(Boolean));
    setSelectedContributionTypes(contributionTypes.filter(Boolean));
    setSelectedTags(tags.filter(Boolean));

    // Ensure we handle the difficulties value consistently
    let difficultiesValue = [];
    if (numericDifficulty) {
      // For numeric difficulties, parse to numbers
      difficultiesValue = difficultiesParam ? difficultiesParam.split(",").map(Number) : [];
    } else {
      // For string difficulties, use as-is
      difficultiesValue = difficultiesParam ? difficultiesParam.split(",") : [];
    }
    setSelectedDifficulties(difficultiesValue);

    setSelectedLastUpdated(lastUpdated);
    setFilterMode(mode);
  }, [searchParams, includeTags, numericDifficulty]);
  
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
  
  // Fetch available tags - New function
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const { data, error } = await supabase
          .from('tags')
          .select('id, name')
          .order('name');

        if (error) {
          console.error('Error fetching tags:', error);
          return;
        }

        if (data) {
          setAvailableTags(data.map(tag => tag.name));
        }
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      }
    };

    fetchTags();
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
    
    // Apply tag filter if enabled
    if (includeTags && selectedTags.length > 0) {
      filtered = filtered.filter(project => {
        const projectTags = project.tags || [];
        if (filterMode === 'AND') {
          return selectedTags.every(tag => projectTags.includes(tag));
        } else {
          return selectedTags.some(tag => projectTags.includes(tag));
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
    
    // Apply difficulties filter - ensure we're comparing numbers
    if (selectedDifficulties.length > 0) {
      filtered = filtered.filter(project => {
        const projectDifficulty = Number(project.difficulty_level);
        return selectedDifficulties.map(Number).includes(projectDifficulty);
      });
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
  }, [projects, selectedTechnologies, selectedContributionTypes, selectedTags, includeTags, selectedDifficulties, selectedLastUpdated, filterMode, numericDifficulty]);

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
      } else if (value !== null && value !== undefined && value !== "") {
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
  
  const handleTagsChange = (tags) => {
    setSelectedTags(tags);
    updateUrl({ tags });
  };
  
  const handleDifficultyChange = (difficulties) => {
    // Update the state first
    setSelectedDifficulties(difficulties);
    
    // Then update the URL with a consistent value
    updateUrl({ difficulties: difficulties.length > 0 ? difficulties : "" });
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
    setSelectedTags([]);
    setSelectedDifficulties([]);
    setSelectedLastUpdated("");
    setFilterMode("AND");
    router.push(`?`, { scroll: false });
  };

  return {
    availableTechnologies,
    availableTags, // Add availableTags to the return value
    selectedTechnologies,
    selectedContributionTypes,
    selectedDifficulties,
    selectedLastUpdated,
    filterMode,
    selectedTags,
    filteredProjects,
    updateProjects,
    handleTechnologiesChange,
    handleContributionTypesChange,
    handleDifficultyChange,
    handleLastUpdatedChange,
    handleFilterModeChange,
    handleTagsChange,
    clearAllFilters
  };
}