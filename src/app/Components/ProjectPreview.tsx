import React, { useState, useMemo } from "react";

interface HighlightableItem {
  name: string;
  is_highlighted?: boolean;
  colour?: string;
}

interface ProjectPreviewProps {
  id: string | number;
  name: string;
  date: string;
  tags: HighlightableItem[];
  techStack: string[];
  description: string;
  issueCount: number;
  recommended?: boolean;
  image?: string | null;
}

const ProjectPreview = React.memo<ProjectPreviewProps>(({
  id,
  name,
  date,
  tags,
  techStack,
  description,
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

  const tagsToShow = useMemo(() => {
    if (!Array.isArray(tags)) {
      console.error("ProjectPreview: 'tags' prop received non-array:", tags);
      return [];
    }
    const highlighted = tags.filter(tag => tag?.is_highlighted);
    return highlighted.length > 0 ? highlighted : tags.slice(0, 3);
  }, [tags]);

  return (
    <div
      className={`relative bg-[#18181b] shadow-lg rounded-xl border-2 transition-transform cursor-pointer hover:-translate-y-1 hover:shadow-2xl
        ${recommended ? "border-[var(--orange)]" : "border-[var(--off-white)]"}
        w-[22rem] min-h-[27rem] flex flex-col overflow-hidden
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <a href={`/projects/${id}`} className="block h-full">
         <div className="w-full aspect-video bg-[#1a1a1a] overflow-hidden flex items-center justify-center">
          {image && !imageError ? (
            <img
              src={image}
              alt={`${name} banner`}
              className="w-full h-full object-cover transition-transform duration-200"
              onError={() => setImageError(true)}
              style={{ aspectRatio: "16/9" }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#232323]">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1 p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold text-[var(--off-white)] truncate max-w-[70%]">{name}</h2>
            <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(date)}</span>
          </div>

          <div className="flex flex-wrap gap-1 mb-2">
            {tagsToShow.map((tag, index) => {
              const tagColour = tag.colour ? `#${tag.colour}` : 'var(--muted-red)';
              return (
                <span
                  key={index}
                  className="px-2 py-0.5 rounded text-xs font-semibold"
                  style={{
                    backgroundColor: tagColour,
                    color: "#fff",
                    opacity: tag.is_highlighted ? 1 : 0.85,
                  }}
                >
                  {tag.name}
                </span>
              );
            })}
          </div>

          <div className="flex-1 flex flex-col">
            <p className="text-[var(--off-white)] text-sm bg-[#232323] px-3 py-2 rounded mb-2 min-h-[5rem] max-h-[7.5rem] overflow-hidden line-clamp-5">
              {description}
            </p>

            {Array.isArray(techStack) && techStack.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {techStack.map((techName, index) => (
                  <span
                    key={index}
                    className="bg-[#31313a] text-xs text-[var(--off-white)] px-2 py-0.5 rounded font-medium"
                  >
                    {techName}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-[#232323] mt-2">
            <div className="text-xs text-[var(--orange)] font-semibold">
              {issueCount} open issue{issueCount === 1 ? "" : "s"}
            </div>
            <div
              className="w-0 h-0
              border-t-[6px] border-t-transparent
              border-l-[12px] border-l-[rgb(121,121,121)]
              border-b-[6px] border-b-transparent
              transition-colors"
            />
          </div>
        </div>

        <div
          className={`absolute inset-0 bg-black flex items-center justify-center text-white text-base font-semibold transition-opacity duration-300 pointer-events-none ${
            isHovered ? "opacity-70" : "opacity-0"
          }`}
        >
          Click to view this project
        </div>
      </a>
    </div>
  );
});

ProjectPreview.displayName = 'ProjectPreview';

export default ProjectPreview;
