"use client";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/supabaseClient';

export default function useProjectFilters(options = {}) {
  const {
    includeTags = false,
    numericDifficulty = false,
  } = options;

  const router = useRouter();
  const searchParams = useSearchParams();

  const [availableTechnologies, setAvailableTechnologies] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);

  const [selectedTechnologies, setSelectedTechnologies] = useState([]);
  const [selectedContributionTypes, setSelectedContributionTypes] = useState([]);
  const [selectedDifficulties, setSelectedDifficulties] = useState([]);
  const [selectedLastUpdated, setSelectedLastUpdated] = useState("");
  const [filterMode, setFilterMode] = useState('AND');
  const [selectedTags, setSelectedTags] = useState([]);
  const [selectedLicense, setSelectedLicense] = useState("");
  const [selectedMentorship, setSelectedMentorship] = useState("");
  const [setupTimeMin, setSetupTimeMin] = useState("");
  const [setupTimeMax, setSetupTimeMax] = useState("");

  const isInitialSyncDone = useRef(false);

  useEffect(() => {
    const urlTechnologies = searchParams.get("technologies")?.split(",").filter(Boolean) || [];
    const urlContributionTypes = searchParams.get("contributionTypes")?.split(",").filter(Boolean) || [];
    const urlTags = includeTags ? (searchParams.get("tags")?.split(",").filter(Boolean) || []) : [];
    const urlDifficultiesParam = searchParams.get("difficulties");
    const urlLastUpdated = searchParams.get("lastUpdated") || "";
    const urlMode = searchParams.get("filterMode") || 'AND';
    const urlLicense = searchParams.get("license") || "";
    const urlMentorship = searchParams.get("mentorship") || "";
    const urlSetupMin = searchParams.get("setupTimeMin") || "";
    const urlSetupMax = searchParams.get("setupTimeMax") || "";

    let urlDifficultiesValue = [];
    if (urlDifficultiesParam) {
        urlDifficultiesValue = numericDifficulty
            ? urlDifficultiesParam.split(",").map(Number).filter(n => !isNaN(n))
            : urlDifficultiesParam.split(",").filter(Boolean);
    }

    if (JSON.stringify(urlTechnologies) !== JSON.stringify(selectedTechnologies)) {
      setSelectedTechnologies(urlTechnologies);
    }
    if (JSON.stringify(urlContributionTypes) !== JSON.stringify(selectedContributionTypes)) {
      setSelectedContributionTypes(urlContributionTypes);
    }
    if (includeTags && JSON.stringify(urlTags) !== JSON.stringify(selectedTags)) {
      setSelectedTags(urlTags);
    }
    if (JSON.stringify(urlDifficultiesValue) !== JSON.stringify(selectedDifficulties)) {
        setSelectedDifficulties(urlDifficultiesValue);
    }
    if (urlLastUpdated !== selectedLastUpdated) {
      setSelectedLastUpdated(urlLastUpdated);
    }
    if (urlMode !== filterMode) {
      setFilterMode(urlMode);
    }
    if (urlLicense !== selectedLicense) {
      setSelectedLicense(urlLicense);
    }
    if (urlMentorship !== selectedMentorship) {
      setSelectedMentorship(urlMentorship);
    }
    if (urlSetupMin !== setupTimeMin) {
      setSetupTimeMin(urlSetupMin);
    }
    if (urlSetupMax !== setupTimeMax) {
      setSetupTimeMax(urlSetupMax);
    }

    isInitialSyncDone.current = true;

  }, [searchParams, includeTags, numericDifficulty, selectedTechnologies, selectedContributionTypes, selectedTags, selectedDifficulties, selectedLastUpdated, filterMode, selectedLicense, selectedMentorship, setupTimeMin, setupTimeMax]);

  useEffect(() => {
    const fetchTechnologies = async () => {
      try {
        const { data, error } = await supabase
          .from('technologies')
          .select('id, name')
          .order('name');
        if (error) throw error;
        if (data) setAvailableTechnologies(data.map(tech => tech.name));
      } catch (error) {
        console.error('Failed to fetch technologies:', error);
      }
    };
    fetchTechnologies();
  }, []);

  useEffect(() => {
    if (!includeTags) return;
    const fetchTags = async () => {
      try {
        const { data, error } = await supabase
          .from('tags')
          .select('id, name')
          .order('name');
        if (error) throw error;
        if (data) setAvailableTags(data.map(tag => tag.name));
      } catch (error) {
        console.error('Failed to fetch tags:', error);
      }
    };
    fetchTags();
  }, [includeTags]);

  const updateUrl = useCallback((params) => {
     const urlParams = new URLSearchParams(searchParams);
     Object.entries(params).forEach(([key, value]) => {
       urlParams.delete('page');
       if (Array.isArray(value) && value.length > 0) {
           urlParams.set(key, value.join(","));
       } else if (Array.isArray(value) && value.length === 0) {
           urlParams.delete(key);
       } else if (value !== null && value !== undefined && value !== "") {
           urlParams.set(key, String(value));
       } else {
           urlParams.delete(key);
       }
     });
     router.push(`?${urlParams.toString()}`, { scroll: false });
  }, [router, searchParams]);

  const handleTechnologiesChange = useCallback((techs) => {
    setSelectedTechnologies(techs);
    updateUrl({ technologies: techs });
  }, [updateUrl]);

  const handleContributionTypesChange = useCallback((types) => {
    setSelectedContributionTypes(types);
    updateUrl({ contributionTypes: types });
  }, [updateUrl]);

  const handleTagsChange = useCallback((tags) => {
    setSelectedTags(tags);
    updateUrl({ tags });
  }, [updateUrl]);

  const handleDifficultyChange = useCallback((difficulties) => {
    setSelectedDifficulties(difficulties);
    updateUrl({ difficulties: difficulties });
  }, [updateUrl]);

  const handleLastUpdatedChange = useCallback((lastUpdated) => {
    setSelectedLastUpdated(lastUpdated || "");
    updateUrl({ lastUpdated: lastUpdated || "" });
  }, [updateUrl]);

  const handleFilterModeChange = useCallback((mode) => {
    setFilterMode(mode || "AND");
    updateUrl({ filterMode: mode || "AND" });
  }, [updateUrl]);

  const handleLicenseChange = useCallback((license) => {
    setSelectedLicense(license);
    updateUrl({ license });
  }, [updateUrl]);

  const handleMentorshipChange = useCallback((mentorship) => {
    setSelectedMentorship(mentorship);
    updateUrl({ mentorship });
  }, [updateUrl]);

  const handleSetupTimeMinChange = useCallback((min) => {
    setSetupTimeMin(min);
    updateUrl({ setupTimeMin: min });
  }, [updateUrl]);

  const handleSetupTimeMaxChange = useCallback((max) => {
    setSetupTimeMax(max);
    updateUrl({ setupTimeMax: max });
  }, [updateUrl]);

  const clearAllFilters = useCallback(() => {
    setSelectedTechnologies([]);
    setSelectedContributionTypes([]);
    setSelectedTags([]);
    setSelectedDifficulties([]);
    setSelectedLastUpdated("");
    setFilterMode("AND");
    setSelectedLicense("");
    setSelectedMentorship("");
    setSetupTimeMin("");
    setSetupTimeMax("");
    router.push(`?`, { scroll: false });
  }, [router]);

  return {
    availableTechnologies,
    availableTags,
    selectedTechnologies,
    selectedContributionTypes,
    selectedDifficulties,
    selectedLastUpdated,
    filterMode,
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
    clearAllFilters,
    numericDifficulty
  };
}