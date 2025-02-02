"use client";
import React, { useState } from "react";
import "./style.css";
import MultiSelector from "../../Components/MultiSelector";
import SingleSelector from "../../Components/SingleSelector";

const Page = () => {
  const tags = ["tag1", "tag2", "tag3", "tag4", "tag5"];
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [descriptionOption, setDescriptionOption] = useState<string>("Use README");

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  const handleDescriptionOptionChange = (option: string) => {
    setDescriptionOption(option);
  };

  const descriptionOptions = ["Use README", "Write your Own"];

  const printDescription = () => {
    console.log(descriptionOption);
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center">
      <button onClick={printDescription}>dddd</button>
      <h1 className="project-page-project-name">
        <a target="_blank" href="project">
          Project Name
        </a>
      </h1>
      <div className="bento-container w-full inria-sans-regular">
        <div className="bento-box full-width radial-background">
          <div className="flex items-center">
            <span className="mr-2 inria-sans-semibold">
              Write your own project description or use existing README?
            </span>
            <SingleSelector
              values={descriptionOptions}
              onValueChange={(value) =>
                handleDescriptionOptionChange(value || "")
              }
              initialValue={descriptionOption}
            />
          </div>
          {descriptionOption === "Write your Own" && (
            <textarea
              className="w-full mt-2 p-2 border rounded"
              placeholder="Write your project description here..."
            />
          )}
        </div>
        <div className="bento-box half-width radial-background">
          <h4>Tech Stack:</h4>
        </div>
        <div className="bento-box half-width radial-background">
          <h4>Tags:</h4>
          <MultiSelector
            availableTags={tags}
            onTagsChange={handleTagsChange}
            initialTags={selectedTags}
          />
        </div>
        <div className="full-width">
          <h2 className="inria-sans-semibold">READ ONLY Project Information (as of xx/xx/xx)</h2>
        </div>
        <div className="bento-box half-width radial-background">
          <h4>Owner:</h4>
          <h4>License:</h4>
          <h4>Languages:</h4>
          <h4>Repo Size:</h4>
          <h4>Stars:</h4>
          <h4>Forks:</h4>
          <h4>Contributors:</h4>
        </div>
        <div className="bento-box half-width radial-background">
          <h4>Issues Open:</h4>
          <h4>Good First Issues:</h4>
          <h4>Pull Requests:</h4>
        </div>
        <div className="bento-box full-width radial-background">
          <h3 className="inria-sans-semibold">Recent Activity:</h3>
          <h4>Most Recent Commit:</h4>
          <div>
            <h4>Activity Graph:</h4>
            <img src="EXAMPLEActivityGraph.jpg" alt="activity graph" />
          </div>
        </div>
      </div>
      <div className="full-width flex flex-col items-center preview">
          <h2 className="project-preview-link inter-medium"><a href="preview">Preview And Post</a></h2>
          <p>See how your post will appear once it's live.</p>
        </div>
    </div>
  );
};

export default Page;
