"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CodeConnectTitle from "./Components/CodeConnectTitle";
import Logo from "./Components/Logo";
import NavBar from "./Components/NavBar";
import ProjectPreview from "./Components/ProjectPreview";
import MultiSelector from "./MultiSelector";
import SingleSelector from "./SingleSelector";

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>(
    []
  );
  const [selectedContributionTypes, setSelectedContributionTypes] = useState<
    string[]
  >([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("");
  const [selectedLastUpdated, setSelectedLastUpdated] = useState<string>("");

  useEffect(() => {
    const languages = searchParams.get("languages")?.split(",") || [];
    const technologies = searchParams.get("technologies")?.split(",") || [];
    const contributionTypes =
      searchParams.get("contributionTypes")?.split(",") || [];
    const difficulty = searchParams.get("difficulty") || "";
    const lastUpdated = searchParams.get("lastUpdated") || "";

    setSelectedLanguages(languages.filter(Boolean));
    setSelectedTechnologies(technologies.filter(Boolean));
    setSelectedContributionTypes(contributionTypes.filter(Boolean));
    setSelectedDifficulty(difficulty);
    setSelectedLastUpdated(lastUpdated);
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

    router.push(`?${params.toString()}`, { scroll: false });
  }, [
    selectedLanguages,
    selectedTechnologies,
    selectedContributionTypes,
    selectedDifficulty,
    selectedLastUpdated,
    router,
  ]);

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
      default:
        break;
    }
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
    <div className="w-screen h-screen radial-background flex flex-col items-center">
      <NavBar />
      <CodeConnectTitle />
      <button onClick={printTags}>dwadwad</button>
      <div className="main-page-contents">
        <div className="w-full">
          <h3 className="inter-bold">Recommended for you:</h3>
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
          <h3 className="inter-bold">More Projects:</h3>
          <div className="w-full flex justify-evenly">
            <div className="w-1/2 mr-2 h-full">
              <h3 className="inter-bold">Filter By:</h3>
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
              </div>
            </div>
            <div className="w-1/2 ml-2">
              <h3 className="inter-bold rad">Include These Tags:</h3>
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
      <footer className="row-start-3 flex gap-6 flex-wrap justify-center"></footer>
    </div>
  );
}
