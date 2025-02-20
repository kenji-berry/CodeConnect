"use client";
import React, { useState, useEffect } from "react";
import { useSearchParams } from 'next/navigation';
import { supabase } from "@/supabaseClient";
import "../../post-project/style.css";
import MultiSelector from "../../Components/MultiSelector";
import SingleSelector from "../../Components/SingleSelector";
import ActivityGraph from "../../Components/ActivityGraph";

const Page = () => {
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [technologies, setTechnologies] = useState<string[]>([]);
  const [selectedTechnologies, setSelectedTechnologies] = useState<string[]>([]);
  const [descriptionOption, setDescriptionOption] = useState<string>("Use existing description");
  const [session, setSession] = useState<any>(null);

  const handleTagsChange = (tags: string[]) => {
    setSelectedTags(tags);
  };

  const handleTechnologiesChange = (technologies: string[]) => {
    setSelectedTechnologies(technologies);
  };

  const handleDescriptionOptionChange = (option: string) => {
    setDescriptionOption(option);
  };

  const descriptionOptions = ["Use existing description", "Write your Own"];

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
    const fetchAllData = async () => {
      try {
        // 1. Fetch session
        const { data: { session: authSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error(sessionError.message);
        setSession(authSession);
  
        // 2. Parallel fetch for tags and technologies
        const [tagsResponse, technologiesResponse] = await Promise.all([
          supabase.from('tags').select('name'),
          supabase.from('technologies').select('name')
        ]);
  
        // Handle tags response
        if (tagsResponse.error) throw new Error(tagsResponse.error.message);
        const tagNames = (tagsResponse.data || [])
          .filter((tag): tag is { name: string } => tag && typeof tag.name === 'string')
          .map(tag => tag.name)
          .filter(name => name.length > 0);
        setTags(tagNames);
        console.log('Fetched tags:', tagNames);
  
        // Handle technologies response
        if (technologiesResponse.error) throw new Error(technologiesResponse.error.message);
        const techNames = (technologiesResponse.data || [])
          .filter((tech): tech is { name: string } => tech && typeof tech.name === 'string')
          .map(tech => tech.name)
          .filter(name => name.length > 0);
        setTechnologies(techNames);
        console.log('Fetched technologies:', techNames);
  
        // 3. Fetch GitHub repo data if we have repo name, owner, and token
        if (repoName && owner && authSession?.provider_token) {
          const [
            repoResponse,
            languagesResponse,
            contributorsResponse,
            issuesResponse,
            commitsResponse
          ] = await Promise.all([
            fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
              headers: { Authorization: `Bearer ${authSession.provider_token}` },
            }),
            fetch(`https://api.github.com/repos/${owner}/${repoName}/languages`, {
              headers: { Authorization: `Bearer ${authSession.provider_token}` },
            }),
            fetch(`https://api.github.com/repos/${owner}/${repoName}/contributors?per_page=1`, {
              headers: { Authorization: `Bearer ${authSession.provider_token}` },
            }),
            fetch(`https://api.github.com/repos/${owner}/${repoName}/issues?state=open`, {
              headers: { Authorization: `Bearer ${authSession.provider_token}` },
            }),
            fetch(`https://api.github.com/repos/${owner}/${repoName}/commits?per_page=1`, {
              headers: { Authorization: `Bearer ${authSession.provider_token}` },
            })
          ]);
  
          const [repoData, languagesData, , issuesData, commitsData] = await Promise.all([
            repoResponse.json(),
            languagesResponse.json(),
            null, // placeholder for contributorsResponse
            issuesResponse.json(),
            commitsResponse.json(),
          ]);
  
          const contributorsCount = contributorsResponse.headers.get('link')
            ? parseInt(contributorsResponse.headers.get('link')?.match(/page=(\d+)>; rel="last"/)?.[1] || '1')
            : 1;
  
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
            latestCommit: commitsData[0]?.commit?.message || 'No commits',
          });
        }
      } catch (error) {
        console.error('Error in fetchAllData:', error);
      }
    };
  
    fetchAllData();
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
              Write your own project description or use existing description?
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
              className="w-full mt-2 p-2 border rounded-lg shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none text-black resize-y min-h-[2.6rem]"
              placeholder="Write your project description here..."
              rows={3}
              style={{ resize: 'vertical' }}
            />
            )}
        </div>
        <div className="bento-box half-width radial-background">
          <h4>Technologies and Languages:</h4>
          <MultiSelector
            availableTags={technologies}
            onTagsChange={handleTechnologiesChange}
            initialTags={selectedTechnologies}
          />
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
          <h4>Most Recent Commit: {repoInfo.latestCommit}</h4>
          <div>
            <h4>Activity Graph:</h4>
            <ActivityGraph 
              owner={owner || ''} 
              repo={repoName || ''} 
              token={session?.provider_token || ''}
            />
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
