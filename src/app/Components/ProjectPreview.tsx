import React, { useState } from "react";

interface TagWithColour {
  name: string;
  colour?: string;
}

interface ProjectPreviewProps {
  id: string | number;
  name: string;
  date: string;
  tags: TagWithColour[];
  description: string;
  techStack: string[];
  issueCount: number;
  recommended?: boolean;
  image?: string | null;
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
  image = null,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

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
      className={`relative py-0 px-0 mb-4 w-[19rem] h-[23rem] transition-transform cursor-pointer ${
        recommended ? "border-[var(--orange)]" : "border-[var(--off-white)]"
      } border-2 inter-bold overflow-hidden`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a href={`/projects/${id}`} className="block h-full">
        <div className="w-full h-[8rem] bg-[#1a1a1a] overflow-hidden">
          {image && !imageError ? (
            <img
              src={image}
              alt={`${name} banner`}
              className="w-full h-full object-fill"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#1a1a1a]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        <div className="py-2 px-3">
          <div className="flex justify-between items-center mb-1">
            <h2 className="text-base font-bold text-[var(--off-white)] underline decoration-1 underline-offset-2">
              {name}
            </h2>
            <span className="text-xs inter-bold">{formatDate(date)}</span>
          </div>

          <div className="flex flex-wrap gap-1 mb-1">
            {tags.map((tag, index) => {
              const tagColour = tag.colour ? `#${tag.colour}` : 'var(--muted-red)';
              
              return (
                <span
                  key={index}
                  className="px-2 py-0.5 rounded text-xs text-[var(--off-white)]"
                  style={{ backgroundColor: tagColour }}
                >
                  {tag.name}
                </span>
              );
            })}
          </div>

          <p className="text-[var(--off-white)] text-xs line-clamp-3 bg-[rgb(121,121,121)] px-2 py-1 flex-grow h-[3.2rem] inter-basic">
            {description}
          </p>

          <div className="flex flex-wrap gap-1 mt-1">
            {techStack.map((tech, index) => (
              <span key={index} className="text-xs font-medium">
                {tech}
              </span>
            ))}
          </div>

          <div className="flex justify-between items-center mt-1">
            <div className="text-xs">{issueCount} open issues</div>
            <div
              className="w-0 h-0 
              border-t-[5px] border-t-transparent
              border-l-[9px] border-l-[rgb(121,121,121)]
              border-b-[5px] border-b-transparent
              transition-colors"
            />
          </div>
        </div>

        <div
          className={`absolute inset-0 bg-black flex items-center justify-center text-white text-base transition-opacity duration-300 ${
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
