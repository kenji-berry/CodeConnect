"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FaExternalLinkAlt } from "react-icons/fa";
import Link from 'next/link';
import { fetchUserRepositories, fetchRepositoryLanguages } from "../../utils/githubUtils";

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
};

// Cache duration in milliseconds (e.g., 1 hour)
const CACHE_DURATION = 60 * 60 * 1000;

const Page = () => {
  const { session, loading: authLoading, error: authError } = useAuth();
  const [repositories, setRepositories] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [languages, setLanguages] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !session) {
      console.log("No authenticated session");
      setIsLoading(false);
      return;
    }

    if (!authLoading && session) {
      fetchRepositories(false); // Pass false to avoid force refresh
    }
  }, [session, authLoading]);

  const fetchRepositories = async (forceRefresh = false) => {
    try {
      // Check for cached data first
      const cachedReposTime = localStorage.getItem('github_repos_time');
      const cachedRepos = localStorage.getItem('github_repos');
      const cachedLangs = localStorage.getItem('github_langs');
      
      const now = new Date().getTime();
      const isCacheValid = cachedReposTime && cachedRepos && cachedLangs && 
                          (now - parseInt(cachedReposTime) < CACHE_DURATION);
      
      // Use cache if valid and not forcing refresh
      if (isCacheValid && !forceRefresh) {
        console.log('Using cached repository data');
        setRepositories(JSON.parse(cachedRepos));
        setLanguages(JSON.parse(cachedLangs));
        setIsLoading(false);
        return;
      }
      
      console.log('Fetching fresh repository data');
      const repos = await fetchUserRepositories();
      setRepositories(repos || []);
      
      // Create an object to store all language data
      const languagesData = {};
      
      // Create an array of promises for fetching languages
      const languagePromises = repos?.map(async (repo) => {
        if (repo?.owner?.login && repo?.name) {
          try {
            const repoLanguages = await fetchRepositoryLanguages(
              repo.owner.login, 
              repo.name
            );
            languagesData[repo.id] = repoLanguages;
          } catch (error) {
            console.error(`Error fetching languages for ${repo?.name}:`, error);
          }
        }
      });
      
      // Wait for all language requests to complete
      if (languagePromises?.length) {
        await Promise.all(languagePromises);
        setLanguages(languagesData);
      }
      
      // Cache the results
      localStorage.setItem('github_repos', JSON.stringify(repos));
      localStorage.setItem('github_langs', JSON.stringify(languagesData));
      localStorage.setItem('github_repos_time', now.toString());
      
    } catch (error) {
      console.error("Error fetching repositories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full radial-background">
        <div className="text-center">
          <div className="mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[--title-red] mx-auto"></div>
          </div>
          <h1 className="inria-sans-bold text-xl text-off-white">Loading Your Repositories</h1>
        </div>
      </div>
    );
  }

  if (authError) {
    return <div className="w-screen h-screen flex items-center justify-center">
      <div className="text-red-500">{authError}</div>
    </div>;
  }

  const filteredRepositories = repositories.filter((repo) =>
    repo.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-screen h-screen flex flex-col items-center inria-sans-regular p-8">
      <h1 className="text-3xl font-bold mb text-neutral-100">
        Select a Repository:
      </h1>
      <input
        type="text"
        placeholder="Search repositories"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="mb-8 p-3 border rounded-lg w-full max-w-xl shadow-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-transparent text-neutral-100 placeholder-neutral-400"
      />
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredRepositories.map((repo) => (
          <Link
            key={repo.id}
            href={`/post-project/project-form?repo=${repo.name}&owner=${repo.owner.login}`}
            className="p-6 border-2 border-neutral-200 rounded-xl hover:border-red-300 transition-all duration-300 backdrop-blur-sm cursor-pointer"
          >
            <div className="mb-4">
              <h2 className="text-xl font-semibold flex justify-between items-start">
                <div className="flex items-center group">
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-red-400 hover:text-red-300"
                  >
                    {repo.name}
                  </a>
                  <a
                    href={repo.html_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="ml-2 text-sm opacity-60 group-hover:opacity-100 transition-opacity"
                  >
                    <FaExternalLinkAlt />
                  </a>
                </div>
              </h2>
              <p className="text-sm text-neutral-300 mt-1">
                Updated: {formatDate(repo.updated_at)}
              </p>
            </div>

            <p className="text-neutral-200 mb-4 line-clamp-2">
              {repo.description || "No description available"}
            </p>

            <div className="flex justify-between text-sm text-neutral-300">
              <div className="flex items-center space-x-4">
                <span className="flex items-center">
                  <span className="text-yellow-300 mr-1">★</span>
                  {repo.stargazers_count}
                </span>
                <span className="flex items-center">
                  <span className="mr-1">🍴</span>
                  {repo.forks_count}
                </span>
              </div>
              <div className="text-neutral-300">
                {languages[repo.id] ? 
                  (typeof languages[repo.id] === 'object' && languages[repo.id] !== null) ?
                    ('message' in languages[repo.id] ? 
                      (repo.language || 'Not specified') :
                      (Object.keys(languages[repo.id])
                        .slice(0, 3)
                        .join(', ') || 'No languages detected')
                    ) : 'Loading...'
                  : 'Loading...'
                }
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Page;
