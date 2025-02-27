import React, { useState } from "react";

interface ProjectPreviewProps {
  id: string;
  name: string;
  date: string;
  tags: string[];
  description: string;
  techStack: string[];
  issueCount: number;
  recommended?: boolean;
}

const ProjectPreview: React.FC<ProjectPreviewProps> = ({
  id, 
  name,
  date,
  tags,
  description,
  techStack,
  issueCount,
  recommended = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  return (
    <div
      className={`relative py-2 px-2.5 mb-2 w-[17.5rem] h-[13rem] transition-transform cursor-pointer ${
        recommended ? "border-[var(--orange)]" : "border-[var(--off-white)]"
      } border-2 inter-bold`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a href={`/projects/${id}`}>
        <div className="flex justify-between items-center mb-1.5">
          <h2 className="text-sm inter-bold text-[var(--off-white)] underline decoration-1 underline-offset-2">
            {name}
          </h2>
          <span className="text-xs inter-bold">{formatDate(date)}</span>
        </div>

        <div className="flex flex-wrap gap-1 mb-1.5">
          {tags.map((tag, index) => (
            <span
              key={index}
              className="bg-[var(--muted-red)] px-2 py-0.5 rounded text-[0.65rem] text-[var(--off-white)]"
            >
              {tag}
            </span>
          ))}
        </div>

        <p className="text-[var(--off-white)] text-xs line-clamp-4 bg-[rgb(121,121,121)] px-2 py-1.5 flex-grow h-[6rem] inter-basic">
          {description}
        </p>

        <div className="flex flex-wrap gap-1 mt-1.5">
          {techStack.map((tech, index) => (
            <span key={index} className="text-xs">
              {tech}
            </span>
          ))}
        </div>

        <div className="flex justify-between items-center mt-1">
          <div className="text-xs">{issueCount} open issues</div>
          <div
            className="w-0 h-0 
          border-t-[6px] border-t-transparent
          border-l-[10px] border-l-[rgb(121,121,121)]
          border-b-[6px] border-b-transparent
          transition-colors"
          />
        </div>

        <div
          className={`absolute inset-0 bg-black flex items-center justify-center text-white text-lg transition-opacity duration-300 ${
            isHovered ? "opacity-75" : "opacity-0"
          }`}
        >
          Click to view this project
        </div>
      </a>
    </div>
  );
};

export default ProjectPreview;
