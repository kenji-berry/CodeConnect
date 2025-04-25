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

  const [availableTechnologies, setAvailableTechnologies] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [projects, setProjects] = useState(initialProjects);
  const [filteredProjects, setFilteredProjects] = useState(initialProjects);
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

  useEffect(() => {
    const technologies = searchParams.get("technologies")?.split(",") || [];
    const contributionTypes = searchParams.get("contributionTypes")?.split(",") || [];
    const tags = includeTags ? (searchParams.get("tags")?.split(",") || []) : [];
    const difficultiesParam = searchParams.get("difficulties");
    const lastUpdated = searchParams.get("lastUpdated") || "";
    const mode = searchParams.get("filterMode") || 'AND';
    const license = searchParams.get("license") || "";
    const mentorship = searchParams.get("mentorship") || "";
    const setupMin = searchParams.get("setupTimeMin") || "";
    const setupMax = searchParams.get("setupTimeMax") || "";

    setSelectedTechnologies(technologies.filter(Boolean));
    setSelectedContributionTypes(contributionTypes.filter(Boolean));
    setSelectedTags(tags.filter(Boolean));

    let difficultiesValue = [];
    if (numericDifficulty) {
      difficultiesValue = difficultiesParam ? difficultiesParam.split(",").map(Number) : [];
    } else {
      difficultiesValue = difficultiesParam ? difficultiesParam.split(",") : [];
    }
    setSelectedDifficulties(difficultiesValue);

    setSelectedLastUpdated(lastUpdated);
    setFilterMode(mode);
    setSelectedLicense(license);
    setSelectedMentorship(mentorship);
    setSetupTimeMin(setupMin);
    setSetupTimeMax(setupMax);
  }, [searchParams, includeTags, numericDifficulty]);

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

  useEffect(() => {
    const fetchLatestCommits = async () => {
      if (!projects || projects.length === 0) return; // Avoid fetching if no projects

      const projectIds = projects.map(p => p.id);
      if (projectIds.length === 0) return; // Avoid fetching if no IDs

      const { data: commitData, error: commitError } = await supabase
        .from('project_commits')
        .select('project_id, timestamp')
        .in('project_id', projectIds);

      if (commitError) {
        console.error('Error fetching commit timestamps:', commitError);
        return;
      }

      const latestCommitMap = {};
      if (commitData) {
        commitData.forEach(commit => {
          const ts = new Date(commit.timestamp);
          if (
            !latestCommitMap[commit.project_id] ||
            ts > latestCommitMap[commit.project_id]
          ) {
            latestCommitMap[commit.project_id] = ts;
          }
        });
      }

      // Check if commit data actually changed anything before updating state
      let needsUpdate = false;
      const projectsWithCommits = projects.map(project => {
        const last_commit_at = latestCommitMap[project.id] || null;
        if (project.last_commit_at !== last_commit_at) {
          needsUpdate = true;
        }
        return {
          ...project,
          last_commit_at,
        };
      });

      // Only update state if commit data has changed to prevent loop
      if (needsUpdate) {
        setProjects(projectsWithCommits);
      }
    };

    fetchLatestCommits();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]); // Keep dependency on projects, but logic inside prevents loop

  useEffect(() => {
    if (!projects) {
      setFilteredProjects([]);
      return;
    }

    let filtered = [...projects];

    if (selectedTechnologies.length > 0) {
      filtered = filtered.filter(project => {
        const projectTechs = (project.technologies || []).map(tech => tech.name);
        if (filterMode === 'AND') {
          return selectedTechnologies.every(tech => projectTechs.includes(tech));
        } else {
          return selectedTechnologies.some(tech => projectTechs.includes(tech));
        }
      });
    }

    if (includeTags && selectedTags.length > 0) {
      filtered = filtered.filter(project => {
        const projectTagNames = (project.tags || []).map(t => typeof t === "string" ? t : t.name);
        if (filterMode === 'AND') {
          return selectedTags.every(tag => projectTagNames.includes(tag));
        } else {
          return selectedTags.some(tag => projectTagNames.includes(tag));
        }
      });
    }

    if (selectedContributionTypes.length > 0) {
      filtered = filtered.filter(project => {
        const projectTags = (project.tags || []).map(t => typeof t === "string" ? t : t.name); // Assuming contribution types are stored as tags
        if (filterMode === 'AND') {
          return selectedContributionTypes.every(type => projectTags.includes(type));
        } else {
          return selectedContributionTypes.some(type => projectTags.includes(type));
        }
      });
    }

    if (selectedDifficulties.length > 0) {
      filtered = filtered.filter(project => {
        const projectDifficulty = numericDifficulty ? Number(project.difficulty_level) : project.difficulty_level;
        const difficultiesToCompare = numericDifficulty ? selectedDifficulties.map(Number) : selectedDifficulties;
        return difficultiesToCompare.includes(projectDifficulty);
      });
    }

    if (selectedLastUpdated) {
      const now = new Date();
      let timeLimit;

      if (selectedLastUpdated === "Last 24 hours") {
        timeLimit = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      } else if (selectedLastUpdated === "Last 7 days") {
        timeLimit = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (selectedLastUpdated === "Last 30 days") {
        timeLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      if (timeLimit) {
        filtered = filtered.filter(project =>
          project.last_commit_at && new Date(project.last_commit_at) >= timeLimit
        );
      }
    }

    if (selectedLicense) {
      filtered = filtered.filter(
        (project) => project.license === selectedLicense
      );
    }

    if (selectedMentorship) {
      filtered = filtered.filter(
        (project) =>
          (project.mentorship === true && selectedMentorship === "Yes") ||
          (project.mentorship === false && selectedMentorship === "No")
      );
    }

    if (setupTimeMin) {
      filtered = filtered.filter(
        (project) =>
          project.setup_time !== null &&
          Number(project.setup_time) >= Number(setupTimeMin)
      );
    }
    if (setupTimeMax) {
      filtered = filtered.filter(
        (project) =>
          project.setup_time !== null &&
          Number(project.setup_time) <= Number(setupTimeMax)
      );
    }

    setFilteredProjects(filtered);
  }, [
    projects,
    selectedTechnologies,
    selectedContributionTypes,
    selectedTags,
    includeTags,
    selectedDifficulties,
    selectedLastUpdated,
    filterMode,
    numericDifficulty,
    selectedLicense,
    selectedMentorship,
    setupTimeMin,
    setupTimeMax,
  ]);

  const updateProjects = useCallback((newProjects) => {
    setProjects(newProjects);
  }, []);

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
    setSelectedDifficulties(difficulties);
    updateUrl({ difficulties: difficulties.length > 0 ? difficulties.join(',') : "" });
  };

  const handleLastUpdatedChange = (lastUpdated) => {
    setSelectedLastUpdated(lastUpdated || "");
    updateUrl({ lastUpdated: lastUpdated || "" });
  };

  const handleFilterModeChange = (mode) => {
    setFilterMode(mode || "AND");
    updateUrl({ filterMode: mode || "AND" });
  };

  const handleLicenseChange = (license) => {
    setSelectedLicense(license);
    updateUrl({ license });
  };

  const handleMentorshipChange = (mentorship) => {
    setSelectedMentorship(mentorship);
    updateUrl({ mentorship });
  };

  const handleSetupTimeMinChange = (min) => {
    setSetupTimeMin(min);
    updateUrl({ setupTimeMin: min });
  };

  const handleSetupTimeMaxChange = (max) => {
    setSetupTimeMax(max);
    updateUrl({ setupTimeMax: max });
  };

  const clearAllFilters = () => {
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
  };

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
    filteredProjects,
    updateProjects,
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
  };
}