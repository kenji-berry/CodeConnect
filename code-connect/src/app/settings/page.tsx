"use client";
import React from "react";
import MultiSelector from "../Components/MultiSelector";

const page = () => {
  const [personalTags, setPersonalTags] = React.useState<string[]>([]);

  const tags = ["tag1", "tag2", "tag3", "tag4", "tag5"];

  const handleTagsChange = (key: string, tags: string[]) => {
    setPersonalTags(tags);
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center">
      <div className="w-3/4">
        <h1 className="text-3xl">Settings</h1>
        <h3>Email Address:</h3>
        <h3>Sign up for email notifications for projects with these tags:</h3>
        <MultiSelector
          availableTags={tags}
          onTagsChange={(tags) => handleTagsChange("contributionTypes", tags)}
          initialTags={personalTags}
        />
      </div>

      <footer className="row-start-3 flex gap-6 flex-wrap justify-center"></footer>
    </div>
  );
};

export default page;
