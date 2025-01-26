"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CodeConnectTitle from "./Components/CodeConnectTitle";
import ProjectPreview from "./Components/ProjectPreview";
import MultiSelector from "./Components/MultiSelector";
import SingleSelector from "./Components/SingleSelector";
import { supabase } from '@/supabaseClient';

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>([]);
  const [selectedContributionTypes, setSelectedContributionTypes] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("");
  const [selectedLastUpdated, setSelectedLastUpdated] = useState<string>("");
  const [filterMode, setFilterMode] = useState<string>('AND');
  const [user, setUser] = useState<{ email: string } | null>(null);

  useEffect(() => {
    const languages = searchParams.get("languages")?.split(",") || [];
    const technologies = searchParams.get("technologies")?.split(",") || [];
    const contributionTypes = searchParams.get("contributionTypes")?.split(",") || [];
    const difficulty = searchParams.get("difficulty") || "";
    const lastUpdated = searchParams.get("lastUpdated") || "";
    const mode = searchParams.get("filterMode") || 'AND';

    setSelectedLanguages(languages.filter(Boolean));
    setSelectedTechnologies(technologies.filter(Boolean));
    setSelectedContributionTypes(contributionTypes.filter(Boolean));
    setSelectedDifficulty(difficulty);
    setSelectedLastUpdated(lastUpdated);
    setFilterMode(mode);
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (selectedLanguages.length > 0) {
      params.append("languages", selectedLanguages.join(","));
    }
    if (selectedTechnologies.length > 0) {
      params.append("technologies", selectedTechnologies.join(","));
    }
    if (selectedContributionTypes.length > 0) {
      params.append("contributionTypes", selectedContributionTypes.join(","));
    }
    if (selectedDifficulty) {
      params.append("difficulty", selectedDifficulty);
    }
    if (selectedLastUpdated) {
      params.append("lastUpdated", selectedLastUpdated);
    }
    params.append("filterMode", filterMode);

    router.push(`?${params.toString()}`, { scroll: false });
  }, [
    selectedLanguages,
    selectedTechnologies,
    selectedContributionTypes,
    selectedDifficulty,
    selectedLastUpdated,
    filterMode,
    router
  ]);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user && session.user.email ? { email: session.user.email } : null);
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user && session.user.email ? { email: session.user.email } : null);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const handleTagsChange = (type: string, tags: string[]) => {
    switch (type) {
      case "languages":
        setSelectedLanguages(tags);
        break;
      case "technologies":
        setSelectedTechnologies(tags);
        break;
      case "contributionTypes":
        setSelectedContributionTypes(tags);
        break;
      default:
        break;
    }
  };

  const handleValueChange = (type: string, value: string) => {
    switch (type) {
      case "difficulty":
        setSelectedDifficulty(value);
        break;
      case "lastUpdated":
        setSelectedLastUpdated(value);
        break;
      case "filterMode":
        setFilterMode(value);
        break;
      default:
        break;
    }
  };

  const clearAllFilters = () => {
    setSelectedLanguages([]);
    setSelectedTechnologies([]);
    setSelectedContributionTypes([]);
    setSelectedDifficulty("");
    setSelectedLastUpdated("");
    setFilterMode('AND');
    router.push(`?`, { scroll: false });
  };

  const languages = [
    "Ada",
    "APL",
    "Assembly",
    "Bash",
    "C",
    "C#",
    "C++",
    "COBOL",
    "CSS",
    "D",
    "Dart",
    "Elixir",
    "Erlang",
    "F#",
    "Fortran",
    "Go",
    "Groovy",
    "Haskell",
    "HTML",
    "Java",
    "JavaScript",
    "Julia",
    "Kotlin",
    "Lisp",
    "Lua",
    "MATLAB",
    "Objective-C",
    "Pascal",
    "Perl",
    "PHP",
    "Prolog",
    "Python",
    "R",
    "Ruby",
    "Rust",
    "Scala",
    "Shell",
    "Smalltalk",
    "SQL",
    "Swift",
    "TypeScript",
    "Visual Basic",
    "Zig",
  ];

  const technologies = [
    "Next.js",
    "React.js",
    "Tailwind CSS",
    "jQuery",
    "Bootstrap",
    "Material-UI",
    "Git",
    "VS Code",
    "Figma",
    "Spline",
    "Django",
  ];

  const contributionTypes = [
    "Documentation",
    "Design",
    "Testing",
    "????",
    "Translation",
  ];

  const difficulty = ["Beginner", "Intermediate", "Advanced", "Expert"];
  const lastUpdated = ["Last 24 hours", "Last 7 days", "Last 30 days"];

  const printTags = () => {
    console.log("selected stuff");
    console.log(selectedLanguages);
    console.log(selectedTechnologies);
    console.log(selectedContributionTypes);
    console.log(selectedDifficulty);
    console.log(selectedLastUpdated);
  };

  return (
    <div className="w-screen min-h-screen justify-center flex flex-col items-center">
      {user && (
        <div className="bg-blue-100 p-4 text-center">
          <pre>{JSON.stringify(user, null, 2)}</pre>
        </div>
      )}
      <CodeConnectTitle />
      <div className="flex justify-center w-full">
        <div className="main-page-contents">
          <div className="w-full">
            <h3 className="inter-bold main-subtitle">Recommended for you:</h3>
            <div className="main-page-holder">
              <ProjectPreview
                name="My Project"
                date="March 15, 2024"
                tags={["Frontend", "Open Source"]}
                description="A description of the project that takes up multiple lines and explains what the project does in detail."
                techStack={["React", "TypeScript", "Tailwind"]}
                issueCount={5}
                recommended={true}
              />
              <ProjectPreview
                name="My Project"
                date="March 15, 2024"
                tags={["Frontend", "Open Source"]}
                description="A description of the project that takes up multiple lines and explains what the project does in detail."
                techStack={["React", "TypeScript", "Tailwind"]}
                issueCount={5}
                recommended={true}
              />
              <ProjectPreview
                name="My Project"
                date="March 15, 2024"
                tags={["Frontend", "Open Source"]}
                description="A description of the project that takes up multiple lines and explains what the project does in detail."
                techStack={["React", "TypeScript", "Tailwind"]}
                issueCount={5}
                recommended={true}
              />
            </div>
          </div>

          <div className="w-full py-2.5">
            <h3 className="inter-bold main-subtitle">More Projects:</h3>
            <div className="w-full flex justify-evenly filtertag-holder">
              <div className="w-1/2 mr-2 h-full filter-holder">
                <h3 className="inter-bold main-subtitle">Filter By:</h3>
                <div className="main-page-filter-box radial-background px-2 py-1 inria-sans-bold flex flex-col justify-center">
                  <div>
                    <p>Languages:</p>
                    <MultiSelector
                      availableTags={languages}
                      onTagsChange={(tags) => handleTagsChange("languages", tags)}
                      initialTags={selectedLanguages}
                    />
                  </div>
                  <div>
                    <p>Technologies:</p>
                    <MultiSelector
                      availableTags={technologies}
                      onTagsChange={(tags) =>
                        handleTagsChange("technologies", tags)
                      }
                      initialTags={selectedTechnologies}
                    />
                  </div>
                  <div>
                    <p>Contribution Type:</p>
                    <MultiSelector
                      availableTags={contributionTypes}
                      onTagsChange={(tags) =>
                        handleTagsChange("contributionTypes", tags)
                      }
                      initialTags={selectedContributionTypes}
                    />
                  </div>
                  <div>
                    <p>Difficulty:</p>
                    <SingleSelector
                      values={difficulty}
                      onValueChange={(value) =>
                        handleValueChange("difficulty", value || "")
                      }
                      initialValue={selectedDifficulty}
                    />
                  </div>
                  <div>
                    <p>Last Updated:</p>
                    <SingleSelector
                      values={lastUpdated}
                      onValueChange={(value) =>
                        handleValueChange("lastUpdated", value || "")
                      }
                      initialValue={selectedLastUpdated}
                    />
                  </div>
                  <div>
                    <p>Filter Mode:</p>
                    <SingleSelector
                      values={['AND', 'OR']}
                      onValueChange={(value) => handleValueChange("filterMode", value || 'AND')}
                      initialValue={filterMode}
                    />
                  </div>
                  <div>
                    <button onClick={clearAllFilters} className="flex items-center py-1 px-2 m-1 bg-red-700 hover:bg-red-900 rounded">
                      Clear All
                    </button>
                  </div>
                </div>
              </div>
              <div className="w-1/2 ml-2 filter-holder">
                <h3 className="inter-bold rad main-subtitle">Include These Tags:</h3>
                <div className="main-page-filter-box radial-background px-2 py-1"></div>
              </div>
            </div>
          </div>

          <div className="main-page-holder">
            <ProjectPreview
              name="Project Name"
              date="March 15, 2024"
              tags={["Project Tag", "Project Tag", "Project Tag"]}
              description="Project Description"
              techStack={["React", "TypeScript", "Tailwind"]}
              issueCount={5}
            />
            <ProjectPreview
              name="Project Name"
              date="March 15, 2024"
              tags={["Project Tag", "Project Tag", "Project Tag"]}
              description="Project Description"
              techStack={["React", "TypeScript", "Tailwind"]}
              issueCount={5}
            />
            <ProjectPreview
              name="Project Name"
              date="March 15, 2024"
              tags={["Project Tag", "Project Tag", "Project Tag"]}
              description="Project Description"
              techStack={["React", "TypeScript", "Tailwind"]}
              issueCount={5}
            />
            <ProjectPreview
              name="Project Name"
              date="March 15, 2024"
              tags={["Project Tag", "Project Tag", "Project Tag"]}
              description="Project Description"
              techStack={["React", "TypeScript", "Tailwind"]}
              issueCount={5}
            />
            <ProjectPreview
              name="Project Name"
              date="March 15, 2024"
              tags={["Project Tag", "Project Tag", "Project Tag"]}
              description="Project Description"
              techStack={["React", "TypeScript", "Tailwind"]}
              issueCount={5}
            />
            <ProjectPreview
              name="Project Name"
              date="March 15, 2024"
              tags={["Project Tag", "Project Tag", "Project Tag"]}
              description="Project Description"
              techStack={["React", "TypeScript", "Tailwind"]}
              issueCount={5}
            />
            <ProjectPreview
              name="Project Name"
              date="March 15, 2024"
              tags={["Project Tag", "Project Tag", "Project Tag"]}
              description="Project Description"
              techStack={["React", "TypeScript", "Tailwind"]}
              issueCount={5}
            />
            <ProjectPreview
              name="Project Name"
              date="March 15, 2024"
              tags={["Project Tag", "Project Tag", "Project Tag"]}
              description="Project Description"
              techStack={["React", "TypeScript", "Tailwind"]}
              issueCount={5}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
