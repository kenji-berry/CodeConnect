import React from "react";

interface ProjectPreviewProps {
  name: string;
  date: string;
  tags: string[];
  description: string;
  techStack: string[];
  issueCount: number;
  recommended?: boolean;
}

const ProjectPreview: React.FC<ProjectPreviewProps> = ({
  name,
  date,
  tags,
  description,
  techStack,
  issueCount,
  recommended = false,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  };

  return (
    <div className={`radial-background py-1 px-1.5 w-[17.5rem] h-[13rem] transition-transform cursor-pointer ${
      recommended ? 'border-[var(--orange)]' : 'border-[var(--off-white)]'
    } border inter-bold`}>
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-sm inter-bold text-[var(--off-white)] underline decoration-1 underline-offset-2">
          {name}
        </h2>
        <span className="text-xs inter-bold">{formatDate(date)}</span>
      </div>

      <div className="flex flex-wrap gap-1 mb-1">
  {tags.map((tag, index) => (
    <span
      key={index}
      className="bg-[var(--muted-red)] px-2 py-0.5 rounded text-[0.65rem] text-[var(--off-white)]"
    >
      {tag}
    </span>
  ))}
</div>

      <p className="text-[var(--off-white)] text-xs line-clamp-4 bg-[rgb(121,121,121)] px-2 py-1.5 flex-grow h-[6.75rem] inter-basic">
        {description}
      </p>

      <div className="flex flex-wrap gap-1 mt-1">
        {techStack.map((tech, index) => (
          <span key={index} className="text-xs">
            {tech}
          </span>
        ))}
      </div>

      <div className="flex justify-between items-center mt-1">
        <div className="text-xs">{issueCount} open issues</div>
        <div className="w-0 h-0 
          border-t-[6px] border-t-transparent
          border-l-[10px] border-l-[rgb(121,121,121)]
          border-b-[6px] border-b-transparent
          transition-colors"
        />
      </div>
    </div>
  );
};

export default ProjectPreview;
