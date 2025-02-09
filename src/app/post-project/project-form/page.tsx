"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams } from 'next/navigation';
import { supabase } from "@/supabaseClient";
import "../../post-project/style.css";
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

  const searchParams = useSearchParams();
  const repoName = searchParams.get('repo');
  const owner = searchParams.get('owner');
  
  const [repoInfo, setRepoInfo] = useState({
    owner: '',
    license: '',
    languages: {},
    size: 0,
    stars: 0,
    forks: 0,
    contributors: 0,
    openIssues: 0,
    goodFirstIssues: 0,
    pullRequests: 0,
    latestCommit: '',
  });

  useEffect(() => {
    const fetchRepoData = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Error fetching session:", error.message);
        return;
      }

      if (session?.provider_token) {
        try {
          const repoResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}`,
            {
              headers: {
                Authorization: `Bearer ${session.provider_token}`,
              },
            }
          );
          const repoData = await repoResponse.json();

          const languagesResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/languages`,
            {
              headers: {
                Authorization: `Bearer ${session.provider_token}`,
              },
            }
          );
          const languagesData = await languagesResponse.json();

          const contributorsResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/contributors?per_page=1`,
            {
              headers: {
                Authorization: `Bearer ${session.provider_token}`,
              },
            }
          );
          const contributorsCount = contributorsResponse.headers.get('link')
            ? parseInt(contributorsResponse.headers.get('link').match(/page=(\d+)>; rel="last"/)[1])
            : 1;

          const issuesResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/issues?state=open`,
            {
              headers: {
                Authorization: `Bearer ${session.provider_token}`,
              },
            }
          );
          const issuesData = await issuesResponse.json();
          
          const commitsResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repoName}/commits?per_page=1`,
            {
              headers: {
                Authorization: `Bearer ${session.provider_token}`,
              },
            }
          );
          const [latestCommit] = await commitsResponse.json();

          setRepoInfo({
            owner: repoData.owner.login,
            license: repoData.license?.name || 'No license',
            languages: languagesData,
            size: repoData.size,
            stars: repoData.stargazers_count,
            forks: repoData.forks_count,
            contributors: contributorsCount,
            openIssues: repoData.open_issues_count,
            goodFirstIssues: issuesData.filter(issue => 
              issue.labels.some(label => label.name === 'good first issue')).length,
            pullRequests: issuesData.filter(issue => 'pull_request' in issue).length,
            latestCommit: latestCommit?.commit?.message || 'No commits',
          });
        } catch (error) {
          console.error("Error fetching repo data:", error);
        }
      }
    };

    if (repoName && owner) {
      fetchRepoData();
    }
  }, [repoName, owner]);

  return (
    <div className="w-screen h-screen flex flex-col items-center">
      <h1 className="project-page-project-name">
        <a target="_blank" href="project">
          {repoName}
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
          <h4>Owner: {repoInfo.owner}</h4>
          <h4>License: {repoInfo.license}</h4>
          <h4>Languages: {Object.keys(repoInfo.languages).join(', ')}</h4>
          <h4>Repo Size: {(repoInfo.size / 1024).toFixed(2)} MB</h4>
          <h4>Stars: {repoInfo.stars}</h4>
          <h4>Forks: {repoInfo.forks}</h4>
          <h4>Contributors: {repoInfo.contributors}</h4>
        </div>
        <div className="bento-box half-width radial-background">
          <h4>Issues Open: {repoInfo.openIssues}</h4>
          <h4>Good First Issues: {repoInfo.goodFirstIssues}</h4>
          <h4>Pull Requests: {repoInfo.pullRequests}</h4>
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
