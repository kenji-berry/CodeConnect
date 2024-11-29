"use client";
import React, { useState } from "react";
import MultiSelector from "../Components/MultiSelector";
import SingleSelector from "../Components/SingleSelector";

const Page = () => {
  const [personalTags, setPersonalTags] = useState<string[]>([]);
  const [selectedFrequency, setSelectedFrequency] = useState<string>("");
  const [customFrequency, setCustomFrequency] = useState<string>("");

  const tags = ["tag1", "tag2", "tag3", "tag4", "tag5"];
  const frequencies = ["Daily", "Weekly", "Monthly", "Custom"];

  const frequencyMap: { [key: string]: number } = {
    Daily: 1,
    Weekly: 7,
    Monthly: 30,
    Custom: 0,
  };

  const handleTagsChange = (key: string, tags: string[]) => {
    setPersonalTags(tags);
  };

  const handleFrequencyChange = (value: string) => {
    setSelectedFrequency(value);
    if (value !== "Custom") {
      setCustomFrequency("");
    }
  };

  const handleCustomFrequencyChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    if (value === "" || (!isNaN(Number(value)) && Number(value) > 0)) {
      setCustomFrequency(value);
    }
  };

  const printDet = () => {
    const frequencyInDays =
      selectedFrequency === "Custom"
        ? Number(customFrequency)
        : frequencyMap[selectedFrequency];
    console.log(personalTags);
    console.log(frequencyInDays);
  };

  return (
    <div className="w-screen h-screen flex flex-col items-center">
      <div className="w-3/4">
        <button onClick={printDet}>ddd</button>
        <h1 className="text-3xl">Settings</h1>
        <h3>Email Address:</h3>
        <h2>Sign up for email notifications for projects with these tags:</h2>
        <MultiSelector
          availableTags={tags}
          onTagsChange={(tags) => handleTagsChange("contributionTypes", tags)}
          initialTags={personalTags}
        />
        <h2>Other Preferences</h2>
        <h3>Languages:</h3>
        <h3>Skill Level:</h3>
        <h3>Frequency of Notifications:</h3>
        <SingleSelector
          values={frequencies}
          onValueChange={(value) => handleFrequencyChange(value || "")}
          initialValue={selectedFrequency}
        />
        {selectedFrequency === "Custom" && (
          <input
            type="number"
            value={customFrequency}
            onChange={handleCustomFrequencyChange}
            placeholder="Enter custom frequency in days"
            className="mt-2 p-2 border rounded"
            min="1"
          />
        )}
      </div>

      <footer className="row-start-3 flex gap-6 flex-wrap justify-center"></footer>
    </div>
  );
};

export default Page;
